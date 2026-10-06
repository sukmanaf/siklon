# PresenSee — Sistem Presensi Siswa

Siswa scan QR di kartu pelajar (isi QR = **NIS**) saat masuk sekolah, sistem mencatat presensi
dan **mengirim WhatsApp ke wali murid**, lalu menyediakan **laporan per siswa dan per kelas** — harian dan bulanan.
Beberapa scanner bisa dipasang pada **satu PC**.

> Status: **dokumen perencanaan + mockup**. Belum ada kode aplikasi.

---

## Isi Repositori

| Berkas | Isi |
|---|---|
| [DOKUMENTASI.md](DOKUMENTASI.md) | **Panduan Lengkap Penggunaan, Docker, Deploy VPS/Lokal & Scanner** |
| [JALANKAN-PRESENSEE.bat](JALANKAN-PRESENSEE.bat) | 🟢 **Pintasan 1-Klik Jalankan PresenSee (Windows)** |
| [HENTIKAN-PRESENSEE.bat](HENTIKAN-PRESENSEE.bat) | 🔴 **Pintasan 1-Klik Hentikan PresenSee (Windows)** |
| [docs/PLAN.md](docs/PLAN.md) | Rencana teknis — arsitektur, multi-scanner, WhatsApp, API, roadmap, biaya |
| [docs/DATABASE.md](docs/DATABASE.md) | ERD, penjelasan 8 tabel, query inti laporan |
| [database/schema.sql](database/schema.sql) | DDL PostgreSQL — 8 tabel, 2 view |
| [database/seed.sql](database/seed.sql) | Data awal — akun, tahun ajaran, kelas, jadwal, template WA |
| [mockup/index.html](mockup/index.html) | Mockup UI 13 layar. Buka langsung di browser |
| [docs/TASKS-BACKEND.md](docs/TASKS-BACKEND.md) | **Checklist pengerjaan backend** — 77 tugas, 9 fase |
| [docs/TASKS-FRONTEND.md](docs/TASKS-FRONTEND.md) | **Checklist pengerjaan frontend** — 45 tugas, 7 fase |
| [CLAUDE.md](CLAUDE.md) | Konvensi kerja & keputusan yang sudah final |

---

## Ruang Lingkup

**Termasuk:** master data (siswa + wali murid, kelas, tahun ajaran) · konsol scan multi-titik (**absen masuk saja**) ·
notifikasi WhatsApp otomatis · laporan harian & bulanan per siswa dan per kelas · login admin.

**Tidak termasuk:** absen pulang · tabel kartu (NIS langsung jadi QR) · tabel wali murid terpisah (nomor wali langsung di baris siswa) · alur pengajuan izin (admin ubah status
langsung di laporan harian) · akun untuk guru atau wali murid · penilaian dan jadwal pelajaran.

---

## Keputusan Teknis

| Topik | Keputusan | Alasan |
|---|---|---|
| **Stack** | Next.js 15 + Express.js 5 + PostgreSQL 16 | Sesuai permintaan; TypeScript dari ujung ke ujung |
| **Sumber input** | Tiga sumber, satu endpoint: scanner serial (produksi), **webcam / kamera HP (development)**, browser HP | Bisa dikembangkan tanpa perangkat keras, lalu ganti ke scanner serial saat produksi tanpa mengubah backend |
| **Multi-scanner 1 PC** | Scanner diset ke mode **USB Virtual COM Port**, dibaca Scanner Agent (Node.js + `serialport`) | Scanner keyboard biasa tidak bisa dibedakan asalnya. Dengan mode COM, tiap scanner = satu port |
| **Pemetaan scanner** | Diatur dari halaman **Scanner** di aplikasi, bukan dari file config; dikunci ke nomor seri USB | Nomor COM di Windows bisa berubah kalau colokan dipindah. Ada tombol **Kenali Scanner** untuk tahu scanner fisik mana yang mana |
| **Isi QR** | **NIS** | Tanpa tabel kartu, tanpa generate kode. Kelemahannya (NIS bisa ditebak) ditutup dengan foto siswa yang tampil saat scan |
| **WhatsApp gratis** | **Baileys**, di balik antarmuka yang bisa ditukar | Gratis dan ringan; bisa pindah ke Cloud API resmi tanpa ubah kode |
| **Anti-blokir WA** | Antrean + jeda acak 3–8 detik, jam tenang, batas harian bertahap, opt-out | Nomor tidak resmi berisiko diblokir bila mengirim seperti spam |
| **Apa yang dinotifikasi** | Default: **hanya terlambat & alpa** (± 60 pesan/hari untuk 600 siswa) + rekap mingguan | Menambah "hadir tepat waktu" menaikkan volume jadi 600 pesan/hari — aman, tapi tunggu nomor WhatsApp matang 3–4 minggu |
| **Antrean & job** | pg-boss (broker di PostgreSQL) | Tidak perlu memasang Redis terpisah |
| **Peran** | **Super Admin** dan **Admin** | Bedanya hanya satu: Super Admin bisa membuat akun admin |
| **Session** | JWT + kolom `users.token_version` | "Keluar dari semua perangkat" jalan tanpa tabel session |
| **Jam masuk & telat** | Satu baris `settings` key `presensi` | `jam_masuk` + `toleransi_menit` = batas terlambat. Diubah dari halaman Pengaturan, tanpa migrasi database |

