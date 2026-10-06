# Dokumentasi Penggunaan & Deployment PresenSee

**PresenSee** (Sistem Presensi Siswa) adalah sistem presensi sekolah berbasis QR code (NIS) yang mencatat presensi masuk/pulang siswa dan secara otomatis mengirimkan **notifikasi WhatsApp ke orang tua / wali murid**.

Dokumen ini berisi panduan lengkap lokasi proyek, instalasi All-in-One PC Windows dari nol, penggunaan Docker, deployment server produksi, integrasi pembacaan scanner barcode/QR, serta panduan operasional sehari-hari.

---

## 📋 Daftar Isi
1. [📍 Lokasi & Struktur Proyek](#1-lokasi--struktur-proyek)
2. [🖥️ Panduan Lengkap Instalasi All-in-One PC Windows (Dari Nol)](#2-panduan-lengkap-instalasi-all-in-one-pc-windows-dari-nol)
3. [🐳 Menjalankan dengan Docker (Termasuk Database Otomatis)](#3-menjalankan-dengan-docker-termasuk-database-otomatis)
4. [📷 Integrasi & Pemasangan Scanner Barcode / QR di PC Gerbang](#4-integrasi--pemasangan-scanner-barcode--qr-di-pc-gerbang)
5. [🖥️ Menyiapkan Mode Layar Penuh (Kiosk Mode / Fullscreen)](#5-menyiapkan-mode-layar-penuh-kiosk-mode--fullscreen)
6. [⚙️ Menyiapkan Auto-Start Saat PC Dinyalakan (Windows Startup)](#6-menyiapkan-auto-start-saat-pc-dinyalakan-windows-startup)
7. [🚀 Panduan Deploy VPS / Server Terpisah (Opsional)](#7-panduan-deploy-vps--server-terpisah-opsional)
8. [🛠️ Operasional Sehari-Hari & Troubleshooting](#8-operasional-sehari-hari--troubleshooting)

---

## 1. 📍 Lokasi & Struktur Proyek

* **Lokasi Monorepo di Mesin**: `/home/wgipro/koding/siklon`
* **Arsitektur Stack**: Node.js monorepo (pnpm workspace) dengan Express.js, Next.js 15 (App Router), PostgreSQL 16, Prisma ORM, Socket.IO, dan Baileys WhatsApp.

### Berkas Utama untuk Pengguna Windows (1-Klik):
* 🟢 [JALANKAN-PRESENSEE.bat](file:///home/wgipro/koding/siklon/JALANKAN-PRESENSEE.bat) — Klik 2x untuk memulai database, backend, frontend, dan membuka browser otomatis.
* 🔴 [HENTIKAN-PRESENSEE.bat](file:///home/wgipro/koding/siklon/HENTIKAN-PRESENSEE.bat) — Klik 2x untuk mematikan semua layanan dengan aman.
* 🌐 [BUKA-APLIKASI.bat](file:///home/wgipro/koding/siklon/BUKA-APLIKASI.bat) — Pintasan untuk membuka tampilan PresenSee di browser.

---

## 2. 🖥️ Panduan Lengkap Instalasi All-in-One PC Windows (Dari Nol)

Skenario **All-in-One** adalah metode pemasangan paling populer untuk sekolah: **1 unit PC di gerbang sekolah** berfungsi sekaligus sebagai Server Database, Backend API, Frontend Web, tempat colok USB Scanner, dan Layar Presensi Operator.

### 📥 Langkah 1: Unduh & Install Docker Desktop di Windows

1. Buka browser di PC Windows dan unduh **Docker Desktop**:
   👉 [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Jalankan file installer `Docker Desktop Installer.exe`.
3. Saat proses instalasi, centang opsi:
   - ✅ **Use WSL 2 instead of Hyper-V (recommended)**
   - ✅ **Add shortcut to desktop**
4. Klik **Ok** dan tunggu hingga instalasi selesai.
5. Setelah selesai, **Restart PC Windows Anda**.
6. Setelah PC menyala kembali, buka aplikasi **Docker Desktop** dari Start Menu / Desktop.
7. Tunggu beberapa saat hingga ikon paus di pojok kanan bawah (system tray) menunjukkan status **Docker Desktop is running**.

⚠️ **Kalau Docker Desktop gagal menyala dan pesannya menyebut WSL** (mis. "WSL 2
installation is incomplete", update kernel WSL, atau semacamnya): pemasang Docker
Desktop **tidak selalu ikut memasang WSL2** — tergantung versi Windows dan apakah
fitur ini sudah aktif sebelumnya di PC itu. Perbaikannya:
1. Buka **PowerShell sebagai Administrator** (klik kanan Start Menu → *Windows
   Terminal (Admin)* atau *PowerShell (Admin)*).
2. Jalankan: `wsl --install`
3. **Restart PC Windows** setelah selesai.
4. Buka Docker Desktop lagi — seharusnya sudah bisa menyala normal.

8. **Supaya Docker Desktop tidak membuka jendela dashboard tiap kali menyala**
   (cukup diam di system tray, di belakang layar):
   1. Buka Docker Desktop → klik ikon gerigi (**Settings**) di kanan atas.
   2. Menu **General**.
   3. **Hilangkan centang** pada *"Open Docker Dashboard when Docker Desktop starts"*.
   4. **Apply & Restart**.

   Ini cukup diatur **sekali saja** — berlaku seterusnya setiap kali Docker Desktop
   dinyalakan, baik oleh `JALANKAN-PRESENSEE.bat`, oleh Windows saat PC dinyalakan,
   maupun diklik manual. `docker desktop start` (dipakai skrip untuk menyalakan
   otomatis, lihat bug #4 di bawah) memang sudah dirancang untuk tidak membuka
   jendela — tapi kalau PC itu jatuh ke cara cadangan (membuka `.exe` langsung),
   setelan inilah yang menentukan jendelanya muncul atau tidak.

---

### 📦 Langkah 2: Menempatkan Folder Aplikasi PresenSee

1. Salin seluruh folder paket aplikasi PresenSee ke drive PC Windows Anda (disarankan di `C:\PresenSee` atau `D:\PresenSee`).
2. Pastikan file-file berikut ada di dalam folder tersebut:
   - `JALANKAN-PRESENSEE.bat`
   - `HENTIKAN-PRESENSEE.bat`
   - `docker-compose.yml`
   - `apps/`
   - `database/`

---

### 🚀 Langkah 3: Pertama Kali Menyalakan PresenSee (1-Klik)

1. Pastikan **Docker Desktop** sudah berjalan.
2. Masuk ke folder `C:\PresenSee`.
3. **Klik 2x** pada berkas:
   ```
   JALANKAN-PRESENSEE.bat
   ```
4. Jendela Command Prompt akan muncul dan secara otomatis:
   - Mengunduh image PostgreSQL 16 resmi.
   - Membangun container Docker untuk API & Web.
   - Menginisialisasi skema database (`schema.sql`) dan data awal (`seed.sql`).
   - Menunggu service siap selama 5 detik.
   - Membuka browser default secara otomatis ke `http://localhost:3000`.

---

## 3. 🐳 Menjalankan dengan Docker (Termasuk Database Otomatis)

Semua komponen sistem PresenSee terisolasi dengan rapi di dalam Docker:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PC GERBANG (WINDOWS)                            │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      DOCKER CONTAINERS                         │   │
│   │                                                                │   │
│   │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │   │
│   │   │ presensee-db │    │ presensee-api│    │ presensee-web│     │   │
│   │   │(PostgreSQL16)│◄───│  (Express)   │◄───│  (Next.js)   │     │   │
│   │   └──────────────┘    └──────────────┘    └──────────────┘     │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Fitur Docker PresenSee:
1. **Tanpa Install PostgreSQL Manual**: Database otomatis dibuat dan diisi saat pertama kali container dijalankan.
2. **Proteksi Kode Sumber**: Menggunakan *Multi-Stage Build*. Container akhir **HANYA berisi berkas hasil build (`dist/` dan `.next/standalone`)**. Sama sekali **TIDAK membawa file source code mentah (`.ts`, `.tsx`, atau `src/`)** ke dalam PC client.
3. **Persistensi Data Aman**: Data tersimpan aman di volume Docker `postgres_data` dan folder `./apps/api/storage` (sesi WhatsApp & foto siswa).

---

### 🎁 Cara Terbaik & Paling Aman: Script Pembuat Paket Deploy (`npm run bundle:deploy`)

Telah disediakan script **Generator Paket Deploy 1-Klik**: [tools/buat-paket-deploy.mjs](file:///home/wgipro/koding/siklon/tools/buat-paket-deploy.mjs).

#### 🛠️ Cara Menggunakannya di Laptop Pengembang (Developer):
Jalankan perintah ini di terminal laptop Anda:
```bash
npm run bundle:deploy
# atau: pnpm bundle:deploy
```

#### 📦 Apa yang Dihasilkan Script Ini?
Script ini secara otomatis membuat folder `presensee/` dan **berkas `presensee.zip` siap kirim** yang berisi:
1. `presensee-images.tar` — Berkas image Docker **presensee-api & presensee-web saja** (100% TANPA KODE SUMBER `.ts`, `.tsx`, atau `src/`). `postgres:16-alpine` **sengaja TIDAK ikut dibundel** — itu image publik biasa, `docker compose up` menariknya sendiri dari Docker Hub (sekolah tetap butuh internet untuk WhatsApp, jadi ini bukan syarat baru), dan membundelnya cuma menambah ~100MB+ tanpa alasan.
2. `presensee-images.tar.sha256` — Checksum SHA256 tar di atas. `JALANKAN-PRESENSEE.bat` memverifikasi ini **sebelum** mencoba memuat image — kalau berkasnya rusak saat dikirim ke client (lihat insiden di bawah), client dapat pesan jelas "unduh ulang", bukan galat Docker yang membingungkan.
3. `docker-compose.yml` — Konfigurasi siap pakai untuk Docker Desktop client (termasuk mounting volume `./backupdb`).
4. `backupdb/` — Folder penyimpanan backup otomatis database PostgreSQL (berjalan tiap jam 09:00 WIB).
5. `JALANKAN-PRESENSEE.bat` — Script 1-klik yang otomatis memverifikasi & mengimpor `presensee-images.tar`, lalu menyalakan aplikasi.
6. `HENTIKAN-PRESENSEE.bat` & `BUKA-APLIKASI.bat`.
7. `apps/scanner-agent` — Agent pembaca scanner USB Windows.
8. `database/` — File `schema.sql` dan `seed.sql` (dengan hash password ASLI, bukan placeholder — lihat insiden di bawah).

#### 🚚 Cara Deploy ke PC Sekolah / Client:
1. Cukup **salin berkas `presensee.zip`** (atau folder `presensee/`) ke flashdisk.
2. Ekstrak ke PC Windows Sekolah (misal di `D:\presensee`).
3. Klik 2x **`JALANKAN-PRESENSEE.bat`**.
4. **Hasilnya**: PC Sekolah menerima **0% kode sumber**, langsung jalan dalam hitungan detik tanpa perlu internet atau proses build ulang (kecuali menarik `postgres:16-alpine` di kali pertama)!

#### 🐛 Empat Bug Nyata yang Ditemukan & Diperbaiki (21 September 2026)

Bug #1 dan #2 ditemukan saat menguji paket ini sungguhan di PC Windows client — **tidak
kelihatan saat diuji di mesin pengembang**, hanya muncul setelah paket benar-benar
dikirim ke PC lain. Bug #3 baru ketahuan setelah itu, saat memverifikasi ulang
seluruh alur dari nol (volume Docker benar-benar kosong) untuk memastikan bug #1
sungguh-sungguh sudah beres — dan ternyata login berhasil, tapi tabel `settings`
kosong total. Bug #4 baru ketahuan sesudah bug #1–#3 diperbaiki dan paket baru
dikirim ulang ke PC yang sama — kali ini Docker Desktop-nya sendiri yang belum
menyala saat skrip dijalankan.

**1. Login mustahil berhasil dengan password apa pun.**
`database/seed.sql` berisi hash password *placeholder* (`GANTI_DENGAN_HASH_ASLI`,
literal, bukan hash Argon2id sungguhan), dan itu ikut terbawa ke SETIAP paket
client — karena paket client hanya menjalankan `schema.sql` + `seed.sql` lewat
`docker-entrypoint-initdb.d`, TANPA seeder aplikasi (`apps/api/prisma/seed.ts`)
yang biasanya memperbaiki placeholder itu di lingkungan development. Diperbaiki
dengan menempelkan hash Argon2id ASLI (untuk password `siklon123`, parameter
sama persis dengan `apps/api/src/lib/password.ts`) langsung ke `seed.sql`.
**Ini prioritas paling tinggi** — sekalipun Docker berjalan sempurna, tanpa
perbaikan ini aplikasinya tetap 100% tidak bisa dipakai.

**2. `presensee-images.tar` rusak di jalan, muncul sebagai error yang membingungkan.**
Tar (974MB, berisi 3 image) terbukti **valid** dan berhasil di-`docker load`
di mesin pembuatnya, tapi gagal di PC client Windows dengan
`archive/tar: invalid tar header` — kerusakan terjadi saat kompresi ZIP/transfer/
ekstraksi, bukan saat dibuat. Karena `docker load` gagal, `docker compose up`
lalu diam-diam mencoba MENARIK `presensee-api` dari Docker Hub (image custom
yang memang tidak pernah ada di sana) dan gagal dengan pesan
`pull access denied ... repository does not exist` — pesan yang menuduh
"aplikasinya rusak", padahal penyebab aslinya cuma berkas yang corrupt di jalan.
Diperbaiki tiga lapis:
- Checksum SHA256 diverifikasi **sebelum** `docker load` dicoba sama sekali.
- Setelah `docker load`, kedua image (`presensee-api` & `presensee-web`)
  diverifikasi ulang lewat `docker image inspect` secara eksplisit — TIDAK
  dipercaya dari kode keluar `docker load` saja (kejadian nyata: proses itu
  bisa tampak selesai tanpa pesan galat yang jelas, padahal image-nya tetap
  tidak ada).
- `postgres:16-alpine` dikeluarkan dari tar (lihat poin di atas) — mengecilkan
  berkas yang paling rawan rusak saat transfer, sekaligus mengurangi satu
  titik gagal.

**3. Login berhasil, tapi SELURUH `settings` kosong (bukan cuma WhatsApp).**
`database/seed.sql` menulis satu komentar penjelasan ("PULANG diaktifkan atas
permintaan pemilik proyek...") **di dalam** literal JSON kunci `'whatsapp'`,
bukan sebagai komentar SQL sungguhan di luar tanda kutip. `--` di dalam string
yang di-cast ke `json` dibaca sebagai ISI JSON, bukan komentar, dan merusak
parsing-nya (`invalid input syntax for type json ... Token "-" is invalid`).
Karena `INSERT INTO settings (...) VALUES (...), (...), ...` ini SATU
pernyataan dengan enam baris, satu baris gagal berarti keenamnya gagal
sekaligus — nama sekolah, aturan jam presensi, dan seluruh template pesan
WhatsApp tidak pernah tersimpan, padahal login (bug #1) sudah beres duluan
sehingga mudah dikira "sudah selesai". Diperbaiki dengan memindahkan
komentarnya ke luar tanda kutip, sebelum tuple `('whatsapp', ...)`.
Diverifikasi ulang dari volume Docker kosong: `INSERT 0 6` untuk `settings`,
tanpa galat, dan login sungguhan lewat `curl` mengembalikan `200 OK`.

**4. `JALANKAN-PRESENSEE.bat` keliru bilang "Docker Desktop belum terpasang",
padahal ikonnya jelas ada di Desktop PC client.**
Skrip lama hanya mencari file `.exe` Docker Desktop di dua lokasi baku
(`Program Files\Docker\...` dan `Program Files (x86)\Docker\...`). Di PC client,
Docker Desktop rupanya terpasang di lokasi lain — kemungkinan besar mode instal
"tanpa admin" yang menaruhnya di `%LocalAppData%`, umum di PC dengan hak akses
terbatas. Karena skrip tidak menemukan `.exe`-nya di dua lokasi itu, ia langsung
menyimpulkan "belum terpasang" — kesimpulan yang salah, karena `docker` CLI-nya
sendiri terbukti berfungsi normal (semua percobaan lain berhasil lewat
`docker info`).
<br>✅ Diperbaiki berlapis: (1) mencoba `docker desktop start` lebih dulu —
subcommand bawaan Docker Desktop modern yang menyalakan mesinnya **tanpa perlu
tahu lokasi file `.exe`** sama sekali, selama CLI `docker` ada di PATH; (2) kalau
itu tidak dikenali (versi lama), dicoba empat lokasi `.exe`, termasuk dua folder
`%LocalAppData%` yang sebelumnya tidak dicek; (3) batas waktu tunggu 2 menit,
supaya skrip tidak menunggu selamanya kalau Docker memang tidak pernah menyala;
(4) pesan error diperbaiki — tidak lagi mengklaim "belum terpasang", melainkan
"kemungkinan besar sudah terpasang, coba buka manual sekali ini".
<br>🐛 Ditemukan sekalian saat memperbaiki ini: kode ASLI juga memakai
`%ProgramFiles(x86)%` langsung di dalam blok `if(...) else if(...) else(...)` —
tanda kurung yang jadi bagian NAMA variabel itu sendiri bisa membingungkan
pencocokan kurung blok `cmd.exe` (jebakan batch scripting yang sudah lama
dikenal). Diperbaiki dengan memindahkan nilainya ke variabel biasa (`%PF86%`)
di luar blok dulu.
<br>ℹ️ Dua hal terkait yang ditambahkan ke panduan instalasi (lihat Langkah 1 di
atas): (a) pemasang Docker Desktop **tidak selalu ikut memasang WSL2** — kalau
Docker Desktop gagal menyala dan pesannya menyebut WSL, jalankan `wsl --install`
lewat PowerShell Administrator lalu restart PC; (b) setelan
**"Open Docker Dashboard when Docker Desktop starts"** di Settings → General
menentukan apakah jendela dashboard-nya muncul tiap kali dinyalakan — dimatikan
sekali, berlaku seterusnya.

---

## 4. 📷 Integrasi & Pemasangan Scanner Barcode / QR di PC Gerbang

Agar scanner barcode 2D USB dapat berkomunikasi secara presisi dengan sistem PresenSee:

### 🔌 Langkah 1: Ubah Mode Scanner ke USB Virtual COM Port
1. Colokkan kabel USB scanner 2D ke port USB PC Windows.
2. Buka buku manual bawaan scanner fisik Anda.
3. Pindai barcode konfigurasi bertuliskan **"USB Virtual COM Port"** atau **"RS232 Emulation"**.
   *(Langkah ini mengubah scanner dari mode keyboard biasa menjadi mode port serial USB)*.

### ⚙️ Langkah 2: Pasang Scanner Agent Service di Windows
1. Buka folder `apps/scanner-agent`.
2. Salin file `config.example.json` menjadi `config.json`.
3. Buka `config.json` dengan Notepad dan pastikan isinya:
   ```json
   {
     "apiUrl": "http://localhost:5000",
     "apiKey": "presensee-scanner-api-key-2026"
   }
   ```
4. Klik kanan pada file **`install-service.bat`**, lalu pilih **Run as administrator**.
5. Layanan `PresenSee Scanner Agent` akan terpasang di Windows Service dan otomatis aktif saat PC dinyalakan.

### 🏷️ Langkah 3: Pemetaan Scanner di Dashboard Admin
1. Buka browser ke `http://localhost:3000`.
2. Login menggunakan `superadmin` / `siklon123` (wajib ganti password saat masuk pertama).
3. Masuk ke menu **Scanner**.
4. Klik tombol **Kenali Scanner**.
5. Tempelkan QR siswa ke scanner fisik yang terpasang di gerbang.
6. Berikan label gerbang (contoh: `"Gerbang Utama"` atau `"Gerbang Depan"`) lalu simpan.

---

### 🌐 Langkah 4: Menambah Komputer & Scanner Baru (PC 2 - Multi Gerbang via LAN/WiFi)

Jika sekolah ingin menambah **PC 2 (Komputer Gerbang 2)** yang terhubung ke **PC 1 (Server Utama & Gerbang 1)**:

#### ⚠️ 1. Di PC 1 (Server Utama):
- Cek IP Lokal PC 1 di Command Prompt: `ipconfig` (contoh IP PC 1: `192.168.1.100`).
- Pastikan Port `5000` (API) dan `3000` (Web) diizinkan di Windows Firewall PC 1.

#### 💻 2. Di PC 2 (Komputer Tambahan / Gerbang 2):
- **TIDAK PERLU** pasang Docker atau Database di PC 2!
- Cukup salin folder `apps/scanner-agent` dari paket deploy ke PC 2.
- Pasang Node.js 22 di PC 2.
- Buka `apps/scanner-agent/config.json` di PC 2 dan ganti `apiUrl` mengarah ke IP PC 1:
  ```json
  {
    "apiUrl": "http://192.168.1.100:5000",
    "apiKey": "presensee-scanner-api-key-2026"
  }
  ```
- Colokkan USB Scanner 2D di PC 2, scan QR setup **"USB Virtual COM Port"**.
- Klik kanan `install-service.bat` pada PC 2 -> **Run as administrator**.
- Buka browser di PC 2 ke `http://192.168.1.100:3000/scanner`, klik **Kenali Scanner**, scan QR siswa di PC 2, lalu beri nama **"Gerbang 2"**.
- Untuk tampilan layar presensi di PC 2, buka browser ke `http://192.168.1.100:3000/scan`.

---

## 5. 🖥️ Menyiapkan Mode Layar Penuh (Kiosk Mode / Fullscreen)

Untuk tampilan layar presensi siswa yang rapi di gerbang sekolah:

### Opsi A: Mode Fullscreen Browser (Paling Mudah)
1. Buka browser dan kunjungi: `http://localhost:3000/scan`
2. Tekan tombol **`F11`** di keyboard untuk masuk ke mode Layar Penuh (Fullscreen).

### Opsi B: Pintasan Kiosk Mode (Tanpa Bar Browser)
Buat file pintasan Windows (Shortcut) dengan target berikut:
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://localhost:3000/scan --app
```
Saat pintasan ini diklik, Chrome akan langsung terbuka secara fullscreen tanpa menampilkan alamat URL atau tombol browser.

---

## 6. ⚙️ Menyiapkan Auto-Start Saat PC Dinyalakan (Windows Startup)

Agar operator sekolah/satpam tidak perlu menjalankan file `.bat` secara manual di pagi hari:

1. Tekan tombol **`Win + R`** pada keyboard PC Windows.
2. Ketik `shell:startup` lalu tekan **Enter** (folder Startup Windows akan terbuka).
3. Buat Pintasan (Shortcut) dari berkas `C:\PresenSee\JALANKAN-PRESENSEE.bat` dan tempatkan di dalam folder Startup tersebut.
4. **Hasilnya**: Setiap kali PC Sekolah dinyalakan oleh petugas di pagi hari, PresenSee akan otomatis menyala di background dan browser presensi langsung terbuka!

---

## 7. 🚀 Panduan Deploy VPS / Server Terpisah (Opsional)

Jika sekolah ingin menghosting server di VPS Cloud (bisa diakses dari luar sekolah):
1. Install Docker & Docker Compose di VPS Linux Ubuntu/Debian.
2. Clone repository ke VPS dan jalankan `docker compose up -d --build`.
3. Konfigurasi Caddy / Nginx dengan SSL HTTPS gratis (Let's Encrypt).
4. Di PC Gerbang Sekolah, isi `apiUrl` pada `config.json` Scanner Agent dengan alamat HTTPS VPS (`https://presensi.sekolahku.sch.id`).

---

## 8. 🛠️ Operasional Sehari-Hari & Troubleshooting

### 📅 Alur Kerja Sehari-Hari Petugas Sekolah:
* 🌅 **Pagi Hari**: NyaIakan PC -> Aplikasi otomatis aktif (atau klik 2x `JALANKAN-PRESENSEE.bat`). Siswa siap melakukan scan QR.
* 🌆 **Sore Hari**: Klik 2x `HENTIKAN-PRESENSEE.bat` -> Shut down PC.

### ❓ Troubleshooting & Solusi Masalah Umum:

| Gejala Masalah | Penyebab | Solusi |
|---|---|---|
| `[ERROR] Docker Desktop belum berjalan` | Aplikasi Docker Desktop belum menyala | Buka **Docker Desktop** dari Start Menu, tunggu sampai ikon paus di tray aktif, lalu jalankan `JALANKAN-PRESENSEE.bat` kembali. |
| Halaman browser menampilkan `Connection Refused` | Container API/Web belum selesai booting | Tunggu 5–10 detik lalu refresh browser (`F5`). |
| Scanner fisik tidak merespon saat scan | Scanner masih dalam mode Keyboard biasa | Pindai ulang barcode **USB Virtual COM Port** pada manual book scanner. |
| Pesan WhatsApp tidak terkirim | Sesi WhatsApp terputus | Buka menu **WhatsApp** di dashboard admin (`http://localhost:3000/whatsapp`), lalu lakukan scan QR pairing ulang menggunakan HP WhatsApp sekolah. |
| Ingin reset database ke kondisi awal | Mengulang data contoh | Jalankan `docker compose down -v` lalu klik 2x `JALANKAN-PRESENSEE.bat`. |
| `[ERROR] Berkas presensee-images.tar RUSAK (checksum tidak cocok)` atau `pull access denied for presensee-api` | Berkas `presensee-images.tar` rusak saat disalin/diunduh ke PC ini (ZIP terputus, antivirus, unduhan belum selesai) — **bukan** masalah aplikasinya | Unduh ulang `presensee.zip` dari sumber asli (jangan pakai berkas yang sudah ada di PC ini), ekstrak ulang, lalu jalankan `JALANKAN-PRESENSEE.bat` lagi. |
| Login `superadmin`/`siklon123` ditolak terus, ATAU login berhasil tapi nama sekolah/template WhatsApp kosong semua | Kemungkinan memakai paket lama yang dibuat sebelum 21 September 2026 (`seed.sql` masih berisi bug hash placeholder dan/atau JSON rusak yang membuat seluruh `settings` gagal masuk) | Buat ulang paketnya dengan `npm run bundle:deploy` versi terbaru, atau jalankan `docker compose down -v` lalu nyalakan ulang supaya database dibuat ulang dari `seed.sql` yang sudah diperbaiki. |

---

> 💬 *Untuk bantuan teknis lebih lanjut, silakan merujuk pada dokumen arsitektur di [docs/PLAN.md](file:///home/wgipro/koding/siklon/docs/PLAN.md) atau [CLAUDE.md](file:///home/wgipro/koding/siklon/CLAUDE.md).*
