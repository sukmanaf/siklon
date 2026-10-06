# SIKLON — Sistem Presensi Siswa

> **Dokumen Perencanaan v2.0** (versi ringkas)
> Stack: **Next.js (web) + Express.js (API) + PostgreSQL**

**Yang dikerjakan sistem ini, tidak lebih:**

1. Siswa scan QR di kartu pelajar (isi QR = **NIS**) — beberapa scanner dalam satu PC
2. Sistem mencatat presensi dan **mengirim WhatsApp ke wali murid**
3. Admin melihat **laporan per siswa dan per kelas**, harian dan bulanan
4. Login untuk admin

---

## Daftar Isi

1. [Ruang Lingkup](#1-ruang-lingkup)
2. [Arsitektur](#2-arsitektur)
3. [Sumber Input Scan](#3-sumber-input-scan)
4. [Notifikasi WhatsApp Gratis](#4-notifikasi-whatsapp-gratis)
5. [Alur Presensi](#5-alur-presensi)
6. [Halaman & Fitur](#6-halaman--fitur)
7. [Database](#7-database)
8. [API](#8-api)
9. [Login & Hak Akses](#9-login--hak-akses)
10. [Laporan](#10-laporan)
11. [Job Terjadwal](#11-job-terjadwal)
12. [Struktur Proyek & Deployment](#12-struktur-proyek--deployment)
13. [Keamanan](#13-keamanan)
14. [Roadmap](#14-roadmap)
15. [Risiko](#15-risiko)
16. [Perangkat Keras & Biaya](#16-perangkat-keras--biaya)

---

## 1. Ruang Lingkup

### Termasuk

| Modul | Isi |
|---|---|
| **Master data** | Siswa, Kelas, Wali Murid, Tahun Ajaran |
| **Presensi** | Konsol scan multi-titik (**absen masuk & pulang**), input manual, ubah status jadi izin/sakit |
| **WhatsApp** | Kirim otomatis saat masuk / terlambat / pulang / tidak hadir, template bisa diedit, log kirim |
| **Laporan** | Harian & bulanan, per siswa dan per kelas, export Excel & PDF |
| **Sistem** | Login, kelola akun admin, pengaturan jadwal & hari libur |

### Sengaja tidak termasuk

**Absen pulang ditambahkan 10 September 2026** atas permintaan pemilik proyek; rancangan awal sengaja hanya absen masuk. Yang tetap tidak ada: tabel kartu (NIS langsung jadi QR), tidak ada alur pengajuan–persetujuan izin (admin ubah status langsung), tidak ada akun untuk guru atau wali murid, tidak ada penilaian atau jadwal pelajaran. Kalau nanti dibutuhkan, semuanya bisa ditambahkan tanpa membongkar struktur yang ada.

---

## 2. Arsitektur

```mermaid
flowchart LR
    subgraph PC["PC Gerbang"]
        S1["Scanner 1"] --> AG
        S2["Scanner 2"] --> AG
        S3["Scanner 3"] --> AG
        AG["Scanner Agent<br/>(Node.js)"]
    end

    subgraph SRV["Server"]
        API["Express API<br/>+ Socket.IO"]
        WRK["Worker<br/>(antrean WA + job harian)"]
        DB[("PostgreSQL")]
    end

    AG -->|HTTPS| API
    API --> DB
    API --> WRK
    WRK --> DB
    WRK -->|Baileys| ORTU["WhatsApp Wali Murid"]
    API -->|WebSocket| WEB["Next.js<br/>Konsol Scan & Laporan"]
```

| Komponen | Teknologi |
|---|---|
| Web | Next.js 15 (App Router), TypeScript, Tailwind + shadcn/ui, TanStack Query |
| API | Express.js 5, TypeScript, Prisma, Zod, Socket.IO |
| Worker | pg-boss — antrean memakai PostgreSQL yang sudah ada, **tidak perlu Redis** |
| WhatsApp | Baileys (gratis), di balik antarmuka yang bisa ditukar |
| Scanner Agent | Node.js + `serialport`, jalan sebagai service di PC gerbang |
| Database | PostgreSQL 16 — 8 tabel |

---

## 3. Sumber Input Scan

Sistem menerima scan dari **tiga sumber yang bisa dipakai bersamaan**. Semuanya berujung pada satu endpoint yang sama (`POST /scans` dengan isi `{gate, nis, scannedAt}`), jadi backend tidak peduli scan datang dari mana.

| Sumber | Untuk apa | Kecepatan | Catatan |
|---|---|---|---|
| **Scanner serial** (USB Virtual COM) | Produksi, gerbang ramai | ± 50 ms | Paling andal, butuh perangkat keras |
| **Webcam / kamera HP di laptop** | **Development**, sekolah kecil, gerbang sepi | ± 150–500 ms | Tanpa perangkat keras tambahan |
| **Browser di HP** | Guru piket keliling, presensi di kelas | ± 150–500 ms | Kamera HP biasanya lebih tajam dari webcam laptop |

### 3.1 Mode kamera (webcam / HP) — untuk development

Pembacaan QR lewat kamera terjadi **di browser**, bukan di Scanner Agent. Halaman Konsol Scan membuka kamera dengan `getUserMedia`, mendekode QR tiap frame, lalu memanggil endpoint yang sama seperti scanner serial.

```ts
// Deteksi kemampuan browser dulu, baru pilih pendekode
async function buatPendekode() {
  if ('BarcodeDetector' in window) {
    const d = new BarcodeDetector({ formats: ['qr_code'] });
    return (v: HTMLVideoElement) => d.detect(v).then(r => r[0]?.rawValue ?? null);
  }
  // Fallback: qr-scanner (Nimiq) — ± 12 KB, jalan di web worker, dukung semua browser
  const QrScanner = (await import('qr-scanner')).default;
  return QrScanner.scanImage;
}
```

> **Penting untuk mesin Linux:** `BarcodeDetector` bawaan Chrome **tidak tersedia di Linux** (hanya Android, ChromeOS, macOS, dan Windows). Jadi di mesin development Linux, jalur yang benar-benar dipakai adalah fallback-nya. Tulis feature detection sejak awal, jangan diakali belakangan.

**Kamera HP disambungkan ke laptop** — ada dua cara, keduanya didukung:

1. **HP jadi webcam.** Android 14+ punya mode *USB webcam* bawaan (langsung terbaca sebagai perangkat UVC di Linux, tanpa driver). Alternatifnya DroidCam atau Iriun yang punya klien Linux. Setelah tersambung, HP muncul sebagai perangkat video biasa di `navigator.mediaDevices.enumerateDevices()` — kodenya sama persis dengan webcam.
2. **HP membuka aplikasinya langsung.** Buka halaman Konsol Scan di browser HP dan pakai kamera belakangnya. Tidak perlu driver sama sekali, dan hasil dekodenya biasanya lebih cepat karena kameranya lebih baik.

### 3.2 Jebakan yang pasti Anda temui: kamera butuh HTTPS

`getUserMedia` hanya jalan di **secure context**. Artinya:

| Alamat | Kamera bisa dibuka? |
|---|---|
| `http://localhost:3000` | ✅ Ya — localhost dianggap aman |
| `http://192.168.1.24:3000` | ❌ **Tidak** — ini yang bikin bingung saat mencoba dari HP |
| `https://…` | ✅ Ya |

Jadi begitu Anda mencoba membuka aplikasi dari HP lewat IP LAN, kamera akan diam saja tanpa pesan error yang jelas. Tiga cara mengatasinya saat development:

```bash
# 1. Next.js punya HTTPS bawaan untuk dev (paling gampang)
next dev --experimental-https

# 2. Sertifikat lokal tepercaya via mkcert
mkcert -install && mkcert 192.168.1.24 localhost

# 3. Terowongan publik ber-HTTPS, praktis untuk uji dari HP
cloudflared tunnel --url http://localhost:3000
```

### 3.3 Berapa titik scan yang dibutuhkan 600 siswa?

Yang menentukan bukan kecepatan baca alatnya saja, tapi seluruh siklus: siswa maju, mengarahkan kartu, alat membaca, layar memberi umpan balik.

| Alat | Siklus per siswa | Siswa/menit per titik | Titik untuk 600 siswa dalam 40 menit |
|---|---|---:|---|
| Webcam laptop | ± 3–5 detik | 12–20 | **2 titik** (pas-pasan), 3 lebih lega |
| **Scanner 2D imager** (USB Virtual COM) | ± 1–1,5 detik | 40–60 | **1 titik** cukup, 2 untuk cadangan |
| Scanner laser 1D | — | — | ❌ tidak bisa membaca QR sama sekali |

> **Catatan istilah yang penting saat membeli:** QR itu kode 2D, jadi wajib dibaca **scanner 2D / image scanner** — sering dijual dengan sebutan "scanner kamera" karena memang memakai sensor kamera, bukan laser. Ini berbeda dari webcam: bentuknya tetap alat scanner dengan lampu dan trigger, kecepatannya ±1 detik, dan mendukung mode Virtual COM. Scanner laser murah **tidak akan bisa membaca QR** — pastikan spesifikasinya menyebut *2D / QR / imager*.

### 3.4 Kapan kamera tidak cukup

Untuk **development dan sekolah kecil**, kamera sudah memadai. Untuk gerbang dengan ratusan siswa di jam yang sama, scanner serial tetap perlu:

- Kamera butuh siswa **menahan kartu diam** di dalam bingkai; scanner laser membaca sambil lewat
- Kartu terlaminasi **memantulkan cahaya** — QR sering gagal terbaca di bawah lampu atau matahari langsung
- Webcam murah berfokus tetap, jadi jarak kartu harus pas
- Selisih 50 ms vs 400 ms per siswa terasa nyata saat antre 300 orang

Rancangan ini tidak memaksa Anda memilih sekarang: **kembangkan dulu dengan webcam, ganti ke scanner serial saat mau produksi tanpa mengubah backend sama sekali.**

---

### 3.5 Multi-scanner di 1 PC (untuk produksi)

Ini bagian paling menentukan untuk produksi. Barcode scanner USB standar berjalan sebagai **keyboard**: ia "mengetik" isi barcode ke jendela yang sedang fokus. Kalau tiga scanner dipasang sekaligus, **ketiganya mengetik ke tempat yang sama dan tidak bisa dibedakan asalnya**.

#### Solusi: mode USB Virtual COM Port

Hampir semua scanner mid-range bisa diubah ke mode **Virtual COM Port** dengan memindai satu barcode konfigurasi dari buku manualnya.

- Tiap scanner muncul sebagai port terpisah: `COM3`, `COM4`, `COM5` (Windows) atau `/dev/ttyACM0..2` (Linux)
- **Scanner Agent** membuka semua port sekaligus dengan `serialport` → tahu persis scan dari gerbang mana
- Tidak bergantung jendela fokus — operator bebas membuka aplikasi lain
- Jalan sebagai Windows Service / systemd, otomatis start saat PC dinyalakan
- Kalau internet mati, scan ditampung antrean lokal dan dikirim ulang otomatis

#### Pemetaan scanner diatur dari aplikasi, bukan dari config

Agent **tidak** menyimpan daftar scanner. Isi `config.json` hanya secukupnya untuk menyambung ke server:

```jsonc
// C:\SIKLON\config.json — cukup segini, tidak pernah diubah lagi
{
  "apiUrl": "https://presensi.sekolahku.sch.id",
  "apiKey": "····"
}
```

Sisanya dikerjakan lewat halaman **Scanner** di aplikasi:

1. Saat start, agent memindai semua port serial yang ada (`SerialPort.list()`) dan melaporkannya ke server — lengkap dengan merek, nomor seri, dan `VID:PID` tiap perangkat.
2. Halaman Scanner menampilkan port yang terdeteksi, termasuk yang belum diberi nama.
3. Admin menetapkan kode, label, dan arah untuk tiap scanner, lalu simpan.
4. Server mengirim pemetaan baru ke agent lewat WebSocket — **agent langsung menerapkannya tanpa perlu di-restart**.

Pemetaan disimpan di `settings` dengan key `scanners`:

```json
[
  { "id": "SN:A1B2C3D4", "tipe": "SERIAL", "kode": "GATE-A",  "label": "Gerbang Utama",   "aktif": true },
  { "id": "USB:1-4.2",   "tipe": "SERIAL", "kode": "GATE-B",  "label": "Gerbang Samping", "aktif": true },
  { "id": "CAM:9c1f…",   "tipe": "KAMERA", "kode": "CAM-DEV", "label": "Webcam Laptop",   "aktif": true }
]
```

`tipe` membedakan sumbernya: entri `SERIAL` dibuka oleh Scanner Agent lewat port serial, entri `KAMERA` dipilih di browser lewat `deviceId` dari `enumerateDevices()`. Keduanya menghasilkan `device_code` yang sama bentuknya di tabel `attendance`.

#### Fitur "Kenali Scanner" — cara tahu scanner fisik mana yang mana

Masalah nyata di lapangan: tiga port muncul sebagai `COM3`, `COM4`, `COM5`, tapi **tidak ada yang tahu scanner di gerbang mana yang jadi COM3**. Menebak berarti bongkar-pasang kabel satu per satu.

Solusinya satu tombol di halaman Scanner:

1. Admin klik **Kenali Scanner** → sistem masuk mode identifikasi selama 60 detik
2. Petugas menempelkan barcode apa saja — kartu siswa mana pun — di scanner yang ingin diberi nama
3. Layar **langsung menyorot baris port yang barusan dipakai**
4. Admin mengisi kode dan labelnya, lalu simpan
5. Ulangi untuk scanner berikutnya

Selama mode ini aktif, scan tidak dicatat sebagai presensi.

#### Kenapa dipetakan lewat nomor seri, bukan nomor COM

Nomor COM di Windows **bisa berubah sendiri** kalau scanner dicabut-pasang atau dipindah colokan USB. Kalau pemetaan dikunci ke `COM3`, suatu pagi presensi bisa tercatat dari gerbang yang salah tanpa ada yang sadar.

Karena itu kunci pemetaan memakai pengenal yang stabil, berurutan sesuai ketersediaan:

| Prioritas | Kunci | Stabil terhadap |
|---|---|---|
| 1 | `SN:<nomor seri USB>` | Pindah colokan, ganti PC, restart |
| 2 | `USB:<lokasi port fisik>` | Restart dan cabut-pasang, **selama colokannya tidak dipindah** |
| 3 | `PORT:COM3` | Hanya restart — pilihan terakhir |

Nomor COM tetap ditampilkan di layar sebagai informasi, tapi bukan itu yang dipakai mencocokkan. Scanner yang tidak punya nomor seri diberi tanda peringatan di halaman Scanner: *"perangkat ini tidak punya nomor seri — jangan pindahkan colokan USB-nya"*.

> **Sebelum membeli banyak scanner, beli 1 unit dan uji mode Virtual COM dulu.** Ini asumsi teknis paling berisiko dalam seluruh rencana. Pastikan spesifikasi mencantumkan *"USB Virtual COM / RS232 emulation"*, dan kalau bisa pilih model yang melaporkan nomor seri USB.

#### Cadangan bila mode COM tidak tersedia

Programkan prefix berbeda pada tiap scanner (`~A`, `~B`, `~C`), lalu halaman Konsol Scan membaca semua ketikan lewat listener `keydown` dan mem-parse prefiksnya. Kelemahannya: jendela browser harus selalu fokus. Cocok untuk 1–2 scanner.

---

## 4. Notifikasi WhatsApp Gratis

| Opsi | Biaya | Resmi | Catatan |
|---|---|---|---|
| **Baileys** | **Gratis** | Tidak | WebSocket langsung, ringan, tanpa browser. Nomor berisiko diblokir Meta |
| WAHA (self-host) | Gratis | Tidak | Pembungkus HTTP di atas Baileys, lebih gampang dipakai |
| whatsapp-web.js | Gratis | Tidak | Butuh Chromium, boros RAM |
| WhatsApp Cloud API | Berbayar per pesan | Ya | Aman dari blokir, perlu verifikasi bisnis |
| Telegram Bot | Gratis penuh | Ya | Cadangan yang layak |

**Pilihan: Baileys**, dibungkus antarmuka sederhana supaya bisa ditukar tanpa mengubah kode aplikasi.

```ts
export interface WaProvider {
  isReady(): Promise<boolean>;
  send(phone: string, message: string): Promise<
    { ok: true; id: string } | { ok: false; error: string }
  >;
}
```

### Siapa pengirimnya, dan ke nomor siapa

Dua hal yang wajib jelas sebelum notifikasi dinyalakan:

| | Jawaban |
|---|---|
| **Penerima** | Kolom `students.guardian_phone` — nomor wali murid yang diinput admin atau diimpor dari Excel |
| **Pengirim** | Nomor HP yang **men-scan QR pairing**. Baileys bekerja sebagai perangkat WhatsApp Web, jadi pesan keluar dari akun WhatsApp itu |

Konsekuensi yang sering terlewat: kalau saat uji coba QR-nya di-scan pakai **WhatsApp pribadi**, pesan keluar dari nomor pribadi tersebut. Bila ada penerima yang melaporkannya sebagai spam, yang diblokir Meta adalah nomor pribadi itu — bukan nomor sekolah. **Siapkan nomor khusus sekolah sejak hari pertama uji coba, jangan menunggu produksi.**

### Tiga pengaman agar tidak ada pesan tak sengaja terkirim

Data contoh berisi nomor karangan yang formatnya valid dan prefiksnya nyata (0812, 0856) — besar kemungkinan nomor itu milik orang lain. Satu klik salah bisa mengirimi orang asing pesan *"Ananda Andi Pratama telah HADIR di sekolah"*. Karena itu sistem dirancang **mati secara default**, dan perlu tiga langkah sengaja untuk menyalakannya:

1. **`WA_PROVIDER` di environment adalah pengaman keras.** Nilai `dummy` mengalahkan setelan apa pun di database — salah setel di halaman Pengaturan tidak bisa membuat server development tiba-tiba mengirim.
2. **`WA_ALLOWLIST`** membatasi penerima saat `NODE_ENV` bukan production. Daftar kosong berarti pengiriman **ditolak**, bukan diteruskan ke semua orang. Mustahil membanjiri 600 wali murid karena salah klik saat uji coba.
3. **`students.notify`** default `false` pada data contoh, dan `settings.whatsapp.aktif` default `false`.

Urutan menyalakannya:

```
1. Masukkan nomor wali murid yang sebenarnya (import Excel)
2. Siapkan nomor khusus sekolah, pasang lewat QR pairing
3. Isi WA_ALLOWLIST dengan nomor Anda sendiri, uji kirim
4. WA_PROVIDER=baileys, settings.whatsapp.aktif = true
5. Nyalakan bertahap per tingkat kelas (lihat tabel pemanasan di atas)
```

### Menjaga nomor tidak diblokir

Ini risiko nyata, bukan teori. Yang wajib dilakukan:

1. **Nomor khusus**, bukan nomor pribadi. Nomor baru "dipanaskan" 1–2 minggu sebelum dipakai kirim massal.
2. **Jeda acak 3–8 detik** antar pesan. Antrean menangani ini otomatis.
3. **Isi pesan bervariasi** — nama siswa dan jam berbeda-beda, jangan 500 pesan identik.
4. **Minta wali murid menyimpan nomor sekolah** saat sosialisasi awal tahun. Ini penurun risiko terbesar.
5. **Jam tenang** 18:30–06:00 dan batas 2.000 pesan/hari.
6. **Opt-out**: wali membalas `BERHENTI` → kolom `students.notify` jadi `false` untuk **semua**
   anak dengan nomor itu. Kalau hanya satu baris yang dimatikan, wali yang sudah minta berhenti
   tetap menerima pesan tentang anaknya yang lain — dan itu jalan tercepat menuju laporan spam.
7. **Bertahap**: minggu pertama satu tingkat dulu, baru ditambah.

### Berapa pesan untuk 600 siswa?

Perhitungan untuk **600 siswa** dengan notifikasi absen masuk saja, asumsi 6% terlambat dan 4% alpa:

| Kejadian yang dinotifikasi | Pesan/hari | Pesan/bulan | Ekor antrean |
|---|---:|---:|---:|
| Hadir + terlambat + alpa | 600 | 13.200 | ± 13 menit |
| **Hanya terlambat + alpa** | **60** | **1.320** | **< 3 menit** |

Angka "ekor antrean" perlu dijelaskan. Dengan jeda aman 3–8 detik, pengiriman hanya mampu **±11 pesan/menit**. Siswa datang menumpuk di 20 menit terakhir sebelum bel — sekitar 18 orang/menit — jadi antrean sempat menumpuk dan baru habis **±13 menit** setelah siswa terakhir scan. Orang tua yang anaknya datang mepet baru menerima pesan sekitar pukul 07.23. Masih wajar, tapi bukan real-time.

> **Kenapa notifikasi pulang mati secara bawaan.** Absen pulang kini DICATAT (sejak 10 September 2026), tapi kejadian `PULANG` sengaja tidak ikut di `kirim_saat`. Alasannya murni antrean: absen pulang menghasilkan 600 pesan yang tercipta **serentak dalam 10 menit** saat bel pulang, dan dengan jeda anti-blokir 3–8 detik antreannya baru habis 55 menit kemudian — pesan "ananda sudah pulang" yang tiba pukul 15.55 sudah tidak ada gunanya. Mencatat pulang tidak menimbulkan biaya apa pun; yang mahal cuma menotifikasinya. Sekolah yang tetap menghendakinya tinggal menyalakan `PULANG` di halaman WhatsApp → Pengaturan Kirim.

#### Jawabannya: 600 siswa aman, asalkan nomornya dipanaskan dulu

Notifikasi **"ananda sudah sampai di sekolah" adalah inti layanan ini**, bukan pelengkap yang boleh dimatikan demi menghemat pesan. Jadi `MASUK` wajib aktif, dan 600 pesan/hari itulah beban normalnya.

600 pesan/hari dari nomor Baileys **masih di zona wajar**. Yang berbahaya bukan angka totalnya, tapi nomor baru yang tiba-tiba mengirim ratusan pesan di hari pertama. Karena itu naikkan cakupannya bertahap:

| Minggu | Cakupan | Pesan/hari | `maks_per_hari` |
|---|---|---:|---:|
| 1 | Satu tingkat kelas (uji coba) | ± 200 | 200 |
| 2 | Dua tingkat | ± 400 | 400 |
| 3+ | Semua siswa | ± 600 | 800 |

Sinyal yang menentukan aman atau tidak justru bukan volume:

- **Orang tua menyimpan nomor sekolah.** Ini penurun risiko blokir terbesar — sosialisasikan di awal tahun ajaran, sekalian dengan formulir persetujuan.
- **Tidak ada yang melaporkan sebagai spam.** Pastikan isi pesannya jelas dari sekolah dan ada cara berhenti.
- **Isi pesan bervariasi.** Nama siswa dan jam berbeda-beda tiap pesan, jadi tidak terlihat seperti blasting identik.

#### Kalau nanti butuh lebih cepat atau lebih banyak

- **Dua nomor WhatsApp**, dibagi per tingkat kelas — volume dan ekor antrean per nomor terbelah dua. Biaya tambahan hanya satu kartu perdana.
- **WhatsApp Cloud API resmi** — tanpa risiko blokir dan jauh lebih cepat, tapi 13.200 pesan/bulan adalah biaya nyata yang harus masuk anggaran. Hitung dengan tarif Meta yang berlaku saat pengadaan.

### Hemat pesan

Volume bisa dipangkas lewat pengaturan `whatsapp.kirim_saat`. Mematikan notifikasi "hadir tepat waktu" saja sudah memangkas sekitar **47% volume** — sisanya hanya terlambat, pulang, dan tidak hadir, yang justru paling ingin diketahui orang tua.

---

## 5. Alur Presensi

```mermaid
sequenceDiagram
    participant SW as Siswa
    participant AG as Scanner Agent
    participant API as Express API
    participant DB as PostgreSQL
    participant WRK as Worker
    participant WA as WhatsApp

    SW->>AG: Scan QR (NIS) saat masuk sekolah
    AG->>AG: Cek scan ganda (60 detik)
    AG->>API: POST /scans {gate: "GATE-A", nis, waktu}
    API->>DB: Cari siswa by NIS -> kelas -> wali
    API->>DB: UPSERT attendance
    API->>DB: INSERT wa_messages (QUEUED)
    API-->>AG: {siswa, status, terlambat}
    API-->>WEB: socket "scan" -> foto & nama tampil di layar
    WRK->>WA: Kirim (jeda acak 3-8 detik)
    WRK->>DB: UPDATE status pesan
```

### Penentuan status — diatur dari halaman Pengaturan

Aturannya satu baris `settings` dengan key `presensi`:

```json
{
  "jam_masuk": "07:00",          // scan setelah jam ini dihitung TERLAMBAT
  "toleransi_menit": 10,         // kelonggaran; 0 berarti tanpa kelonggaran
  "batas_alpa": "09:00",         // belum scan sampai jam ini -> ALPA
  "hari_sekolah": [1, 2, 3, 4, 5],
  "khusus": { "1": { "jam_masuk": "06:45" } }   // Senin upacara, masuk lebih pagi
}
```

Batas terlambat = `jam_masuk + toleransi_menit`. Dengan nilai di atas batasnya **07:10**:

| Jam scan | Status |
|---|---|
| 06:55 | `HADIR` |
| 07:08 | `HADIR` — masih dalam toleransi |
| 07:11 | `TERLAMBAT` 1 menit |
| 07:22 | `TERLAMBAT` 12 menit |
| belum scan sampai 09:00 | `ALPA` + kirim WA |
| 07:25, padahal sudah scan tadi | diabaikan — scan pertama yang menang |

Di luar `hari_sekolah` dan pada tanggal yang ada di tabel `holidays`, scan ditolak halus dan tidak dihitung. Siswa yang sudah ditandai `IZIN`/`SAKIT` oleh admin tidak berubah statusnya meski ikut scan.

Semua nilai ini diubah lewat halaman **Pengaturan** — tidak perlu migrasi database.

### Saat internet mati

Agent menyimpan scan ke antrean lokal, layar menampilkan `OFFLINE • 23 antrean`, lalu mengirim ulang tiap 15 detik. Kombinasi `(nis, tanggal)` yang unik di database membuat pengiriman ulang aman — tidak ada data ganda.

---

## 6. Halaman & Fitur

| Halaman | Isi |
|---|---|
| **Login** | Username + password |
| **Dashboard** | Ringkasan hari ini, tren kehadiran, kelas dengan kehadiran terendah |
| **Konsol Scan** | Layar real-time: foto siswa, nama, kelas, status, status kirim WA. Ada input manual bila kartu tertinggal |
| **Siswa** | Daftar + cari + filter kelas, tambah/edit, import Excel, cetak QR massal (PDF) |
| **Kelas** | Daftar kelas, wali kelas, jumlah siswa, kenaikan kelas massal |
| **Wali Murid** | Daftar wali, nomor WA, status notifikasi, satu wali bisa punya beberapa anak |
| **Tahun Ajaran** | Daftar, tandai yang aktif |
| **Presensi Harian** | Tabel per kelas per tanggal; di sini admin mengubah status jadi IZIN/SAKIT + catatan |
| **Laporan** | Harian & bulanan, per siswa dan per kelas, export |
| **Scanner** | Port yang terdeteksi, tombol **Kenali Scanner**, penamaan & arah tiap scanner, status online |
| **WhatsApp** | Status koneksi (scan QR pairing), template pesan, log kirim, kirim ulang yang gagal |
| **Pengaturan** | **Jam masuk & batas terlambat**, batas alpa, jam pulang, hari sekolah, hari libur, tahun ajaran, identitas sekolah |
| **Pengguna** | *(khusus Super Admin)* buat & nonaktifkan akun admin |

---

## 7. Database

**8 tabel.** Detail lengkap ada di [DATABASE.md](DATABASE.md); DDL di [`database/schema.sql`](../database/schema.sql).

| Tabel | Isi |
|---|---|
| `users` | Login. Kolom `role`: `SUPER_ADMIN` atau `ADMIN` |
| `academic_years` | Tahun ajaran, satu yang aktif |
| `classes` | Kelas, wali kelas disimpan sebagai nama |
| `students` | Siswa. **`nis` = isi QR code**, plus nama & nomor wali murid |
| `attendance` | **Satu baris per siswa per tanggal** — sumber semua laporan |
| `wa_messages` | Antrean & log WhatsApp |
| `holidays` | Tanggal libur |
| `settings` | JSONB: aturan jam masuk, pemetaan scanner, template WA |

Empat hal yang membuat struktur ini tetap benar meski ringkas:

- `UNIQUE (student_id, attendance_date)` — mustahil ada dua baris presensi untuk hari yang sama
- `attendance.class_id` disalin saat absen — laporan tahun lalu tetap benar setelah siswa naik kelas
- `settings` berbentuk JSONB — mengubah jam masuk atau menambah pengaturan baru tidak perlu migrasi database
- Nomor wali disimpan **ternormalkan** ke E.164. Karena nomor kini tersimpan per siswa, kakak-adik punya nomor yang sama di dua baris — dan opt-out "BERHENTI" mematikan notifikasi di **semua** baris dengan nomor itu, bukan satu saja

---

## 8. API

Base URL `/api/v1`, JSON, autentikasi `Authorization: Bearer <token>` (kecuali endpoint scan yang memakai `X-Api-Key`).

### Scan & presensi

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/scans` | Dipanggil Scanner Agent. Body: `{gate, nis, scannedAt}` |
| POST | `/scans/batch` | Kirim antrean offline sekaligus |
| POST | `/scans/manual` | Input manual oleh admin: `{studentId, note}` |
| GET | `/attendance?date=&classId=` | Presensi satu kelas satu tanggal |
| PATCH | `/attendance/:id` | Ubah status jadi IZIN/SAKIT + `note` |

Contoh respons `POST /scans`:

```json
{
  "ok": true,
  "siswa": { "nis": "2026071", "nama": "Andi Pratama", "kelas": "VII-A", "foto": "/api/v1/students/…/photo" },
  "status": "TERLAMBAT",
  "terlambatMenit": 12,
  "jam": "07:22",
  "waDiantrekan": true
}
```

Kode error: `NIS_TIDAK_DITEMUKAN`, `SISWA_NONAKTIF`, `SCAN_GANDA`, `HARI_LIBUR`, `SUDAH_IZIN`.

### Scanner

Endpoint agent memakai `X-Api-Key`; sisanya memakai JWT.

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/agent/hello` | Agent melaporkan port terdeteksi; server membalas pemetaan yang berlaku |
| GET | `/scanners` | Daftar pemetaan + port terdeteksi + status online |
| PUT | `/scanners` | Simpan pemetaan (kode, label, arah, aktif) |
| POST | `/scanners/identify` | Mulai mode identifikasi 60 detik |

Contoh laporan agent:

```json
POST /agent/hello
{
  "agentVersion": "1.0.3",
  "ports": [
    { "path": "COM3", "serialNumber": "A1B2C3D4", "vendorId": "1eab", "productId": "1d09",
      "manufacturer": "Netum", "locationId": "1-4.1" },
    { "path": "COM4", "serialNumber": null, "vendorId": "1eab", "productId": "1d09",
      "manufacturer": "Netum", "locationId": "1-4.2" }
  ]
}
```

Server membalas dengan daftar port yang harus dibuka beserta kodenya. Kalau admin mengubah pemetaan, perubahan didorong lewat event `scanner:config` — agent menutup port lama dan membuka yang baru tanpa restart.

### Master data

```
GET|POST  /students     GET|PATCH|DELETE /students/:id
POST      /students/import        (unggah .xlsx)
POST      /students/print-qr      (PDF kartu QR massal)
GET|POST  /classes      GET|PATCH|DELETE /classes/:id
POST      /classes/promote        (kenaikan kelas massal)
GET|POST  /academic-years
GET|PUT   /settings     GET|POST|DELETE /holidays
```

### Laporan

| Endpoint | Keterangan |
|---|---|
| `GET /reports/daily?date=&classId=` | Harian per kelas |
| `GET /reports/daily-summary?date=` | Rekap semua kelas |
| `GET /reports/monthly/class?month=&classId=` | Matriks siswa × tanggal |
| `GET /reports/monthly/student?month=&studentId=` | Kalender + persentase |
| `GET /reports/export?...&format=xlsx\|pdf` | Unduh file |

### WhatsApp & pengguna

```
GET  /wa/status      POST /wa/connect      POST /wa/disconnect
GET  /wa/messages    POST /wa/messages/:id/retry     POST /wa/test
GET|POST /users      PATCH|DELETE /users/:id         (khusus Super Admin)
```

### Socket.IO

| Event | Arah | Isi |
|---|---|---|
| `scan` | server → web | Hasil scan lengkap untuk Konsol Scan |
| `wa` | server → web | `{studentId, status}` — memperbarui ikon centang di layar |
| `scanner:ports` | server → web | Daftar port terdeteksi + status online tiap scanner |
| `scanner:identify` | server → web | `{portPath}` — port yang barusan dipakai saat mode identifikasi |
| `scanner:config` | server → agent | Pemetaan baru; agent menerapkannya tanpa restart |

---

## 9. Login & Hak Akses

### Mekanisme

- Password di-hash **Argon2id**
- **JWT** umur 12 jam di cookie `httpOnly; Secure; SameSite=Lax`
- Token membawa `token_version`. Menaikkan `users.token_version` langsung membatalkan semua token lama — dipakai untuk ganti password dan "keluar dari semua perangkat", **tanpa perlu tabel session**
- Rate limit login: 5 percobaan gagal / 15 menit, lalu kunci 15 menit
- Scanner Agent memakai `X-Api-Key` dari environment variable, bukan JWT

### Dua peran

| | **Super Admin** | **Admin** |
|---|---|---|
| Semua fitur operasional | ✅ | ✅ |
| Halaman **Pengguna** — buat & nonaktifkan akun admin | ✅ | — |

Aturan tambahan:

1. Akun yang dibuat lewat web **selalu** berperan Admin. Menambah Super Admin hanya lewat CLI server (`pnpm --filter api user:promote <username>`) supaya tidak ada eskalasi hak akses lewat web.
2. Sistem menolak menonaktifkan Super Admin terakhir yang tersisa.

```ts
// apps/api/src/middlewares/auth.ts
export const requireSuperAdmin = (req, res, next) =>
  req.user.role === 'SUPER_ADMIN'
    ? next()
    : res.status(403).json({ ok: false, error: 'Hanya Super Admin yang dapat mengakses fitur ini' });
```

Pengecekan dilakukan di API, bukan sekadar menyembunyikan menu di frontend.

---

## 10. Laporan

### Harian per kelas

```
Kelas VII-A — Selasa, 8 September 2026     Hadir 28 | Terlambat 3 | Izin 1 | Sakit 2 | Alpa 1

No  NIS      Nama              Masuk   Status      Telat  WA
1   2026071  Andi Pratama      07:22   TERLAMBAT   12 m   terkirim
2   2026072  Bunga Lestari     06:51   HADIR       —      —
3   2026073  Citra Dewi        —       SAKIT       —      —
4   2026074  Dimas Anggara     —       ALPA        —      gagal
```

Di halaman ini juga admin mengubah status siswa jadi IZIN/SAKIT.

### Harian seluruh sekolah

Satu tabel berisi semua kelas dengan jumlah per status dan persentase kehadiran.

### Bulanan per kelas

```
Kelas VII-A — September 2026
                      1  2  3  4  7  8  9 10 ...      H   T   I   S   A    %
Andi Pratama          H  H  I  A  H  T  H  H ...      18   2   1   0   1  90,9
Bunga Lestari         H  H  H  H  H  H  H  H ...      22   0   0   0   0  100
Citra Dewi            S  S  H  H  H  H  H  A ...      19   0   0   2   1  86,4
```

### Bulanan per siswa

Kalender bulan berjalan yang diwarnai per status, ringkasan jumlah tiap status, persentase kehadiran, rata-rata jam kedatangan, total menit terlambat, dan tombol kirim rekap ke wali murid lewat WA.

### Teknis

- Agregasi memakai `COUNT(*) FILTER (WHERE …)` dan `generate_series` — cepat tanpa loop di aplikasi
- Export Excel: `exceljs`. Export PDF: `pdfmake`, lengkap dengan kop sekolah dan tempat tanda tangan
- View `v_rekap_harian_kelas` dan `v_rekap_bulanan_siswa` sudah menyiapkan angkanya

---

## 11. Job Terjadwal

Dijalankan worker pg-boss, zona waktu `Asia/Jakarta`:

| Waktu | Job |
|---|---|
| `batas_alpa` (default 09:00) | Siswa tanpa scan & tanpa izin → `ALPA` + antrekan WA "belum tercatat hadir" |
| tiap 1 menit | Kirim antrean WA dengan jeda acak |
| tiap 5 menit | Coba ulang pesan gagal (maksimal 3×) |
| 15:30 | Tutup hari (kunci data), kirim rekap harian ke wali kelas |
| Sabtu 07:00 | Rekap mingguan ke wali murid — menggantikan notifikasi harian "hadir" & "pulang" |
| Tanggal 1, 06:00 | Rekap bulanan (opsional dikirim ke wali murid) |
| 02:00 | `pg_dump` + kompres, simpan 30 hari terakhir |

---

## 12. Struktur Proyek & Deployment

```
siklon/
├─ apps/
│  ├─ api/                    # Express
│  │  └─ src/
│  │     ├─ modules/          # auth, students, classes, akademik,
│  │     │                    # attendance, reports, whatsapp, settings, users
│  │     ├─ jobs/             # cron pg-boss
│  │     ├─ realtime/         # Socket.IO
│  │     └─ middlewares/
│  ├─ web/                    # Next.js App Router
│  └─ scanner-agent/          # service di PC gerbang
├─ database/{schema.sql,seed.sql}
├─ docs/
├─ mockup/index.html
└─ docker-compose.yml
```

### Deployment

**VPS (disarankan)** — bisa diakses dari mana saja, backup lebih mudah. Scanner Agent tetap di PC gerbang dan mengirim lewat HTTPS.
**Server di sekolah** — tanpa biaya bulanan, tapi butuh UPS dan backup ke cloud.

**PostgreSQL dipasang langsung di mesin, bukan di dalam Docker.** Datanya jadi lebih mudah
di-backup, di-inspeksi dengan psql/pgAdmin, dan tidak ikut hilang saat container dibongkar-pasang.

```
Host     : localhost
Port     : 5432
Database : absen
User     : postgres

DATABASE_URL="postgresql://postgres:123123@localhost:5432/absen"
```

Container hanya untuk aplikasi, menyambung ke PostgreSQL host:

```yaml
services:
  api:
    build: ./apps/api
    environment:
      # host.docker.internal agar container bisa menjangkau PostgreSQL di mesin host
      DATABASE_URL: postgresql://postgres:123123@host.docker.internal:5432/absen
      TZ: Asia/Jakarta
    extra_hosts: ["host.docker.internal:host-gateway"]   # wajib di Linux
    volumes: ["./storage:/app/storage"]                  # sesi WA & foto siswa, WAJIB persisten
  worker:
    build: ./apps/api
    command: node dist/worker.js
    extra_hosts: ["host.docker.internal:host-gateway"]
  web:
    build: ./apps/web
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]      # HTTPS otomatis via Let's Encrypt
```

Saat development, API dijalankan langsung dengan `pnpm dev` tanpa container sama sekali —
cukup `localhost:5432`.

> Volume `wa-session` harus persisten. Kalau hilang, sesi WhatsApp putus dan admin harus scan QR pairing ulang.

### Memasang Scanner Agent

1. Ubah mode tiap scanner ke *USB Virtual COM Port* (scan barcode setup dari manual)
2. Isi `config.json` — cukup `apiUrl` dan `apiKey`
3. Windows: jalankan `install-service.bat`. Linux: unit systemd
4. Buka halaman **Scanner** di aplikasi; port yang terdeteksi langsung muncul
5. Klik **Kenali Scanner**, tempelkan barcode di scanner yang ingin dinamai, lalu isi kode & labelnya. Ulangi untuk tiap scanner
6. Buka Konsol Scan di browser mode fullscreen untuk layar operator

Tidak perlu mencatat nomor COM sama sekali — itu urusan agent.

---

## 13. Keamanan

Data siswa dan nomor telepon orang tua termasuk data pribadi menurut UU PDP No. 27/2022.

| Aspek | Tindakan |
|---|---|
| Enkripsi | HTTPS wajib (Caddy + Let's Encrypt) |
| Password | Argon2id, tidak pernah masuk log |
| Foto siswa | Disimpan di luar webroot, diakses lewat endpoint ber-otorisasi |
| Nomor WA | Ditampilkan tersamar `0812****7890` di layar yang tidak perlu nomor penuh |
| Input | Divalidasi Zod di setiap endpoint; Prisma memakai query parameter (aman dari SQL injection) |
| Rate limit | Login dan endpoint scan |
| Backup | `pg_dump` harian, disimpan di lokasi terpisah |
| Persetujuan | Formulir persetujuan wali murid untuk notifikasi WA di awal tahun ajaran |

**Soal QR berisi NIS:** karena NIS bisa ditebak, seseorang secara teknis bisa mencetak QR siswa lain. Penangkalnya: foto siswa tampil besar di layar operator setiap scan, dan laporan menandai dua scan berbeda dalam < 2 detik dari gerbang yang sama. Kalau kelak jadi masalah nyata, menambah kolom `qr_token` pada tabel `students` sudah cukup untuk menutupnya.

---

## 14. Roadmap

Asumsi 1 developer full-stack, ±30 jam/minggu.

| Fase | Isi | Durasi |
|---|---|:--:|
| **0. Persiapan** | Monorepo, Docker, Prisma, migrasi database | 1 mgg |
| **1. Login & Master Data** | Login 2 peran, CRUD siswa/kelas/wali/tahun ajaran, import Excel | 2 mgg |
| **2. Mesin Presensi** | Scanner Agent, endpoint scan, penentuan status, konsol real-time, cetak QR | 2 mgg |
| **3. WhatsApp** | Baileys, antrean, template, log, rate limit | 1,5 mgg |
| **4. Laporan** | Harian & bulanan, per siswa & per kelas, export Excel/PDF | 2 mgg |
| **5. Job & Dashboard** | Job ALPA, rekap, backup, dashboard | 1 mgg |
| **6. Uji Coba** | Pilot 2 kelas, perbaikan, panduan operator, pelatihan | 1,5 mgg |
| **7. Go-Live** | Deploy, cetak kartu, sosialisasi wali murid | 1 mgg |
| | **Total** | **± 12 minggu (3 bulan)** |

**Bisa dipakai paling cepat setelah Fase 4 — sekitar 8,5 minggu.**

---

## 15. Risiko

| Risiko | Mitigasi |
|---|---|
| Nomor WA diblokir Meta | Rate limit, nomor khusus, pemanasan, sosialisasi simpan nomor; siapkan Telegram/Cloud API sebagai cadangan |
| Sesi WhatsApp putus | Volume sesi persisten, halaman pairing ulang, notifikasi ke admin saat terputus |
| Scanner tidak mendukung mode COM | **Uji 1 unit sebelum membeli banyak**; cadangan prefix keyboard-wedge |
| Antrean panjang saat jam masuk | 3 jalur scanner, debounce, uji beban sebelum go-live |
| Titip absen (QR = NIS) | Foto siswa tampil saat scan, laporan anomali |
| Internet atau listrik mati | Antrean offline di agent, UPS di PC gerbang |
| Nomor WA wali salah | Verifikasi di awal, laporan "nomor bermasalah" mingguan |

---

## 16. Perangkat Keras & Biaya

### Perangkat keras

| Item | Perkiraan |
|---|---|
| Barcode/QR scanner mendukung Virtual COM (3 unit) | Rp 350.000 – 600.000 /unit |
| PC gerbang (i3 / N100, RAM 8GB, SSD) | Rp 3.500.000 – 5.000.000 |
| Monitor 21" untuk operator | Rp 1.000.000 |
| USB hub bertenaga (bila scanner > 3) | Rp 150.000 |
| UPS 650VA | Rp 700.000 |
| Cetak kartu | Kertas + laminating: murah. Printer PVC: Rp 6.000.000+ |

Untuk QR (2D), pastikan scannernya **2D image scanner** — scanner laser 1D tidak bisa membaca QR.

### Biaya berjalan

| Item | Per bulan |
|---|---|
| VPS 2 vCPU / 4GB / 80GB | Rp 120.000 – 200.000 |
| Domain `.sch.id` | ± Rp 5.000 |
| SSL (Let's Encrypt) | Rp 0 |
| Nomor WhatsApp khusus | Rp 50.000 |
| WhatsApp via Baileys | **Rp 0** |
| **Total** | **± Rp 175.000 – 255.000** |

Harga di atas perkiraan pasar Indonesia dan perlu dicek ulang saat pengadaan.

---

## Langkah Berikutnya

1. Sepakati dokumen ini
2. **Beli 1 scanner dan uji mode USB Virtual COM Port** — asumsi paling berisiko
3. Siapkan data siswa, kelas, dan nomor WA wali dalam Excel
4. Tentukan deployment: VPS atau server sekolah
5. Mulai Fase 0

Lampiran: [Mockup UI](../mockup/index.html) • [Struktur Database](DATABASE.md)