---

## Struktur Database (8 tabel)

```
academic_years ──< classes ──< students ──< attendance
                                  │              │
                                  └──< wa_messages

holidays        settings        users
```

| Tabel | Isi |
|---|---|
| `users` | Login. Kolom `role`: `SUPER_ADMIN` / `ADMIN` |
| `academic_years` | Tahun ajaran, satu yang aktif |
| `classes` | Kelas, wali kelas sebagai nama |
| `students` | Siswa. `nis` = isi QR code, plus nama & nomor wali murid |
| `attendance` | **Satu baris per siswa per tanggal** — sumber semua laporan. Absen masuk saja |
| `wa_messages` | Antrean & log WhatsApp |
| `holidays` | Tanggal libur |
| `settings` | JSONB: aturan jam masuk, pemetaan scanner, template WA |

---

## Catatan untuk Development

Tidak punya scanner? Pakai webcam atau kamera HP — mode ini sudah masuk rancangan
(lihat [PLAN.md §3.1](docs/PLAN.md)). Dua hal yang perlu disiapkan sejak awal:

- **Kamera hanya jalan di `localhost` atau HTTPS.** Membuka aplikasi dari HP lewat
  `http://192.168.x.x` akan gagal tanpa pesan jelas. Pakai `next dev --experimental-https`,
  `mkcert`, atau `cloudflared tunnel`.
- **`BarcodeDetector` bawaan Chrome tidak tersedia di Linux** — tulis feature detection
  dan siapkan fallback (`qr-scanner` atau `@zxing/browser`) sejak awal.

## Cara Melihat Mockup

```bash
xdg-open mockup/index.html
```

13 layar: Login, Dashboard, Konsol Scan, Siswa, Detail Siswa, Kelas, Wali Murid,
Laporan Harian, Laporan Bulanan, Scanner, WhatsApp, Pengaturan, Pengguna.
Tombol **◐** di kanan atas untuk tema terang/gelap.

## Menyiapkan Database

PostgreSQL dipasang langsung di mesin, **bukan Docker**:

```bash
createdb -h localhost -U postgres absen          # lewati bila sudah ada
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/schema.sql
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/seed.sql
```

```
DATABASE_URL="postgresql://postgres:123123@localhost:5432/absen"
```

Salin [`.env.example`](.env.example) jadi `.env`. `seed.sql` sudah membawa hash
Argon2id asli untuk password `siklon123` (akun `superadmin` & `admin`, wajib
diganti saat login pertama) — bukan lagi placeholder. Ganti hash-nya sendiri
kalau mau password default yang berbeda; jangan menulisnya manual, generate
lewat `node -e "require('@node-rs/argon2').hash('...',{memoryCost:19456,timeCost:2,parallelism:1}).then(console.log)"`
dari dalam `apps/api`.

> ✅ Skema & seed **sudah dijalankan dan terverifikasi** di PostgreSQL 16.14 — seluruh
> constraint terbukti menolak data salah, UPSERT scan ganda terabaikan, dan kedua view
> laporan mengembalikan angka yang benar.

---

## Langkah Berikutnya

Rincian pengerjaan ada di dua checklist terpisah — **[backend](docs/TASKS-BACKEND.md)** (77 tugas)
dan **[frontend](docs/TASKS-FRONTEND.md)** (45 tugas). Keduanya dicentang seiring pengerjaan,
jadi progres selalu terlihat.

Jalur tercepat sampai bisa dipakai: BE Fase 0–3 → FE Fase 0–3 → BE Fase 4 → FE Fase 4
(**scan sudah jalan dan WhatsApp sudah terkirim**), baru laporan menyusul.

Sebelum mulai koding:

1. Sepakati [docs/PLAN.md](docs/PLAN.md)
2. **Beli 1 scanner dan uji mode USB Virtual COM Port** — asumsi paling berisiko. Pastikan scanner **2D** karena membaca QR, bukan scanner laser 1D
3. Siapkan data siswa, kelas, dan nomor WA wali dalam Excel
4. Tentukan deployment: VPS atau server sekolah
5. Mulai Fase 0 (± 12 minggu sampai go-live, bisa dipakai setelah ± 8,5 minggu)
