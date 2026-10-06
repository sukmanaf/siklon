# SIKLON — Langkah Pengerjaan: Backend

**Lingkup:** `apps/api` (Express + Prisma + worker) dan `apps/scanner-agent`.
Frontend ada di [TASKS-FRONTEND.md](TASKS-FRONTEND.md).

> **Cara memakai berkas ini.** Setiap tugas punya kode (`BE-001`) dan kriteria selesai.
> Centang `- [x]` begitu tugasnya benar-benar jalan, bukan saat kodenya baru ditulis.
> Perbarui baris **Progres** dan **Terakhir diperbarui** di bawah setiap kali ada perubahan.

**Progres: 110 / 120 selesai** — Fase 0–5 dan 7 selesai, plus BE-078 … BE-119. **Fase 6 (job terjadwal) dilewati atas permintaan.**
**Terakhir diperbarui:** 1 Oktober 2026 — BE-119: `install.bat` baru (root paket Docker) jadi SATU titik masuk untuk seluruh instalasi — permintaan pemilik proyek supaya sekali jalan sudah menangani semuanya, menyamai pengalaman `install.bat` di paket native. Mengurutkan: Docker Desktop+WSL2 (`call INSTAL-DOCKER.bat`, kode keluar 2 kalau butuh restart → berhenti rapi, suruh jalankan `install.bat` lagi setelah PC nyala, BUKAN restart otomatis tanpa WSL2 baru aktif — direlaksasi dari BE-118 supaya kasus umum selesai sekali jalan tanpa restart) → data awal database (Y/N data contoh, ditentukan SEBELUM `docker compose up` pertama karena `seed.sql` cuma jalan sekali saat volume Postgres kosong, ditandai lewat marker file `database\.data-sudah-diisi`) → `call JALANKAN-PRESENSEE.bat` (nyalakan container + Scanner Agent). Scanner Agent sekarang didaftarkan OTOMATIS (bukan cuma pesan manual) kalau kebetulan dipanggil elevated (dari `install.bat`) — dicek lewat `net session`, tetap manual kalau dipanggil non-elevated (pemakaian harian lewat Startup folder) supaya tidak memicu UAC di tengah boot. Permintaan lain: Docker Desktop jangan buka jendela dashboard saat start — `docker desktop start` (jalur utama) memang sudah didesain Docker untuk itu; ditambah lapisan cadangan menulis `OpenUIOnStartupDisabled: true` ke `settings-store.json` lewat PowerShell `-EncodedCommand` (base64, bukan `-Command` quoting), **TIDAK pakai `-AsHashtable`** karena parameter itu tidak ada di Windows PowerShell 5.1 bawaan. Sebelumnya BE-118: `INSTAL-DOCKER.bat` baru (berkas terpisah dari `JALANKAN-PRESENSEE.bat`, sekali pasang saja) — memasang Docker Desktop otomatis dari installer bawaan (`data/Docker Desktop Installer.exe`, ~600MB, disalin ke `installer/` oleh `buat-paket-deploy.mjs` persis seperti Node.js/NSSM di BE-117) lewat `install --quiet --accept-license --backend=wsl-2`, mengecek dan mengaktifkan fitur Windows WSL2/VirtualMachinePlatform dulu kalau belum aktif (lewat DISM, bukan `wsl --status` yang bisa memicu wizard interaktif sendiri), lalu menanyakan Y/N di akhir kalau PC perlu restart — bukan restart paksa di tengah proses. `PANDUAN-INSTALL-WINDOWS.md` (mode Docker) diperbarui: Langkah 1 sekarang cuma "klik kanan INSTAL-DOCKER.bat" alih-alih unduh manual dari docker.com. Sebelumnya BE-117: setelah instalasi native (Node.js+PostgreSQL+NSSM tanpa Docker) berkali-kali kena bug khas Windows, pemilik proyek memutuskan kembali ke paket Docker (`tools/buat-paket-deploy.mjs`) yang sudah terbukti jalan, tapi dengan Scanner Agent-nya dibuatkan otomatis juga — sebelumnya `JALANKAN-PRESENSEE.bat` cuma menyuruh pasang Node.js/NSSM manual dari internet kalau belum ada. Installer bawaan (`data/node-*.msi`, `data/nssm-2.24/.../nssm.exe` — sama persis yang dipakai paket native) sekarang ikut disalin ke `installer/` di root paket Docker, dan `JALANKAN-PRESENSEE.bat` (kedua mode: Docker-image & bundling-JS) serta `apps/scanner-agent/install-service.bat` (dipakai BERSAMA oleh paket native dan Docker) mencoba pasang dari situ dulu sebelum jatuh ke winget/unduhan online. Ditemukan sekalian 1 bug lama di tengah jalan: ampersand mentah di baris `echo` (`"...API, & Web..."`) — cmd.exe membacanya sebagai pemisah perintah, bukan teks biasa. Sebelumnya BE-116: `npm install` `apps/api` gagal `EPERM` LAGI di client sungguhan meski folder sudah diekstrak bersih (bukan cuma sisa percobaan lama seperti dugaan BE-114) — npm sendiri mencurigai antivirus real-time yang mengunci berkas sesaat. Diberi mekanisme percobaan ulang (3x, folder `node_modules` dihapus total di antara percobaan) di `install.bat` dan pola yang sama di `apps/scanner-agent/install-service.bat` (rawan risiko serupa karena `serialport` juga modul native); kalau tetap gagal setelah 3x, pesan mengarahkan ke pengecualian folder dari Windows Defender/antivirus. Sebelumnya BE-115: dua bug lagi dari percobaan client sungguhan — (1) `apps\scanner-agent\install-service.bat` tidak pernah `npm install`, jadi `serialport` (modul native) tidak ada di PC Windows dan layanan langsung masuk restart-loop sampai nssm menandainya `SERVICE_PAUSED` — ditambahkan langkah `npm install --omit=dev` sebelum registrasi nssm, persis pola yang sama seperti `@node-rs/argon2` di apps/api; (2) `jalankan.bat` memanggil `nssm status`/`start` tanpa hak Administrator kalau dipanggil dari pintasan Startup (bukan admin), gagal "Access is denied" padahal layanannya baik-baik saja (sudah SERVICE_AUTO_START) — sekarang dicek dulu levelnya, kalau bukan admin bagian itu dilewati dengan pesan informatif, bukan ditampilkan sebagai error. Sebelumnya BE-114: dua perbaikan lanjutan dari percobaan client berikutnya — (1) `apps\api\node_modules\@siklon\shared` sisa dari percobaan gagal sebelumnya mengganjal npm saat membuat symlink baru (`EPERM`), sekarang dibersihkan otomatis sebelum `npm install`; (2) pesan "[OK] Layanan terpasang" dulu tercetak tanpa syarat, sekarang benar-benar mengecek `nssm status` kedua layanan dan mencetak "[PERINGATAN]" + lokasi log kalau belum `SERVICE_RUNNING`. Sebelumnya BE-113: akar masalah SEBENARNYA di balik "terminal `install.bat` tertutup sendiri" ditemukan lewat client sungguhan — dua pemanggilan `"%NPM_CMD%" install` di langkah [5/6] tidak pakai `call`. `npm.cmd` di Windows adalah berkas `.cmd`, bukan `.exe`; memanggil berkas `.bat`/`.cmd` dari dalam skrip `.bat` lain TANPA `call` menyerahkan kendali ke situ selamanya — begitu proses npm selesai, seluruh jendela `cmd.exe` ikut tertutup, `install.bat` tidak pernah lanjut ke NSSM/Scanner Agent. Ini persis cocok dengan laporan client: tulisan langkah [5/6] muncul, lalu jendela langsung tertutup tanpa pesan. Diperbaiki dengan menambah `call` di kedua pemanggilan (paket `shared/` dan `apps/api/`); seluruh berkas `.bat` lain sudah diperiksa ulang, tidak ada pemanggilan serupa yang kelewatan. Kemungkinan BE-112 (dugaan `goto` keluar blok kurung) tetap dipertahankan sebagai perbaikan yang sah, tapi BE-113 ini yang paling mungkin jadi penyebab utama sungguhan. Sebelumnya BE-112: perbaikan `install.bat` dari percobaan pertama sungguhan di PC Windows — terminal tertutup sendiri tanpa pesan setelah data contoh (kemungkinan besar `goto` keluar blok kurung, ditulis ulang pakai variabel penanda), log otomatis ke `install-log.txt`, urutan Node.js→NSSM→PostgreSQL, password PostgreSQL tetap (`p0stgr3sql`) bukan acak. Sebelumnya BE-111: paket deploy NATIVE (Node.js+PostgreSQL+NSSM, tanpa Docker) dibangun sebagai `presensee_build/`, terpisah total dari `presensee.zip` — bagian SQL & build diverifikasi sungguhan, tapi keempat `.bat`-nya BELUM DIUJI di Windows sungguhan (tidak bisa dari mesin Linux ini). Sebelumnya BE-110: PDF Matriks Bulanan per Kelas — kolom Nama dibatasi lebar (sebelumnya bisa melebar ratusan poin di blok tanggal yang sedikit), dan label bulan ditulis nama ("September 2026") bukan angka mentah ("2026-09") di tiga tempat. Sempat dicoba kertas F4 (terbukti tidak mengurangi jumlah halaman untuk 32 siswa/30 hari — penyebabnya baris siswa, bukan lebar kolom tanggal), dikembalikan ke A4 atas permintaan pemilik proyek. Sebelumnya BE-109: `STORAGE_PATH`/`WA_SESSION_PATH` di Docker resolve ke path yang bukan volume persisten (sesi WhatsApp & lampiran bisa hilang tiap container di-recreate) — bug lama sejak fitur foto siswa, ketahuan lewat pengujian ujung-ke-ujung BE-108, diperbaiki lewat environment variable eksplisit di `docker-compose.yml`. Sebelumnya BE-108: lampiran foto presensi (surat izin/sakit), diuji ujung-ke-ujung lewat stack Docker sekali-pakai (bukan cuma dibaca kodenya). Sebelumnya BE-107: `nssm set AppDirectory "%~dp0"` di `install-service.bat` membuat service gagal start di SEMUA PC (bukan cuma client tertentu) — `%~dp0` diakhiri backslash yang di-escape tanda kutip penutupnya, merusak argumen yang diterima nssm (`CreateProcess() failed: The directory name is invalid`, ditemukan lewat Windows Event Viewer). Ini akar masalah sesungguhnya di balik seluruh `SERVICE_STOPPED` yang dilaporkan client sepanjang sesi ini — diganti `"%~dp0."`. Sebelumnya BE-106: `nssm install` di `install-service.bat` memakai path `node.exe` yang ditebak dari lokasi baku (`%ProgramFiles%\nodejs`), bukan dicari sungguhan — kalau Node.js terpasang di lokasi lain, service-nya "berhasil" dipasang tapi mati seketika saat di-start (`SERVICE_STOPPED`). Sebelumnya BE-105: skrip PowerShell lapis-2 Node.js digabung langsung ke `install-service.bat` (base64 `-EncodedCommand`) supaya berkas itu tetap bisa ditransfer sendirian — client sempat gagal karena cuma mengirim `install-service.bat` tanpa `pasang-nodejs.ps1` pendampingnya. Sebelumnya BE-104: em dash di baris `echo` (`.bat`) tampil rusak di `cmd.exe`, diganti tanda hubung biasa. Sebelumnya BE-103: `install-service.bat` memasang Node.js otomatis (winget, lalu fallback unduhan MSI langsung dari nodejs.org) — ditemukan sendiri celah sinkronisasi berkas sumber vs. salinan terkirim ke client. Sebelumnya BE-102: `config.json` Scanner Agent diisi nilai asli langsung, bukan cuma contoh. Sebelumnya BE-101: `JALANKAN-PRESENSEE.bat` menyiapkan Scanner Agent otomatis (config.json, npm install, cek service). Sebelumnya BE-100: `npm run ports`/`build` di paket Scanner Agent client diperbaiki (menunjuk src/tsx yang tidak ikut terkirim). Sebelumnya BE-099: deteksi Docker Desktop di `JALANKAN-PRESENSEE.bat` tidak lagi bergantung lokasi instalasi baku, plus tutorial WSL2 & pengaturan tray. Sebelumnya BE-096 … BE-098: tiga bug nyata di paket deploy client ditemukan & diperbaiki (hash password placeholder, komentar SQL yang merusak seluruh `settings`, dan `presensee-images.tar` yang rusak di jalan tanpa terdeteksi) — diverifikasi ujung-ke-ujung dari volume Docker kosong sampai login sungguhan berhasil. Sebelumnya BE-093 … BE-095: laporan harian dicetak per kelas (satu kelas satu halaman), data contoh multi-kelas, dan sisa "wali kelas" yang mati dibersihkan. Sebelumnya BE-092: rangkaian uji tidak lagi gagal kalau dijalankan Sabtu/Minggu. Sebelumnya BE-091: ekspor Excel rekap sebulan per siswa (pasangan tombol di tiap baris matriks). Sebelumnya BE-090: ekspor PDF jadi hitam putih dengan orientasi per laporan (harian tegak, rekap bulanan mendatar), tanpa blok tanda tangan dan tanpa cap waktu cetak, plus PDF matriks bulanan per kelas yang sebelumnya belum ada. Sebelumnya BE-089 (rangkaian uji masuk repo, `tools/uji/`) dan BE-088 (`POST /classes/salin`).

| Fase | Tugas | Selesai | Estimasi |
|---|---|---|---|
| 0. Fondasi | BE-001 … BE-010 | **10/10 ✅** | 1 minggu |
| 1. Autentikasi | BE-011 … BE-020 | **10/10 ✅** | 1 minggu |
| 2. Master Data | BE-021 … BE-031 | **11/11 ✅** | 1,5 minggu |
| 3. Mesin Presensi | BE-032 … BE-043 | **12/12 ✅** | 1,5 minggu |
| 4. WhatsApp | BE-044 … BE-053 | **11/11 ✅** (test ditunda) | 1,5 minggu |
| 5. Laporan | BE-054 … BE-060 | **7/7 ✅** | 1 minggu |
| 6. Job Terjadwal | BE-061 … BE-066 | **0/6 — DILEWATI** | 0,5 minggu |
| 7. Scanner Agent | BE-067 … BE-073 | **7/7 ✅** | 1 minggu |
| 8. Kualitas & Rilis | BE-074 … BE-077 | 0/4 | 0,5 minggu |
| Tambahan | BE-078 … BE-119 | **42/42 ✅** | — |

---

## Fase 0 — Fondasi ✅ SELESAI

- [x] **BE-001** Inisialisasi monorepo pnpm workspace (`apps/api`, `apps/web`, `apps/scanner-agent`, `packages/shared`)
  <br>*Selesai bila:* `pnpm install` di root berhasil dan tiap workspace bisa menjalankan skripnya sendiri.
  <br>✅ `pnpm-workspace.yaml` + `packages/shared` (konstanta, skema zod setting, tipe API) + `apps/api`.
  <br>⚠️ Catatan: pnpm 11 memindahkan `onlyBuiltDependencies` ke `pnpm-workspace.yaml`, bukan `package.json` lagi.
- [x] **BE-002** Kerangka Express 5 + TypeScript, struktur `src/modules/<nama>/{controller,service,routes,schema}.ts`
  <br>✅ `src/app.ts` + `src/server.ts` + `src/routes.ts`, modul contoh `modules/health/`. Shutdown SIGTERM/SIGINT bersih (terbukti dari log).
- [x] **BE-003** Konfigurasi environment tervalidasi Zod (`src/config/env.ts`)
  <br>*Selesai bila:* aplikasi **menolak start** dengan pesan jelas bila `DATABASE_URL` atau `JWT_SECRET` kosong.
  <br>✅ Terbukti: `JWT_SECRET` pendek & `DATABASE_URL` kosong → proses berhenti dengan daftar field yang salah + saran perbaikan.
- [x] **BE-004** Logger Pino + log tiap request (metode, path, status, durasi)
  <br>✅ `pino-pretty` di dev, JSON di produksi. Field `password`, `token`, `authorization`, `cookie`, dan **`phone_wa`** disensor (data pribadi UU PDP). `/health` dikecualikan dari autologging agar log tidak banjir.
- [x] **BE-005** Error handler terpusat + bentuk respons standar
  <br>✅ Terbukti lewat test: 404 → `ROUTE_NOT_FOUND`, JSON rusak → `JSON_RUSAK` (400, bukan 500), Prisma `P2002` → `DUPLIKAT` (409), `x-powered-by` tidak dikirim.
- [x] **BE-006** Siapkan database PostgreSQL lokal `absen` di `localhost:5432` (**bukan** Docker)
  <br>✅ PostgreSQL 16.14, `.env.example` + `.env` dev.
- [x] **BE-007** Jalankan `database/schema.sql`, lalu `prisma db pull` + `prisma generate`
  <br>✅ 9 model + 3 enum terintrospeksi, Prisma Client terbukti membaca data **dan** view laporan lewat `$queryRaw`.
  <br>⚠️ Prisma 7 mengubah dua hal: URL datasource pindah ke `prisma.config.ts`, dan `.env` **tidak** dimuat otomatis (dipakai `process.loadEnvFile`). Client wajib memakai driver adapter (`@prisma/adapter-pg`).
  <br>⚠️ `pnpm add -D prisma` menarik `8.0.0-rc` karena tag `latest` menunjuk ke RC — versi dipin ke `7.10.0` agar cocok dengan `@prisma/client`.
- [x] **BE-008** Migrasi SQL manual untuk yang tidak bisa dimodelkan Prisma
  <br>✅ Diselesaikan berbeda dari rencana awal: karena `schema.sql` yang jadi sumber kebenaran, dibuat penjalan migrasi sendiri (`scripts/migrate.ts` + `database/migrations/`) dengan tabel `schema_migrations`, satu transaksi per migrasi, dan **peringatan bila migrasi yang sudah jalan diedit**. Perintah: `pnpm migrate`, `pnpm migrate:status`.
- [x] **BE-009** Seeder: hash Argon2id untuk akun awal + jalankan `database/seed.sql`
  <br>*Selesai bila:* akun `superadmin` & `admin` benar-benar bisa dipakai login (bukan hash placeholder).
  <br>✅ `prisma/seed.ts` idempoten, mendeteksi & memperbaiki hash placeholder dari `seed.sql`. Login awal: `superadmin` / `siklon123`, wajib ganti password.
  <br>⚠️ Dipakai `@node-rs/argon2` (binary prebuilt) alih-alih `argon2` yang butuh kompilasi native — lebih aman untuk deployment.
- [x] **BE-010** `GET /health` mengecek koneksi database
  <br>✅ 200 saat DB hidup, **503** saat DB mati (bukan 200 palsu). Terbukti lewat test.

### Temuan penting di Fase 0

1. **Kolom `must_change_password` dan `last_login_ip` tidak ada di skema**, padahal PLAN.md dan
   tugas FE-009 sudah menjanjikan fitur "wajib ganti password saat login pertama", dan mockup
   halaman Pengguna menampilkan IP login terakhir. Ditemukan karena seeder gagal.
   → Ditambahkan ke `schema.sql` + migrasi `001`.
2. **`packages/shared` semula menunjuk ke sumber TypeScript** (`main: src/index.ts`). Ini jalan di
   dev (tsx) tapi **build produksi pecah** begitu ada nilai runtime yang diimpor —
   `ERR_MODULE_NOT_FOUND: constants.js`. Sudah dibuktikan gagal, lalu diperbaiki: shared
   meng-emit JS + `.d.ts` ke `dist/`, dan build API menunggu shared selesai.
3. **CORS yang menolak origin semula menghasilkan 500.** Origin terlarang bukan error server —
   sekarang dijawab tanpa header CORS (browser yang memblokir) + log peringatan.
4. Test harness disiapkan lebih awal (bukan menunggu Fase 8): **8 test lolos**, termasuk test bahwa
   hash placeholder dari `seed.sql` menghasilkan `false`, bukan melempar — kalau melempar, login
   akan jadi 500 alih-alih "password salah".

## Fase 1 — Autentikasi ✅ SELESAI

- [x] **BE-011** Util hash & verifikasi password Argon2id
  <br>✅ `src/lib/password.ts`. `verifyPassword` mengembalikan `false` (bukan melempar) bila hash rusak — kalau melempar, login jadi 500 alih-alih "password salah".
- [x] **BE-012** `POST /auth/login` → JWT 12 jam di cookie httpOnly, memuat `sub`, `role`, `tokenVersion`
  <br>*Selesai bila:* password salah dan username tidak ada menghasilkan pesan yang **sama persis**.
  <br>✅ Terbukti lewat test. Cookie: `HttpOnly; SameSite=Lax; Max-Age=43200`, `Secure` otomatis di produksi.
  <br>⚠️ Ditambahkan yang tidak ada di rencana: verifikasi tetap dijalankan memakai hash palsu walau username tidak ada, supaya waktu respons mirip. Tanpa ini selisih waktu membocorkan username mana yang terdaftar (timing attack).
- [x] **BE-013** Middleware autentikasi: verifikasi JWT + cocokkan `tokenVersion` dengan database
  <br>*Selesai bila:* menaikkan `users.token_version` membuat token lama langsung ditolak 401.
  <br>✅ Terbukti lewat test: token sebelum ganti password → 401, token baru dari respons → 200. Akun nonaktif ditolak 403 walau token masih sah.
- [x] **BE-014** Middleware `requireSuperAdmin`
  <br>✅ Admin biasa → 403 dengan pesan "Hanya Super Admin…".
- [x] **BE-015** `GET /auth/me` → profil + role
- [x] **BE-016** `POST /auth/change-password` — menaikkan `token_version`, memaksa login ulang
  <br>✅ Password lama salah → 400; password baru sama dengan lama → 400. Token baru dikirim di respons agar pengguna tidak terlempar keluar.
- [x] **BE-017** `POST /auth/logout` + `POST /auth/logout-all`
- [x] **BE-018** Rate limit login: 5 percobaan gagal / 15 menit, lalu kunci 15 menit
  <br>✅ Terbukti lewat HTTP: percobaan 1–5 → 401, ke-6 → 429. **Username lain dari IP yang sama tetap bisa masuk** (kunci = IP+username), jadi satu penyerang tidak bisa mengunci seluruh sekolah.
  <br>⚠️ express-rate-limit memperingatkan `keyGenerator` awal saya **bisa dilewati pengguna IPv6** — sudah diperbaiki memakai helper `ipKeyGenerator` yang menormalkan IPv6 ke prefix /64.
- [x] **BE-019** CRUD `/users` khusus Super Admin
  <br>*Selesai bila:* akun baru selalu `ADMIN`, Super Admin lain tidak bisa diubah lewat API, Super Admin terakhir tidak bisa dinonaktifkan.
  <br>✅ Ketiganya terbukti. Titipan `role: "SUPER_ADMIN"` dari klien diabaikan (server memaksa `ADMIN`). Reset password oleh admin **juga mencabut semua sesi** — kalau password direset karena akun dicurigai bocor, sesi penyerang harus ikut mati, bukan menunggu 12 jam.
- [x] **BE-020** Perintah CLI `pnpm --filter @siklon/api user:promote <username>`
  <br>✅ Plus `--turunkan`. Menolak menurunkan Super Admin aktif terakhir, dan mencabut sesi setelah peran berubah agar hak akses baru langsung berlaku.

### Temuan penting di Fase 1

1. **Penegakan "wajib ganti password" ternyata tidak berfungsi sama sekali.** Middleware-nya dipasang
   di level app **sebelum** autentikasi, jadi `req.user` masih kosong dan pengecekannya selalu lolos.
   Test awal saya lolos karena alasan yang salah — akun ujinya `ADMIN`, jadi 403-nya datang dari
   `requireSuperAdmin`, bukan dari middleware ini. Dibuktikan dengan akun `SUPER_ADMIN` yang wajib
   ganti password: **daftar pengguna berhasil diambil (200)**.
   → Diperbaiki: dibuat rantai `wajibMasukPenuh = [wajibMasuk, tolakBilaWajibGantiPassword]` yang
   dipakai semua modul terproteksi. Middleware-nya sekarang **melempar error** bila dipasang sebelum
   autentikasi, supaya kesalahan urutan tidak lagi memberi rasa aman palsu.
2. **`keyGenerator` rate limit bisa dilewati pengguna IPv6** — ketahuan dari peringatan
   express-rate-limit yang muncul saat test dijalankan, bukan saat dipakai manual.
3. Test antar berkas saling menghapus data karena memakai prefix username yang sama (`uji_`).
   Sekarang tiap berkas punya prefix sendiri (`ujiauth_`, `ujiusr_`).

## Fase 2 — Master Data ✅ SELESAI

- [x] **BE-021** CRUD `/academic-years` + aktifkan satu
  <br>*Selesai bila:* mengaktifkan tahun ajaran otomatis menonaktifkan yang lain dalam satu transaksi.
  <br>✅ Wajib transaksi karena database punya partial unique index yang melarang dua tahun ajaran aktif — tanpa transaksi, UPDATE gagal di tengah dan meninggalkan keadaan **tanpa** tahun ajaran aktif sama sekali.
- [x] **BE-022** CRUD `/classes` (nama unik per tahun ajaran)
  <br>✅ Kelas yang punya riwayat presensi **menolak dihapus** dengan saran menonaktifkan — menghapusnya membuat laporan lama kehilangan nama kelasnya.
- [x] ~~**BE-023** CRUD `/guardians`~~ → **diganti: nomor wali jadi kolom di `students`**
  <br>❌ **Tabel `guardians` dibuang atas keputusan pemilik proyek (8 September 2026).** Nama & nomor
  wali sekarang ada di `students.guardian_name` / `guardian_phone` / `notify`. Endpoint `/guardians`
  dihapus (kini 404), berkas `wali.service.ts` dihapus. Migrasi `003` memindahkan data yang ada.
  <br>✅ Normalisasi E.164 tetap dipakai — sekarang di `siswa.service.ts`. Terbukti lewat HTTP:
  `0899-8887-7766` → `6289988877766`, dan `0812-abcd` ditolak dengan pesan jelas.
  <br>⚠️ **Perubahan perilaku yang harus diingat:** nomor ganda kini NORMAL (kakak-adik), jadi tidak
  lagi ditolak sebagai duplikat. Sebagai gantinya, opt-out `BERHENTI` wajib mematikan `notify` untuk
  **semua** siswa dengan nomor itu — terbukti: satu balasan mematikan notifikasi 2 anak sekaligus.
- [x] **BE-024** CRUD `/students` + cari nama (trigram), filter kelas & status, pagination
  <br>✅ Pencarian mencakup nama dan NIS. Default hanya siswa aktif. Ditambahkan `GET /students/ringkasan` yang menghitung "lubang" data: siswa tanpa kelas, tanpa wali, dan yang notifikasinya mati — tiga hal yang membuat siswa tidak terpantau tanpa ada yang sadar.
- [x] **BE-025** Unggah foto siswa + endpoint penyaji foto yang butuh autentikasi
  <br>*Selesai bila:* file tersimpan di luar webroot dan URL langsung tanpa token menghasilkan 401.
  <br>✅ Terbukti: tanpa login → 401. Jenis berkas diperiksa dari **magic bytes**, bukan `Content-Type` yang dikirim klien — berkas PHP yang dinamai `.png` dan diklaim `image/png` berhasil ditolak.
- [x] **BE-026** Import Excel siswa + wali
  <br>*Selesai bila:* baris bermasalah dilaporkan lengkap dengan nomor barisnya, dan **tidak ada** yang tersimpan bila ada error.
  <br>✅ Diuji dengan berkas berisi 7 jenis kesalahan sekaligus (NIS kosong, NIS berspasi, NIS dobel dalam berkas, NIS sudah ada di DB, kelas tidak ada, nomor ngawur, nama wali kosong).
  Ketujuhnya dilaporkan dengan nomor baris, jumlah siswa di database **tidak berubah**. Ada mode `?periksa=true` (dry run) dan template Excel dengan sheet Petunjuk.
  <br>⚠️ Kolom NISN dihapus dari template dan dari database (migrasi `004`, 9 September 2026) — sekolah hanya memakai NIS, dan kolom yang tidak pernah dibaca hanya menambah kemungkinan salah isi.
  <br>✅ Kakak-adik dengan nomor wali ditulis dua format berbeda menghasilkan **satu baris wali** — buah dari normalisasi di BE-023.
- [x] **BE-027** `POST /classes/promote` — kenaikan kelas massal
  <br>*Selesai bila:* jalan dalam satu transaksi, dan data `attendance` lama tidak ikut berubah kelasnya.
  <br>✅ Terbukti: VII-A (3 siswa) → VIII-A dalam satu panggilan. `attendance` tidak disentuh karena menyimpan `class_id` sendiri saat presensi dicatat.
- [x] **BE-028** `POST /students/print-qr` → PDF kartu QR
  <br>*Selesai bila:* isi QR = NIS, 8 kartu per lembar A4 ukuran ID-1, dan hasilnya **benar-benar terbaca** pemindai.
  <br>✅ Kriteria "terbaca" diuji sungguhan: QR di-**decode balik** dengan jsQR dan hasilnya sama dengan NIS, termasuk pada 128 px (ukuran cetak di kartu). NIS juga dicetak sebagai teks di bawah QR sebagai jalan darurat bila QR tergores.
- [x] **BE-029** CRUD `/holidays`
- [x] **BE-030** `GET/PUT /settings` dengan validasi Zod per kunci
  <br>*Selesai bila:* menyimpan `presensi` dengan `jam_masuk` tidak valid ditolak, bukan tersimpan diam-diam.
  <br>✅ Terbukti: `"jam_masuk":"25:99"` → 400 dengan field dan pesannya. Validasi jalan **dua arah** — nilai rusak di database juga ditolak saat dibaca, karena setting `presensi` yang rusak membuat seluruh penentuan status presensi tidak bisa dipercaya.
- [x] **BE-031** Cache setting di memori + invalidasi saat diubah
  <br>✅ Cache dibuang saat PUT, jadi tidak ada TTL yang membuat nilai basi. Endpoint scan tidak lagi membaca tabel `settings` di setiap permintaan.

### Temuan penting di Fase 2

1. **Prisma Client versi CJS tidak bisa diimpor dari paket ESM.** `@prisma/client` (generator
   `prisma-client-js`) adalah CJS yang named export-nya tidak terdeteksi loader ESM Node —
   server mati dengan `SyntaxError: does not provide an export named 'PrismaClient'`. Sempat lolos
   di Fase 0 hanya karena impornya masih `import type` sehingga terhapus saat kompilasi.
   → Pindah ke generator **`prisma-client`** (Prisma 7) dengan `moduleFormat = "esm"` dan output ke
   `src/generated/prisma`. Impor sekarang dari path lokal, bukan `@prisma/client`.
2. **`pnpm-workspace.yaml` ditulis ulang oleh pnpm sendiri.** pnpm 11 memakai kunci `allowBuilds`
   (nilai boolean), bukan `onlyBuiltDependencies`. Konfigurasi lama saya diganti pnpm dengan
   placeholder `"set this to true or false"`, yang membuat `pnpm install` gagal dan **menghapus
   Prisma Client hasil generate**.
3. `pnpm exec` menjalankan verifikasi install lebih dulu, jadi satu masalah lockfile membuat perintah
   yang tidak berhubungan ikut gagal. Saat menelusuri masalah semacam ini, pakai
   `./node_modules/.bin/<alat>` langsung.

## Fase 3 — Mesin Presensi ✅ SELESAI

- [x] **BE-032** Service pembaca aturan `presensi` termasuk override `khusus` per hari
  <br>✅ `resolver.ts:aturanUntukHari`. Override hanya menimpa kunci yang ditulis; sisanya ikut nilai utama.
- [x] **BE-033** Resolver status: `HADIR` / `TERLAMBAT` + hitung `late_minutes`
  <br>*Selesai bila:* 07:08 = HADIR, 07:11 = TERLAMBAT 1 menit, 07:22 = TERLAMBAT 12 menit.
  <br>✅ **19 unit test** menutup batas, toleransi 0, override per hari, dan sekolah 6 hari.
  <br>⚠️ Keputusan yang perlu dicatat: menit terlambat dihitung dari **batas** (jam_masuk + toleransi), bukan dari jam_masuk. Kalau dihitung dari jam_masuk, siswa 07:08 (masih HADIR) dan 07:11 (TERLAMBAT) tercatat terlambat 8 dan 11 menit — toleransi jadi tidak berarti di laporan.
- [x] **BE-034** Penolakan halus: hari libur, di luar `hari_sekolah`, siswa nonaktif, NIS tidak ditemukan
  <br>✅ Semuanya 200 dengan `ok:false` + kode yang bisa ditampilkan operator, bukan 500.
- [x] **BE-035** Middleware `X-Api-Key` untuk Scanner Agent
  <br>✅ Memakai `timingSafeEqual`, bukan `===` — perbandingan string berhenti di karakter pertama yang beda, dan selisih waktunya bisa dipakai menebak kunci karakter demi karakter.
- [x] **BE-036** `POST /scans` — `ON CONFLICT DO NOTHING`, respons memuat siswa + status + foto
  <br>✅ Terbukti: scan kedua menjawab "sudah absen pukul 07:22" dan status `TERLAMBAT` tidak berubah jadi `HADIR`.
- [x] **BE-037** Scan susulan mengubah `ALPA` → `TERLAMBAT`
  <br>✅ Siswa yang ditandai alpa jam 09:00 lalu scan 09:30 statusnya terkoreksi, `check_in_at` terisi, dan catatan "Koreksi otomatis" tercatat.
- [x] **BE-038** `POST /scans/batch` untuk antrean offline (maks 200)
  <br>*Selesai bila:* mengirim batch yang sama dua kali tidak menghasilkan data ganda.
  <br>✅ Terbukti: batch berisi NIS sama dua kali → 2 baris (bukan 3); kirim ulang batch → 0 berhasil, total baris tetap.
  <br>⚠️ Diproses **berurutan, bukan paralel**. Paralel akan membuat dua baris untuk NIS yang sama lolos bersamaan sebelum kunci unik bekerja.
- [x] **BE-039** `POST /attendance/manual` — input oleh admin, `device_code = MANUAL`, `note` wajib
- [x] **BE-040** `GET /attendance?tanggal=&kelasId=` — `LEFT JOIN` siswa agar yang belum scan tetap muncul
  <br>✅ Terbukti: Citra Dewi yang belum scan tetap muncul dengan status `BELUM`.
- [x] **BE-041** `PATCH /attendance/:id` — ubah ke `IZIN`/`SAKIT`, isi `note` + `updated_by`
  <br>✅ Catatan wajib (spasi kosong ditolak). `check_in_at` dan `late_minutes` dibersihkan supaya laporan tidak pernah menampilkan "IZIN, terlambat 12 menit". Scan sesudahnya ditolak `SUDAH_IZIN`.
- [x] **BE-042** Server Socket.IO + event `scan` ke Konsol Scan
  <br>✅ Terbukti dengan klien sungguhan: tanpa auth ditolak, JWT ngawur ditolak, apiKey salah ditolak; JWT sah & apiKey agent tersambung. Event `scan` diterima berisi nama, kelas, status, dan pesan.
  <br>⚠️ Socket **wajib** berautentikasi: hasil scan memuat nama, kelas, dan foto siswa. Tanpa penjaga, siapa pun yang menjangkau server menerima aliran data siswa.
- [x] **BE-043** `POST /agent/hello`, `GET/PUT /scanners`, `POST /scanners/identify`, event `scanner:config`
  <br>✅ Agent melaporkan port → server membalas port yang harus dibuka beserta kodenya. Kunci pemetaan memakai `SN:` → `USB:` → `PORT:` sesuai ketersediaan; port tanpa nomor seri ditandai peringatan. Mode identifikasi terbukti **tidak mencatat presensi** (0 baris), lalu setelah dihentikan scan yang sama tercatat dengan `device_code = GATE-B`.

### Temuan penting di Fase 3

1. **BUG PALING SERIUS: timestamp tersimpan bergeser 7 jam.** Prisma mengirim timestamp sebagai
   waktu UTC **tanpa offset** dengan asumsi timezone sesi adalah UTC; PostgreSQL di mesin ini
   ber-timezone `Asia/Jakarta`, jadi string itu ditafsirkan sebagai waktu lokal.
   Yang membuat bug ini berbahaya: **round-trip lewat ORM terlihat sempurna** karena salahnya dua
   kali dan saling meniadakan. Baru terlihat saat dibandingkan dengan raw SQL — dan seluruh laporan
   proyek ini memakai raw SQL. Diperbaiki dengan memaksa sesi ke UTC (`options: '-c timezone=UTC'`)
   pada adapter. Ada test regresi yang membandingkan hasil ORM dengan `extract(epoch …)`.
2. **Hari libur nasional tidak pernah cocok.** Kolom bertipe `DATE` dipetakan Prisma ke Date pada
   **tengah malam UTC**, sementara helper saya mengembalikan tengah malam **lokal** (17:00 UTC hari
   sebelumnya). Akibatnya scan pada 17 Agustus tercatat "TERLAMBAT 5 menit" alih-alih ditolak.
   → Dipisah dua helper: `tanggalKeDate()` untuk timestamptz, `tanggalKeKolomDate()` untuk kolom DATE.
3. **`attendance_date` tercatat bergeser sehari** karena sebab yang sama. Ada test regresi memakai
   scan pukul 00:30 WIB — jam yang tanggal UTC-nya masih hari sebelumnya.
4. **`JSON.stringify` melempar pada BigInt.** `attendance.id` bertipe `BIGSERIAL`, jadi setiap
   respons yang memuat id presensi akan jadi 500. Dipasang `json replacer` di level app yang
   mengubah BigInt jadi string — sekaligus mencegah kehilangan presisi di klien JavaScript.
5. Kode titik scan ganda semula menghasilkan **500 generik** karena dilempar sebagai `Error` biasa;
   sekarang `Conflict` dengan pesan yang jelas.
6. Status agent semula selalu `offline` karena hanya memeriksa koneksi socket, padahal agent bisa
   hidup dengan HTTP saja. Sekarang: socket **atau** laporan terakhir yang masih segar (< 3 menit).

## Fase 4 — WhatsApp ✅ KODE SELESAI (test ditunda atas permintaan)

> **Test untuk fase ini sengaja ditunda.** Kodenya lengkap, lolos typecheck, dan servernya jalan;
> yang belum ada adalah berkas test otomatis dan uji kirim sungguhan. Konsekuensinya jujur:
> bug di bagian ini baru akan terlihat nanti, dan pengalaman Fase 0–3 menunjukkan bug paling
> mahal justru ketemu saat kode dijalankan, bukan saat ditulis.

- [x] **BE-044** Antarmuka `WaProvider` + provider `dummy` yang hanya menulis ke log
  <br>✅ `DummyProvider` mencatat ke log tanpa mengirim, plus `simulasiPesanMasuk()` untuk menguji opt-out nanti.
- [x] **BE-044b** Pengaman agar tidak ada pesan tak sengaja terkirim
  <br>✅ Tiga lapis, semuanya mati secara default: (a) `WA_PROVIDER` di env **mengalahkan** setelan database; (b) `WA_ALLOWLIST` — saat non-production dengan provider baileys, daftar kosong berarti pengiriman **ditolak**; (c) `settings.whatsapp.aktif=false` dan `students.notify=false` pada data contoh.
  <br>✅ `GET /wa/status` menampilkan ringkasan pengaman dalam bahasa manusia, jadi admin tahu kenapa pesan tidak terkirim.
- [x] **BE-045** Provider Baileys + sesi tersimpan persisten di volume
  <br>✅ `useMultiFileAuthState` ke `WA_SESSION_PATH`. Impor Baileys **dinamis** di dalam `sambungkan()` — paketnya berat, dan aplikasi tidak boleh gagal start hanya karena dependensi WhatsApp bermasalah padahal presensinya masih bisa jalan.
  <br>✅ `connection.close` dengan `loggedOut` **tidak** menyambung ulang otomatis (sesi dicabut dari HP; retry hanya gagal terus). Kode lain menyambung ulang setelah 5 detik.
  <br>⚠️ **Versi Baileys perlu ditinjau sebelum go-live.** Versi stabil 6.7.24 **tidak bisa dipasang** di lingkungan ini: ia menarik `libsignal` langsung dari repositori git dan diblokir kebijakan supply-chain pnpm (`blockExoticSubdeps`). Yang terpasang `7.0.0-rc14` — sebuah RC, tapi dari registry. Paket registry lebih baik daripada menonaktifkan proteksi supply-chain. Baileys juga harus mengikuti perubahan protokol WhatsApp, jadi versi lama bisa berhenti bekerja sama sekali.
- [x] **BE-046** `GET /wa/status`, `POST /wa/connect` (QR), `POST /wa/disconnect`
  <br>✅ Pesan pada `/connect` mengingatkan eksplisit: *"Pindai QR ini dengan WhatsApp nomor SEKOLAH, bukan nomor pribadi"* — karena pengirimnya adalah nomor yang men-scan.
  <br>✅ Server **tidak** menyambung otomatis saat start; harus ditekan admin, supaya restart tidak pernah memulai pengiriman tanpa sepengetahuan siapa pun.
- [x] **BE-047** Perender template dari `settings.template_wa`
  <br>✅ Variabel tak dikenal **dibiarkan terlihat**, bukan dikosongkan. Kalau admin salah tulis `{nama_wali}` padahal variabelnya `{wali}`, pesan yang dikosongkan berbunyi "Bpk/Ibu ," dan salahnya tidak jelas dari mana. Sekaligus dicatat sebagai peringatan di log.
  <br>✅ `GET /wa/preview/:kejadian` untuk memeriksa sebelum disimpan.
- [x] **BE-048** Antrekan `wa_messages` saat scan dan saat job ALPA
  <br>✅ Terbukti lewat smoke test: scan → baris `QUEUED` dengan isi terisi benar; wali `notify=false` dilewati (`waDiantrekan=false`).
  <br>✅ `antrekanAman()` tidak pernah melempar — kegagalan notifikasi **tidak boleh** membatalkan presensi yang sudah tercatat.
  <br>✅ Siswa tanpa wali dicatat sebagai peringatan: presensi tercatat tapi tidak ada yang dikabari adalah kegagalan senyap paling berbahaya untuk sistem yang tujuannya justru mengabari orang tua.
- [x] **BE-049** Worker pengirim: jeda acak 3–8 detik, jam tenang, batas harian
  <br>✅ Jam tenang menangani rentang yang melewati tengah malam (18:30–06:00). Pesan **ditunda, bukan dibuang** — terkirim pagi berikutnya.
  <br>✅ Hal yang membatalkan seluruh putaran (dimatikan / jam tenang / kuota habis) diperiksa **sebelum** pesan diambil, supaya tidak ada pesan yang jumlah percobaannya bertambah sia-sia.
- [x] **BE-050** Retry maksimal 3× + tandai nomor bermasalah
  <br>✅ `NOMOR_TIDAK_TERDAFTAR` ditandai **gagal permanen** — nomor salah tulis tidak akan pernah berhasil, dan mencoba ulang hanya menghabiskan kuota harian. Baileys memeriksa `onWhatsApp()` dulu sebelum mengirim.
  <br>✅ `GET /wa/nomor-bermasalah` melaporkan nomor yang gagal berulang beserta anaknya. Sengaja **tidak** mematikan notifikasinya otomatis: kalau dimatikan sendiri, wali itu diam-diam tidak pernah dikabari lagi dan tidak ada yang tahu.
- [x] **BE-051** Opt-out: balasan `BERHENTI` → `students.notify = false` untuk **semua** anak dengan nomor itu
  <br>✅ Dicocokkan longgar (`berhenti`, `BERHENTI.`, `stop`, `unsubscribe`) — memaksa persamaan tepat berarti permintaan berhenti diabaikan, dan itu jalan tercepat menuju laporan spam.
  <br>✅ Pesan yang masih menunggu di antrean untuk nomor itu **dibatalkan**, supaya wali yang baru minta berhenti tidak menerima sisa antrean pagi itu.
  <br>✅ Setelah tabel `guardians` dibuang, satu wali dengan dua anak punya dua baris. Opt-out
  memakai `updateMany` berdasarkan nomor — kalau hanya satu baris dimatikan, wali yang sudah minta
  berhenti tetap menerima pesan tentang anaknya yang lain. **Terbukti**: satu balasan "BERHENTI."
  mematikan notifikasi 2 anak.
  <br>✅ Status `CANCELLED` ditambahkan ke enum lewat migrasi `002` — membatalkan karena opt-out bukan kegagalan kirim, dan kalau disamakan dengan `FAILED` laporan nomor bermasalah jadi menyesatkan.
- [x] **BE-052** `GET /wa/messages`, `POST /wa/messages/:id/retry`, `POST /wa/test`
  <br>✅ Nomor **disamarkan** (`0812****7890`) di daftar: layar ini sering dibuka di ruang terbuka dan nomor wali adalah data pribadi. Isi pesan lengkap dibuka lewat endpoint terpisah.
  <br>✅ `retry-failed` tidak menyentuh pesan `CANCELLED` — wali sudah menyatakan berhenti, mengirim ulang justru pelanggaran.
- [x] **BE-053** Event socket `wa` untuk memperbarui status di Konsol Scan

### Yang masih harus dikerjakan sebelum WhatsApp dinyalakan

1. **Test otomatis Fase 4** (ditunda atas permintaan): template renderer, jam tenang lintas tengah
   malam, batas harian, retry & gagal permanen, opt-out, dan wali `notify=false` dilewati.
2. **Satu nomor HP khusus sekolah** untuk jadi pengirim — kartu perdana baru, **bukan** nomor pribadi.
3. **Satu nomor penerima uji** diisi ke `WA_ALLOWLIST`.
4. **Tinjau ulang versi Baileys** (lihat catatan di BE-045).

## Fase 5 — Laporan ✅ SELESAI

Seluruh laporan memakai **raw SQL**, bukan ORM — `COUNT(*) FILTER`, `generate_series`, dan agregat
lain tidak punya padanan di query builder, dan mengerjakannya di JavaScript berarti menarik ribuan
baris ke memori untuk dihitung ulang.

- [x] **BE-054** `GET /reports/harian?tanggal=&kelasId=`
  <br>✅ `LEFT JOIN` dari sisi siswa, jadi yang belum scan tetap muncul dengan status `BELUM`. Menyertakan status WA terakhir, nama wali, dan penanda bila statusnya diubah manual.
  <br>⚠️ Semua agregat di-cast `::int` di SQL-nya. `COUNT` di PostgreSQL menghasilkan `bigint` → Prisma memetakannya ke `BigInt` → `JSON.stringify` melempar. Dicegah di query, bukan ditambal di JS.
- [x] **BE-055** `GET /reports/harian/rekap?tanggal=` — semua kelas + total sekolah
- [x] **BE-056** `GET /reports/bulanan/kelas` — matriks siswa × tanggal
  <br>*Selesai bila:* akhir pekan dan hari libur muncul sebagai `L`, bukan dihitung alpa.
  <br>✅ Terbukti pada data sebulan: akhir pekan `L`, persentase dihitung hanya dari hari efektif. Kalau tidak dibedakan, persentase tiap siswa akan turun ±30% hanya karena akhir pekan ikut dihitung.
- [x] **BE-057** `GET /reports/bulanan/siswa` — kalender + rekap + persentase
  <br>✅ Ditambah **rata-rata jam datang** (dihitung di SQL dengan `AT TIME ZONE 'Asia/Jakarta'` eksplisit) dan total menit keterlambatan.
- [x] **BE-058** Export Excel (`exceljs`)
  <br>✅ Harian dan matriks bulanan. Sel diwarnai per status, kolom nama dibekukan (`frozen`) supaya tetap terlihat saat matriks digeser ke kanan. Berkas dibaca balik untuk memastikan isinya benar, bukan cuma berkas kosong yang ukurannya wajar.
- [x] **BE-059** Export PDF (`pdfkit`) dengan kop sekolah + tempat tanda tangan
  <br>✅ Kop sekolah, blok tanda tangan Wali Kelas + Kepala Sekolah, jejak cetak di kaki halaman. Header tabel digambar ulang di setiap halaman baru, dan blok tanda tangan pindah halaman kalau tidak cukup ruang.
  <br>⚠️ Rencana menyebut `pdfmake`; dipakai `pdfkit` karena sudah terpasang untuk kartu QR di BE-028 — satu library PDF lebih baik daripada dua.
- [x] **BE-060** `GET /dashboard` — ringkasan hari ini, tren 14 hari, kelas terendah
  <br>*Selesai bila:* satu permintaan saja, di bawah 300 ms untuk 600 siswa.
  <br>✅ **Diuji dengan volume sungguhan**: 597 siswa, 24 kelas, 13.134 baris presensi → dashboard **9–20 ms**. Seluruh endpoint laporan di bawah 20 ms; PDF harian seluruh sekolah 15 halaman dalam 119 ms, Excel matriks 55 ms.
  <br>✅ Tren hanya menampilkan hari yang punya data, jadi akhir pekan tidak menghasilkan titik 0% yang membuat grafiknya menyesatkan.
  <br>✅ Menyertakan blok **"perlu dibenahi"**: siswa tanpa wali dan yang notifikasinya mati — dua kondisi yang membuat presensi tetap tercatat tapi orang tuanya tidak pernah dikabari.

### Temuan di Fase 5

1. **Tiga proses `tsx watch` menumpuk tanpa terdeteksi.** Pola `pkill -f "tsx watch"` yang saya pakai
   sejak Fase 0 **tidak pernah cocok**, karena cmdline sebenarnya `node .../tsx/dist/cli.mjs watch`.
   Akibatnya beberapa kali saya menguji terhadap **kode basi** — endpoint baru dijawab
   `ROUTE_NOT_FOUND` padahal kodenya sudah benar, dan log penuh `EADDRINUSE` yang tidak saya lihat
   karena tertimbun. Dibuatkan skrip restart yang mematikan berdasarkan pola `tsx/dist/cli.mjs`,
   menunggu port 4000 benar-benar lepas, lalu memastikan health check hijau sebelum lanjut.
2. Rute PDF rekap siswa semula menjalankan seluruh query laporan **dua kali** — sekali hanya untuk
   mengambil NIS bagi nama berkas. Diganti query ringan.

## Fase 6 — Job Terjadwal

- [ ] **BE-061** Setup pg-boss + registrasi cron (zona waktu `Asia/Jakarta`)
- [ ] **BE-062** Job penanda `ALPA` pada `batas_alpa` + antrekan WA
  <br>*Selesai bila:* melewati hari libur & akhir pekan, dan tidak menimpa status `IZIN`/`SAKIT`.
- [ ] **BE-063** Job tutup hari (kunci data + rekap ke wali kelas)
- [ ] **BE-064** Job rekap mingguan ke wali murid (Sabtu pagi)
- [ ] **BE-065** Job backup `pg_dump` harian + rotasi 30 hari
- [ ] **BE-066** Job pembersih `wa_messages` > 6 bulan (kosongkan `body`, simpan statusnya)

## Fase 7 — Scanner Agent ✅ SELESAI

Dikerjakan **melewati Fase 6** atas permintaan. Diuji ujung ke ujung memakai **port serial virtual
(socat)** — bukan hanya dicompile: NIS benar-benar dikirim lewat serial dan berakhir sebagai baris
presensi di database.

- [x] **BE-067** Kerangka agent + pembaca `config.json` (hanya `apiUrl` + `apiKey`)
  <br>✅ Menolak start dengan pesan jelas bila `apiKey` masih berisi contoh — kesalahan paling umum saat pemasangan.
  <br>✅ **Antrean offline tanpa dependensi eksternal**, memakai `node:sqlite` bawaan Node 24. Pemasangan di PC sekolah jadi tidak perlu compiler apa pun.
- [x] **BE-068** Enumerasi port serial + `POST /agent/hello` saat start & berkala
  <br>✅ Melaporkan `path`, `serialNumber`, `vendorId`, `productId`, `locationId`.
  <br>⚠️ **Linux selalu memunculkan `/dev/ttyS0..S31`** — port bawaan motherboard yang tidak terpakai. Tanpa penyaringan, halaman Scanner dibanjiri 32 baris tak berguna dan petugas tidak bisa menemukan scannernya. Yang disaring hanya `ttyS` tanpa identitas USB, jadi adaptor RS232 yang sah tetap terlihat.
  <br>✅ Ditambahkan `portTambahan` di config: jalan keluar untuk perangkat yang tidak terbaca `SerialPort.list()`.
- [x] **BE-069** Buka port sesuai pemetaan + parser baris
  <br>✅ Diuji dengan tiga bentuk pengakhiran yang berbeda antar merek scanner: `CRLF`, `LF` saja, dan **data terpotong di tengah** (`20260` lalu `73\r\n`) — ketiganya menghasilkan NIS yang benar. Tanpa penampung, NIS yang datang terpotong akan terbaca jadi dua scan gagal.
  <br>✅ Penampung dibatasi 256 karakter: scanner yang salah setel dan mengirim tanpa pemisah baris tidak bisa membuat memori habis.
- [x] **BE-070** Debounce lokal per NIS
  <br>✅ Terbukti: scan kedua NIS yang sama dalam 60 detik tidak sampai ke server. Ditahan di agent, bukan server, supaya tidak membebani jaringan saat 600 siswa datang bersamaan.
- [x] **BE-071** Antrean offline SQLite + kirim ulang berkala
  <br>*Selesai bila:* API dimatikan, scan tetap tercatat lengkap setelah API hidup lagi, tanpa duplikat.
  <br>✅ **Terbukti dengan mematikan server sungguhan**: 2 scan masuk `antrean.sqlite`, database tetap 0 baris; server dihidupkan → "Antrean terkirim: 2 tercatat, 0 ditolak, sisa 0".
  <br>✅ **Jam scan asli yang tersimpan** (23:24:26), bukan jam pengiriman — siswa yang datang 06:50 tetap tercatat 06:50 meski baru terkirim pukul 09:00.
  <br>✅ `PRAGMA synchronous = FULL` + WAL: antrean tahan mati listrik, karena PC gerbang sekolah biasanya tanpa UPS.
- [x] **BE-072** Terapkan perubahan pemetaan tanpa restart
  <br>✅ Terbukti: memberi nama port lewat halaman Scanner → 3 detik kemudian log agent menulis `/dev/pts/3 dibuka sebagai GATE-A`, tanpa restart. Port yang kodenya berubah ditutup lalu dibuka ulang.
- [x] **BE-073** Bungkus jadi Windows Service + unit systemd
  <br>✅ `install-service.bat` (nssm) memeriksa hak Administrator, keberadaan Node, `config.json`, dan nssm — masing-masing dengan pesan perbaikan, bukan gagal tanpa keterangan. Log diputar otomatis pada 5 MB.
  <br>✅ `siklon-scanner-agent.service` dengan `SupplementaryGroups=dialout` — tanpa itu agent hidup tapi semua port gagal dibuka, dan penyebabnya sulit diduga.
  <br>✅ README dengan bagian "masalah yang sering terjadi" dan arti tiap pesan log.

### Temuan penting di Fase 7

1. **BUG: scan susulan kehilangan info gerbangnya.** Server menerjemahkan `portPath` → kode gerbang
   dari daftar port di memorinya, dan daftar itu **kosong setelah server restart**. Akibatnya seluruh
   antrean offline yang terkirim tepat setelah server hidup tercatat `device_code = TIDAK_DIKENAL` —
   justru pada kejadian yang paling ingin ditelusuri, yaitu setelah gangguan.
   → Agent sekarang menyimpan dan mengirim **kode gerbang** bersama tiap scan. Agent memang sudah
   tahu kodenya (server sendiri yang memberitahukan saat membuka port), jadi tidak perlu diterjemahkan
   ulang di server. Diverifikasi ulang: `GATE-A` bertahan melewati restart.
2. **Pola `pkill` saya mematikan proses yang salah.** `pkill -f 'tsx/dist/cli.mjs'` ikut mematikan
   agent, karena agent juga dijalankan lewat tsx. Uji antrean offline pertama gagal bukan karena
   kodenya salah, tapi karena agent-nya ikut mati. Skrip start/stop sekarang mencocokkan
   `/proc/<pid>/cmdline` terhadap `apps/api` agar hanya mematikan miliknya.
3. Peringatan "belum ada scanner yang dipetakan" semula diulang setiap siklus lapor (60 detik),
   membuat log penuh dan pesan penting tertimbun. Sekarang hanya dicetak saat keadaannya berubah.

## Fase 8 — Kualitas & Rilis

- [ ] **BE-074** Unit test resolver status + normalisasi nomor WA
- [ ] **BE-075** Test integrasi alur scan (termasuk duplikat, hari libur, izin)
- [ ] **BE-076** `helmet`, CORS daftar-putih, rate limit endpoint scan & export
- [ ] **BE-077** Dockerfile `api` & `worker`, uji backup–restore dari nol
  <br>*Selesai bila:* database berhasil dipulihkan dari file backup ke container kosong.

## Tambahan setelah Fase 8 direncanakan

- [x] **BE-078** `POST /attendance/scan` — endpoint scan ber-JWT untuk browser (9 September 2026)
  <br>*Selesai bila:* scan dari kamera tercatat sebagai presensi **sungguhan** — bukan MANUAL,
  dan tanpa `updated_by`.
  <br>**Kenapa perlu:** `POST /scans` dijaga `X-Api-Key` milik Scanner Agent, dan kunci itu tidak
  boleh ada di browser — variabel `NEXT_PUBLIC_*` ikut terkirim ke klien dan bisa dibaca siapa
  pun. Tanpa endpoint ini, satu-satunya cara frontend mencatat scan kamera adalah lewat
  `/attendance/manual`, sehingga presensinya tercatat `device_code = 'MANUAL'` dan ditandai
  koreksi manual di seluruh laporan.
  <br>✅ Dijaga `wajibMasukPenuh` (sesi pengguna), memakai `prosesScan()` yang sama persis dengan
  jalur pemindai serial: resolver status yang sama, siaran Socket.IO yang sama, dan notifikasi
  WhatsApp yang sama.
  <br>✅ **Titik scan sengaja tidak diminta.** Atas keputusan pemilik proyek: sistem ini tidak perlu
  mencatat siswa absen lewat mana, dan tidak perlu menghitung jumlah absen per kamera/scanner.
  `PermintaanScan.titikScan` jadi opsional, dan `HasilScan.titikScan` jadi `string | null`.
  <br>✅ Terbukti di browser: QR dipindai lewat kamera → baris presensi tersimpan dengan
  `device_code = NULL` dan `updated_by = NULL`, status dihitung resolver (TERLAMBAT 518 menit).
  <br>⚠️ Scan dari Scanner Agent **tanpa** `gate` maupun `portPath` masih tercatat
  `device_code = 'TIDAK_DIKENAL'`. Itu dibiarkan karena berguna sebagai tanda agent yang belum
  dipetakan — bukan nilai yang dipakai untuk menghitung apa pun.

- [x] **BE-079** `WA_ALLOWLIST` menerima format `08xxx`, bukan hanya `628xxx` (10 September 2026)
  <br>*Selesai bila:* nomor yang ditulis `08…` di allowlist benar-benar lolos pemeriksaan.
  <br>**Kenapa perlu:** daftarnya dibandingkan mentah-mentah dengan nomor yang **sudah**
  dinormalkan `normalkanNomor()`. Menulis `081234567890` tidak akan pernah cocok dengan
  `6281234567890`, jadi SEMUA pengiriman ditolak sebagai `DILUAR_ALLOWLIST` — tanpa satu pun
  petunjuk bahwa yang salah cuma format penulisannya. Ditemukan saat menyiapkan uji coba
  WhatsApp, sebelum sempat memakan waktu orang.
  <br>✅ Entri allowlist dinormalkan saat dibaca; entri yang bukan nomor Indonesia valid
  diabaikan dan dicatat sebagai peringatan, bukan diam-diam dibuang.
  <br>✅ Terbukti lewat dua panggilan `POST /wa/test`: nomor `08…` yang ada di allowlist berhenti
  di `BELUM_TERSAMBUNG` (artinya pagar allowlist sudah dilewati), sedangkan nomor yang tidak
  terdaftar tetap ditolak `DILUAR_ALLOWLIST` — pagarnya utuh, cuma tidak lagi rewel soal format.

- [x] **BE-080** Menyambung ulang sesi WhatsApp otomatis saat server start (10 September 2026)
  <br>*Selesai bila:* sesudah restart, WhatsApp tersambung sendiri tanpa ada yang menekan tombol.
  <br>**Kenapa perlu:** `sambungkan()` semula hanya dipanggil dari `POST /wa/connect`. Setiap
  restart server membuat WhatsApp diam sampai ada admin yang kebetulan membuka halaman dan
  menekan Sambungkan — sementara notifikasi kedatangan menumpuk di antrean tanpa ada yang sadar.
  <br>⚠️ **Tidak menyambung otomatis itu keputusan yang disengaja**, ada komentarnya di
  `server.ts`: "supaya restart server tidak pernah memulai pengiriman tanpa sepengetahuan siapa
  pun". Niat itu dipertahankan; yang diubah hanya syaratnya dipersempit jadi tiga:
  provider punya sesi (bukan dummy), sesi tersimpan memang sudah ada, dan `settings.whatsapp.aktif`
  sedang menyala. Artinya yang dipulihkan hanyalah sambungan yang tadinya memang sudah dinyalakan
  secara sadar — server tetap tidak pernah menerbitkan QR pairing sendiri.
  <br>✅ Ketiga syarat diuji satu per satu di server yang berjalan: sesi ada + aktif → tersambung
  sendiri (`"Sesi WhatsApp disambungkan ulang otomatis"` → `"WhatsApp tersambung"`); sesi ada tapi
  aktif=false → `"tidak menyambung"`; aktif=true tapi sesi tidak ada → `"menunggu admin memindai QR"`.
  <br>✅ Kegagalan menyambung ditangkap dan dicatat, tidak menggagalkan start server — presensinya
  harus tetap jalan penuh tanpa WhatsApp.

- [x] **BE-081** `DELETE /wa/session` — ganti nomor WhatsApp tanpa akses server (10 September 2026)
  <br>*Selesai bila:* sesi lama dibuang dan QR baru bisa dipindai dengan nomor yang berbeda.
  <br>**Kenapa perlu:** nomor Baileys adalah barang habis pakai — blokirnya permanen tanpa banding.
  Sebelum ini, ganti nomor berarti SSH ke server, menghapus folder sesi, lalu restart. Di luar
  jangkauan admin sekolah, padahal justru merekalah yang harus bisa memulihkannya.
  <br>⚠️ Sengaja dipisah dari `/disconnect`: memutus hanya melepas koneksi dan sesinya tetap
  tersimpan (menyambung lagi tanpa QR), sedangkan ini membuang kredensialnya.
  <br>✅ Foldernya **diarsipkan, bukan dihapus** (`wa-session-lama-<cap waktu>`). Menautkan nomor
  baru tidak bisa dibatalkan dari sisi WhatsApp, jadi menyisakan salinan tidak ada ruginya.
  <br>✅ Diuji tanpa merusak sesi yang sedang berjalan: `WA_SESSION_PATH` diarahkan sementara ke
  folder tiruan, endpointnya dipanggil, folder tiruannya terarsipkan dengan benar, dan
  `creds.json` yang asli terverifikasi masih utuh.

- [x] **BE-082** `WA_ALLOWLIST=*` untuk mematikan pagar penerima saat uji coba (10 September 2026)
  <br>*Selesai bila:* nomor mana pun bisa dikirimi tanpa menyunting `.env` tiap ganti tujuan.
  <br>**Kenapa perlu:** atas permintaan pemilik proyek — menyunting `.env` dan me-restart server
  tiap kali ganti nomor tujuan terlalu berat untuk sekadar mencoba.
  <br>⚠️ **Pagar tidak dicabut, hanya diberi jalan keluar yang eksplisit.** Nilai `*` harus
  DITULIS; daftar kosong tetap berarti "tolak semua". Jadi keadaan bawaannya masih gagal ke arah
  aman, dan mematikannya jadi keputusan yang terlihat — ikut tercetak di spanduk peringatan
  halaman WhatsApp: *"pagar penerima DIMATIKAN … pastikan notify hanya menyala untuk siswa uji"*.
  <br>ℹ️ Kekhawatiran awal permintaan ini sebenarnya sudah tertangani: di production allowlist
  memang dilewati sepenuhnya (`if (!isProd && …)`), jadi admin sekolah tidak pernah berurusan
  dengannya. Yang diperbaiki di sini murni kenyamanan di mesin pengembangan.
  <br>✅ Terbukti: `allowlistAktif` jadi `false`, catatannya berubah jadi peringatan, dan pesan
  ke nomor yang tidak pernah didaftarkan terkirim (`ok: true`).

- [x] **BE-083** Absen pulang (10 September 2026, permintaan pemilik proyek)
  <br>⚠️ **Membalik keputusan yang tercatat final** di `CLAUDE.md` ("Absen masuk saja. Tidak ada
  `check_out_at`"). Dokumen keputusannya sudah diperbarui, bukan dibiarkan bertentangan.
  <br>✅ **Bukan tabel baru, bukan status baru.** `attendance.check_out_at` adalah stempel waktu
  kedua pada baris yang sama, jadi kunci unik `(student_id, attendance_date)` tetap berlaku dan
  seluruh laporan yang menghitung per baris tidak perlu disentuh. Status tetap
  HADIR/TERLAMBAT/IZIN/SAKIT/ALPA. Migrasi `005_absen_pulang.sql` + indeks parsial
  `idx_att_belum_pulang`.
  <br>✅ **Pembedanya jam, bukan urutan.** Setelan baru `presensi.jam_pulang` (bisa ditimpa per
  hari seperti `jam_masuk` — Jumat pulang lebih awal terbaca benar). Scan kedua pukul 09:30
  hampir pasti kartu tertempel dua kali; scan kedua pukul 13:05 hampir pasti siswa pulang.
  <br>✅ Kejadian WhatsApp baru `PULANG` beserta templatnya, tapi **tidak** ikut di `kirim_saat`
  bawaan — lihat alasan volume di `docs/PLAN.md`. Sekolah bisa menyalakannya sendiri.
  <br>✅ **Selesai bila:** urutan scan sehari penuh berperilaku benar. Diuji langsung lewat
  `POST /scans`: 07:05 → MASUK/HADIR · 09:30 → SUDAH_ABSEN · 12:59 → SUDAH_ABSEN ·
  13:00 → PULANG tercatat (tepat di batas) · 13:40 → SUDAH_PULANG. Database menyisakan
  **satu baris** dengan masuk 07:05 dan pulang 13:00.
  <br>✅ Laporan harian, riwayat siswa, ekspor Excel dan PDF semuanya membawa jam pulang.
  Header Excel terverifikasi: No · NIS · Nama · Kelas · **Masuk · Pulang** · Status · Telat ·
  Titik Scan · Wali · Keterangan.
  <br>✅ 80 uji unit backend tetap lolos, termasuk 4 kasus baru untuk `sudahJamPulang()` dan
  penimpa per hari.
  <br>⚠️ **Aturan awal salah dan langsung dibetulkan hari itu juga** (dilaporkan pemilik proyek).
  Semula pulang hanya dicatat bila siswa SUDAH punya jam masuk, jadi scan pertama pukul 14:47
  tercatat "TERLAMBAT 457 menit" — angka omong kosong yang menuduh siswa yang sebenarnya hadir
  sejak pagi. Sekarang **scan apa pun pada/sesudah jam pulang dihitung sebagai pulang**:
  <br>&nbsp;&nbsp;• Belum ada baris → dibuat dengan `check_in_at` **kosong**, `check_out_at` terisi,
  status HADIR, catatan "Jam masuk tidak tercatat". Jam masuknya dibiarkan kosong, bukan ditebak —
  laporan menampilkan "—" sehingga jelas ada yang perlu dilengkapi admin.
  <br>&nbsp;&nbsp;• Baris sudah ALPA → dikoreksi jadi HADIR; siswa yang menempel kartu saat pulang
  jelas hadir. Cabang ini sengaja diletakkan DI ATAS koreksi ALPA yang lama, kalau tidak
  urutannya membuat ia tercatat telat 7 jam.
  <br>&nbsp;&nbsp;• **Presensi manual dikecualikan** — di situ admin memang sedang menyatakan
  siswanya hadir, jam berapa pun ia menekannya.
  <br>✅ Ketiga jalur diuji, plus regresi urutan sehari penuh dan presensi manual sore hari.
  <br>✅ **Notifikasi pulang akhirnya DINYALAKAN** atas permintaan pemilik proyek, sesudah
  bawaannya sempat mati. `kirim_saat` jadi `["MASUK","PULANG","TERLAMBAT","ALPA"]`. Terbukti
  ujung ke ujung: scan pulang → antrean → terkirim lewat Baileys. Biayanya tetap dicatat di
  `seed.sql` dan `docs/PLAN.md` supaya bisa dimatikan lagi kalau ternyata terlalu berat.
  <br>⚠️ **Setelan di-cache di memori.** Mengubah `settings` lewat SQL langsung TIDAK berpengaruh
  sampai server restart — cache hanya dibuang oleh `simpan()` di jalur aplikasi. Sempat menyesatkan
  saat pengujian: database sudah benar tapi log tetap berkata "Kejadian PULANG tidak diaktifkan".
  Ubah setelan lewat halaman Pengaturan atau `PUT /settings/:kunci`, jangan lewat psql.

- [x] **BE-084** Hapus nama wali murid (10 September 2026, permintaan pemilik proyek)
  <br>Pesan menyapa "Bpk/Ibu" lalu langsung menyebut nama anaknya, jadi `students.guardian_name`
  tidak pernah dibaca lagi. Menyimpan nama yang tidak dipakai hanya menambah kolom yang harus
  diisi saat impor dan bisa salah. Migrasi `006_hapus_nama_wali.sql`.
  <br>✅ Dibersihkan menyeluruh, bukan cuma kolomnya: variabel `{wali}` dibuang dari templat dan
  perendernya, kolom "Nama Wali" hilang dari impor Excel beserta aturan "nama & nomor sepasang",
  kolom "Wali Murid" hilang dari ekspor Excel, dan daftar nomor bermasalah kini mengenali nomor
  dari daftar anaknya — yang justru lebih berguna daripada nama wali.
  <br>⚠️ **Bahaya upgrade yang nyaris terlewat.** `ambil()` memvalidasi setiap setting dengan Zod
  dan MELEMPAR bila tidak cocok, dan `skemaTemplateWa` memakai `z.record(z.enum(KEJADIAN_WA), …)`
  yang **mewajibkan semua kunci ada**. Pemasangan lama yang belum punya templat `PULANG` akan
  mematikan SELURUH notifikasi WhatsApp begitu kode baru jalan — bukan cuma pesan pulangnya.
  Karena itu migrasi 005 & 006 sekarang ikut membawa perubahan `settings`, bukan hanya skema.
  <br>✅ Backfill migrasinya diuji sungguhan: setelan dikembalikan ke bentuk "sebelum upgrade"
  (tanpa `jam_pulang`, tanpa templat `PULANG`, templat masih memuat `{wali}`), migrasi dijalankan,
  dan ketiganya pulih dengan benar. Kedua migrasi juga terbukti aman dijalankan berulang.
  <br>✅ Seluruh rangkaian uji lolos sesudahnya: Fase 2 27/27, Fase 3 34/34, Fase 4 23/23,
  Fase 5 23/23, absen pulang 9/9, unit backend 80/80.

- [x] **BE-085** Matriks bulanan membawa jam masuk & pulang (10 September 2026, permintaan pemilik proyek)
  <br>*Selesai bila:* tiap sel matriks bisa menampilkan jam, bukan hanya kode status.
  <br>**Kenapa perlu:** sel yang cuma berisi "H" tidak memberi tahu siswanya datang pukul berapa
  atau sudah pulang atau belum — padahal itu yang dicari wali kelas saat memeriksa rekap.
  <br>✅ `SelMatriks` bertambah `jamMasuk` / `jamPulang`, diambil di query yang sama sehingga
  tidak ada tambahan perjalanan ke database.
  <br>✅ Ekspor Excel bulanan ikut: sel hari yang ada scannya diisi `masuk⏎pulang` dengan
  `wrapText` dan kolom dilebarkan dari 3,5 jadi 6,5. Hari tanpa jam (izin, sakit, alpa, libur)
  tetap huruf — memang tidak ada jam yang bisa ditampilkan. Terverifikasi dari berkas hasil
  unduhan: 19 sel dua baris jam, huruf status tetap utuh.

- [x] **BE-086** Ekspor Excel siap cetak (10 September 2026, permintaan pemilik proyek)
  <br>*Selesai bila:* berkasnya rapi begitu dibuka di pratinjau cetak, tanpa diutak-atik dulu.
  <br>**Kenapa perlu:** tidak ada `pageSetup` sama sekali, jadi Excel memakai bawaan pencetak —
  di mesin pemilik proyek itu ternyata **ukuran amplop**, dan rekap sebulan pecah jadi enam
  halaman dengan judul terpotong jadi "SD", "F", "Wal" di tepi kanan.
  <br>✅ A4 mendatar, `fitToPage`, margin rapat, dan footer halaman berisi tanggal cetak +
  "Halaman X dari N".
  <br>✅ `printTitlesRow` mengulang baris judul tabel, `printTitlesColumn` mengulang kolom
  No/NIS/Nama. Tanpa yang kedua, halaman ketiga rekap bulanan berisi deretan jam tanpa nama
  siapa pun di sampingnya.
  <br>⚠️ Rekap bulanan sengaja **dua halaman lebar**, bukan satu. Sebulan penuh dengan jam masuk
  & pulang butuh ±280 karakter; dipaksa muat satu halaman A4 mendatar skalanya turun ke ±43% dan
  angkanya tidak terbaca. Dua halaman memberi ±86%.
  <br>⚠️ Judul rekap bulanan diubah jadi **rata kiri**. Rata tengah menipu pada tabel yang lebih
  lebar dari satu halaman: teksnya mendarat di tengah SELURUH lebar kolom, yaitu di halaman
  kedua — itulah sebab judulnya tampak terpotong di tepi kanan halaman pertama.
  <br>✅ **Diverifikasi dengan benar-benar mencetaknya**, bukan dari XML saja: berkasnya
  di-render jadi PDF lewat LibreOffice lalu halamannya diperiksa satu per satu. Laporan harian
  32 siswa = **1 halaman**; rekap bulanan = **4 halaman** (2 lebar × 2 tinggi) dengan nama
  berulang di halaman 3 & 4.
  <br>🐛 Dua cacat yang hanya kelihatan dari hasil cetak: catatan kaki "Dicetak dari SIKLON"
  mendorong laporan harian ke halaman kedua yang isinya cuma baris judul berulang (dihapus,
  keterangannya sudah ada di footer halaman), dan label legenda terpotong jadi "Legen" karena
  ditulis melintasi kolom "No" yang selebar 4 karakter (digabung jadi satu sel).

- [x] **BE-087** Hapus wali kelas (10 September 2026, permintaan pemilik proyek)
  <br>`classes.homeroom_teacher` dibuang lewat migrasi `007_hapus_wali_kelas.sql`. Kolomnya tidak
  dipakai menghitung apa pun — hanya dicetak sebagai keterangan di kepala laporan — dan jadi satu
  lagi kolom yang harus dijaga tetap mutakhir tiap ganti tahun ajaran.
  <br>✅ Dibersihkan dari layanan kelas, rute akademik, laporan harian & bulanan, dashboard,
  ekspor Excel, dan kepala PDF.
  <br>⚠️ ~~**Blok tanda tangan "Wali Kelas" di PDF sengaja DIPERTAHANKAN.** Itu tempat tanda tangan
  basah di kertas, bukan nama yang dicetak dari database.~~ **Dibalik 13 September 2026** atas
  permintaan pemilik proyek: seluruh blok tanda tangan (Wali Kelas dan Kepala Sekolah) dibuang
  dari ketiga PDF. Lihat BE-090.
  <br>✅ Fase 2 27/27 dan Fase 5 23/23 lolos sesudahnya.

- [x] **BE-088** `POST /classes/salin` — salin kerangka kelas ke tahun ajaran lain (10 September 2026)
  <br>*Selesai bila:* tahun ajaran baru bisa langsung punya kelas tanpa dibuat satu per satu.
  <br>**Kenapa perlu:** kelas terikat ke tahun ajaran (`UNIQUE (academic_year_id, name)`), jadi
  tahun baru SELALU mulai tanpa kelas. Tanpa ini admin membuat ulang enam kelas dengan nama yang
  sama persis tiap pergantian tahun.
  <br>✅ Yang disalin cuma **kerangkanya** — nama dan tingkat. Siswanya tidak ikut, karena
  memindahkan siswa adalah keputusan terpisah (kenaikan kelas), dan siswa kelas VII tahun ini
  seharusnya masuk VIII tahun depan, bukan VII lagi.
  <br>✅ Aman dijalankan berulang: `skipDuplicates` bersandar pada kunci unik
  `(academic_year_id, name)`. Terbukti — jalan pertama membuat 6 kelas, jalan kedua melewati
  keenamnya. Tahun asal = tujuan ditolak.
  <br>ℹ️ `naikkanKelas()` ternyata sudah netral terhadap tahun sejak awal — ia hanya memindahkan
  `class_id`. Yang menghalangi pergantian tahun cuma UI-nya, yang dulu hanya menawarkan kelas
  tahun aktif. Tidak ada perubahan di sisi backend untuk itu.

- [x] **BE-089** Rangkaian uji ujung-ke-ujung masuk ke dalam repo — `tools/uji/` (11 September 2026)
  <br>*Selesai bila:* satu perintah menjalankan seluruh uji browser, dan hasilnya sama di mesin mana pun.
  <br>**Kenapa perlu:** rangkaian uji ini sebelumnya hidup di `/tmp`. Restart laptop menghapusnya —
  sekitar 120 pemeriksaan yang dibangun berhari-hari lenyap sekaligus. Uji yang tidak ikut
  di-commit bukan uji, cuma sesi kerja yang kebetulan hijau.
  <br>✅ `node tools/uji/jalankan.mjs` menjalankan 8 suite, **128 pemeriksaan**. Tiap suite jadi
  proses terpisah supaya satu yang menggantung tidak menjatuhkan sisanya, dan kebocoran keadaan
  antar suite jadi mustahil. Keluar dengan kode 1 kalau ada yang gagal, jadi siap dipakai CI.
  <br>✅ Menjalankan browser sungguhan melawan server dan PostgreSQL yang benar-benar hidup —
  tanpa tiruan. Cacat yang paling sering lolos di proyek ini memang yang hanya muncul saat
  ketiganya bertemu: pemindai yang berhenti karena videonya disembunyikan, siaran socket dobel,
  cache setelan yang tidak tahu database berubah, dan laporan yang baru kelihatan salah setelah
  dicetak.
  <br>✅ **WhatsApp tidak pernah benar-benar dikirim.** Suite yang menyentuh presensi mematikan
  `students.notify` lebih dulu dan menyalakannya lagi di akhir lewat `pulihkanNanti()`, yang tetap
  jalan meski suitenya melempar di tengah. Tanpa itu tiap scan uji mengirim pesan sungguhan ke
  nomor wali — puluhan pesan beruntun ke satu nomor adalah pola tercepat membuat nomor Baileys
  diblokir.
  <br>ℹ️ Tiga aturan yang dipegang semua suite, ketiganya lahir dari kegagalan nyata dan
  ditulis di `tools/uji/README.md`: uji menyiapkan datanya sendiri lalu mengembalikannya; asersi
  tidak mematok angka data (`barisHarian === 3` benar untuk 3 siswa, salah untuk 32); dan yang
  diperiksa hasilnya, bukan perantaranya — QR dibaca dari berkas video sungguhan lewat
  `--use-file-for-fake-video-capture`, lalu yang diperiksa baris presensi di database.
  <br>⚠️ BE-074 dan BE-075 **tetap terbuka**. Rangkaian ini menguji alur scan lewat browser
  (termasuk scan dobel dan absen pulang), tapi bukan uji satuan resolver dan belum menyentuh
  hari libur maupun izin.

- [x] **BE-090** Ekspor PDF: mendatar, hitam putih, siap cetak (13 September 2026, permintaan pemilik proyek)
  <br>*Selesai bila:* ketiga laporan keluar sebagai PDF A4 mendatar tanpa satu pun piksel berwarna,
  dan jumlah halamannya wajar.
  <br>✅ **Hitam putih.** Tint status per baris dibuang seluruhnya. Alasannya: laporan presensi
  dicetak di pencetak laser sekolah yang hampir selalu mono, jadi warna status yang cantik di
  layar keluar sebagai abu-abu yang nyaris seragam — pembedanya hilang justru di kertas, tempat
  laporan ini sebenarnya dipakai. Penggantinya: ALPA dan TERLAMBAT dicetak **tebal**, hari libur
  berlatar abu-abu, baris selang-seling abu sangat muda. Abu-abu hanya untuk hal struktural.
  <br>✅ **Orientasi mengikuti bentuk tabelnya**, bukan disamakan. Atas permintaan pemilik proyek
  (13 September 2026), laporan **harian** dan **rekap bulanan per siswa** dibuat **TEGAK**:
  kolomnya sedikit dan barisnya panjang, jadi kertas tegak memuat lebih banyak baris per lembar —
  sekelas 32 siswa maupun sebulan penuh sama-sama selesai dalam **satu lembar** (rekap per siswa
  turun dari 2 lembar), dan bentuknya lazim untuk arsip surat. Yang tetap **MENDATAR** hanya
  **matriks bulanan per kelas**, karena ia punya satu kolom per tanggal; ditegakkan, tiap kolom
  menyempit sampai jam masuk dan pulang tidak terbaca lagi.
  <br>✅ **PDF matriks bulanan per kelas — BARU.** Sebelumnya hanya ada Excel, jadi rekap sebulan
  satu kelas tidak bisa dicetak langsung. Tanggalnya dipecah jadi blok yang muat selembar dan
  dibagi RATA (30 hari → 2 blok × 15), bukan diisi penuh lalu sisanya jadi blok berisi dua kolom.
  Dengan begitu sel "jam masuk ↵ jam pulang" tetap terbaca — kalau 31 tanggal dipaksa muat
  sekaligus, tiap kolom tinggal ±15pt dan jamnya terpaksa dibuang.
  <br>✅ Kolom **Jam Pulang** ditambahkan ke rekap per siswa, yang sebelumnya hanya punya jam masuk.
  <br>✅ Kaki halaman **hanya** "Halaman X dari Y".
  <br>✅ **Blok tanda tangan dan cap "Dicetak dari SIKLON &lt;waktu&gt;" dibuang** (13 September 2026,
  permintaan pemilik proyek). Ini membalik keputusan BE-087 yang sebelumnya mempertahankan blok
  tanda tangan. Cap waktu cetak juga membuat dua cetakan dari data yang sama terlihat berbeda
  hanya karena jamnya bergeser.
  <br>🐛 **Dua cacat yang hanya kelihatan dari berkas jadinya**, keduanya lahir saat pindah ke
  mendatar: (1) cadangan ruang tanda tangan dipakai di SETIAP pergantian halaman, bukan hanya di
  akhir — di kertas mendatar yang tingginya 595pt, 118pt itu seperempat halaman, dan laporan 2
  lembar membengkak jadi 4; (2) menulis kaki halaman di dalam margin bawah membuat PDFKit
  menganggapnya isi yang meluap lalu menambah halaman kosong sendiri, sehingga nomor halamannya
  tidak pernah tergambar. `lineBreak: false` tidak cukup — margin bawah harus dinolkan sementara.
  <br>ℹ️ Satu cacat lagi: `ellipsis: true` memotong sel dua baris jadi "07:0…" karena memaksanya
  satu baris. Ellipsis sekarang hanya untuk sel satu baris.
  <br>✅ **PDF dikirim `Content-Disposition: inline`, bukan `attachment`** (13 September 2026,
  permintaan pemilik proyek) — dibuka di penampil PDF browser, bukan langsung mendarat di folder
  Unduhan. Kalau memang mau disimpan, tombol unduh penampil itu sudah ada. Excel tetap
  `attachment` karena browser tidak bisa menampilkannya. `filename` tetap disertakan supaya nama
  berkasnya benar saat pengguna menekan simpan dari penampil.
  <br>ℹ️ Header ini tidak bisa diperiksa lewat `fetch` di dalam halaman: `Content-Disposition`
  bukan header yang di-expose CORS, jadi dari JS selalu terbaca kosong. Ujinya membacanya dari
  sisi Node. `Access-Control-Expose-Headers` sengaja TIDAK ditambahkan — tidak ada yang
  membutuhkannya selain pengujinya sendiri.
  <br>✅ Diuji di `tools/uji/suite/07-laporan.mjs` (29/29): ukuran halaman dibaca dari `/MediaBox`
  dan dicocokkan dengan orientasi yang seharusnya per laporan (harian & rekap per siswa 595×842,
  matriks bulanan 842×595), jumlah halaman dihitung, dan tiap halaman di-render jadi gambar lalu diperiksa
  selisih R/G/B tiap piksel — hasilnya **0**, abu-abu murni. Teksnya juga dibaca ulang untuk
  memastikan "Kepala Sekolah", "Wali Kelas", dan "Dicetak dari SIKLON" benar-benar tidak ada lagi
  sementara nomor halaman tetap tercetak.

- [x] **BE-091** `GET /reports/bulanan/siswa.xlsx` — ekspor Excel rekap sebulan per siswa (13 September 2026)
  <br>*Selesai bila:* rekap satu siswa bisa diunduh sebagai Excel, bukan hanya PDF.
  <br>**Kenapa perlu:** pasangan tombol unduh yang kini ada di tiap baris matriks bulanan (FE-060).
  Sebelumnya rekap per siswa hanya punya PDF — bagus untuk dicetak, tapi tidak bisa diolah. Wali
  kelas kerap menyalin baris tertentu ke surat pemanggilan atau menjumlah sendiri keterlambatannya.
  <br>✅ **Tegak, bukan mendatar.** Tabelnya cuma tujuh kolom (Tgl, Hari Sekolah, Status, Jam Masuk,
  Jam Pulang, Telat, Keterangan) dengan baris sepanjang jumlah hari dalam bulan, jadi kertas tegak
  memuat sebulan penuh dalam satu lembar. `siapCetak()` dapat opsi `orientasi` untuk itu.
  <br>✅ Hari bukan sekolah diberi latar abu supaya akhir pekan tidak terbaca sebagai data hilang.
  Baris judul dibekukan dan diulang tiap halaman cetak.
  <br>✅ Diuji: berkasnya benar-benar memuat nama siswa yang diminta beserta kolom Jam Masuk dan
  Jam Pulang — bukan sekadar "status 200".

- [x] **BE-092** Rangkaian uji tidak lagi tergantung hari apa ia dijalankan (13 September 2026)
  <br>**Gejalanya:** dijalankan hari Minggu, suite Konsol Scan turun jadi 8/22 dan Kamera 14/15.
  Semua kegagalannya berbunyi *"Hari ini bukan hari sekolah"*.
  <br>**Bukan cacat produk.** Sistemnya justru BENAR menolak mencatat presensi di hari bukan
  sekolah; yang lemah ujinya, yang diam-diam mengandaikan hari ini hari kerja. Uji yang hasilnya
  tergantung hari apa ia dijalankan bukan uji — ia cuma kebetulan hijau Senin sampai Jumat.
  <br>✅ `pastikanHariSekolah()` di `tools/uji/bersama.mjs`: kalau hari ini bukan hari sekolah
  (atau kebetulan hari libur), setelannya dipinjam sementara lalu dikembalikan persis seperti
  semula. Setelan diubah lewat **API**, bukan SQL langsung — server menyimpan setelan di memori
  dan cache-nya hanya dibuang lewat jalur simpan aplikasi.
  <br>⚠️ Pemulihannya memakai **curl yang sinkron**, bukan `fetch`. Pemulihan berjalan di handler
  `process.on('exit')`, dan di sana event loop sudah mati — `fetch` yang asinkron tidak akan pernah
  selesai, sehingga setelan yang dipinjam uji akan tertinggal rusak.
  <br>✅ Terbukti: dijalankan hari Minggu, **8/8 suite lulus** (157 pemeriksaan), dan sesudahnya
  `hari_sekolah` kembali `[1,2,3,4,5]` baik di database maupun di cache server.

- [x] **BE-093** Laporan harian dicetak per kelas, satu kelas satu halaman (13 September 2026, permintaan pemilik proyek)
  <br>*Selesai bila:* mencetak laporan harian seluruh sekolah menghasilkan lembaran yang bisa
  langsung dipisah dan diserahkan ke wali kelas masing-masing.
  <br>**Kenapa perlu:** sebelumnya seluruh sekolah dicetak sebagai SATU tabel panjang dengan kolom
  "Kelas". Lembarannya tidak bisa dipisah — satu halaman bisa memuat ekor VII-A sekaligus kepala
  VII-B, dan wali kelas VII-A terpaksa menerima daftar yang memuat siswa kelas lain.
  <br>✅ Berlaku untuk **PDF dan Excel**. Tiap kelas mulai di halaman baru dengan kop dan ringkasan
  miliknya sendiri (Total/Hadir/Terlambat/…/Kehadiran dihitung per kelas, bukan per sekolah).
  Di Excel pemisahnya `addPageBreak()` di baris sebelum kop bagian berikutnya.
  <br>✅ Kolom **"Kelas" dihapus dari tabel** — namanya sudah ada di kop tiap halaman, jadi
  mengulangnya di setiap baris hanya memakan lebar yang lebih berguna untuk nama dan keterangan.
  <br>⚠️ `printTitlesRow` sengaja TIDAK dipakai lagi di Excel harian. Ia mengulang SATU baris judul
  yang sama di semua halaman — benar untuk satu tabel panjang, salah untuk lembar berisi banyak
  kelas: halaman VII-B akan mengulang baris judul milik VII-A. Tiap bagian sudah membawa kop dan
  baris judulnya sendiri. `siapCetak()` menerima `barisJudulTabel: 0` untuk mematikannya.
  <br>✅ Diuji bukan dari jumlah halamannya saja: teks PDF dibaca ulang untuk memastikan tiap
  halaman punya kop nama kelasnya sendiri (VII-A · VII-B · VIII-A) dan angka ringkasannya cocok
  dengan jumlah siswa kelas itu di database (32,30,28) — bukan angka seluruh sekolah.

- [x] **BE-094** Data contoh multi-kelas — `database/contoh-multi-kelas.sql` (13 September 2026)
  <br>*Selesai bila:* laporan yang dikelompokkan per kelas bisa benar-benar diperiksa.
  <br>**Kenapa perlu:** seluruh data contoh sebelumnya hanya berisi satu kelas (VII-A). Dengan satu
  kelas, "dikelompokkan per kelas" terlihat sama persis dengan "tidak dikelompokkan" — cacat
  pengelompokan mustahil terlihat.
  <br>✅ Menambah **VII-B (30 siswa)** dan **VIII-A (28 siswa)** beserta presensi di tujuh tanggal
  yang sama dengan VII-A, sehingga laporan harian bisa dibandingkan antar kelas pada hari yang sama.
  Total jadi 90 siswa di 3 kelas.
  <br>✅ Sebarannya memakai `hashtext(nis || tanggal)`, bukan `random()`. `random()` di dalam LATERAL
  non-korelasi dievaluasi SEKALI oleh PostgreSQL sehingga seluruh siswa berakhir dengan status yang
  sama — pernah terjadi, dan hasilnya data contoh berisi HADIR semua. hashtext juga membuat berkas
  ini menghasilkan data yang sama tiap dijalankan.
  <br>✅ Aman dijalankan berulang — terbukti, jalan kedua menambah 0 baris.
  <br>⚠️ `notify` sengaja **dimatikan** untuk seluruh siswa contoh. Nomornya sama semua, dan puluhan
  pesan beruntun ke satu nomor adalah pola tercepat membuat nomor Baileys diblokir.

- [x] **BE-095** Sisa "wali kelas" yang mati dibersihkan (13 September 2026)
  <br>🐛 Ditemukan saat mengerjakan BE-093. `wali_kelas` masih dideklarasikan di tipe hasil query
  `rekapSemuaKelas()` dan `dashboard()`, padahal kolomnya sudah dibuang di BE-087 dan SQL-nya tidak
  lagi meng-SELECT-nya. Akibatnya nilainya selalu `undefined`, dan **dua layar mencetak "tanpa wali
  kelas" di bawah SETIAP nama kelas** — tabel Rekap Semua Kelas dan kartu "Kelas Perlu Perhatian"
  di Dashboard. Keterangan yang selalu salah, tentang konsep yang sudah tidak ada.
  <br>✅ Dibuang dari kedua tipe di backend, dari tipe `RekapKelas` dan `Dashboard` di frontend, dan
  dari kedua tampilannya. Di Dashboard barisnya diganti jumlah presensi tercatat, yang memang ada isinya.

- [x] **BE-096** `database/seed.sql`: hash password placeholder diganti hash Argon2id asli (21 September 2026)
  <br>*Selesai bila:* paket deploy client (Docker, tanpa seeder aplikasi) bisa langsung login sesudah
  `docker compose up` pertama kali.
  <br>🐛 **Bug paling parah yang ditemukan sesi ini.** `password_hash` di `seed.sql` berisi teks
  placeholder literal (`GANTI_DENGAN_HASH_ASLI`, bukan hash Argon2id sungguhan), dan itu ikut
  terbawa ke SETIAP paket client — karena `docker-entrypoint-initdb.d` hanya menjalankan
  `schema.sql` + `seed.sql` mentah, TANPA seeder aplikasi (`apps/api/prisma/seed.ts`) yang biasanya
  memperbaiki placeholder itu di lingkungan development. Akibatnya: **Docker bisa menyala
  sempurna, dan aplikasinya tetap 100% tidak bisa dipakai** — Argon2id menolak memverifikasi hash
  yang bukan hash sungguhan, untuk password apa pun.
  <br>✅ Diperbaiki dengan menempelkan hash Argon2id ASLI (password `siklon123`, parameter sama
  persis dengan `apps/api/src/lib/password.ts`: `memoryCost=19456, timeCost=2, parallelism=1`)
  langsung ke `seed.sql`, dibuat & diverifikasi lewat `@node-rs/argon2` yang sama — bukan ditulis
  tangan. `must_change_password` tetap `TRUE` (default schema), jadi tetap wajib ganti password
  di percobaan masuk pertama.
  <br>✅ Diuji ujung-ke-ujung: volume Docker dikosongkan total, `docker compose up` dari nol, lalu
  `curl -X POST /auth/login` dengan `superadmin`/`siklon123` sungguhan mengembalikan `200 OK`
  beserta cookie sesi.

- [x] **BE-097** `database/seed.sql`: komentar SQL di dalam literal JSON merusak SELURUH `settings` (21 September 2026)
  <br>🐛 Ditemukan saat memverifikasi ulang BE-096 dari volume Docker kosong: login sudah berhasil,
  tapi tabel `settings` kosong total — bukan cuma kunci `whatsapp`.
  <br>**Sebabnya:** catatan penjelasan ("PULANG diaktifkan atas permintaan pemilik proyek...")
  tertulis **di dalam** tanda kutip literal JSON kunci `'whatsapp'`, bukan sebagai komentar SQL
  sungguhan di luarnya. `--` di dalam string yang di-cast ke `json` dibaca sebagai ISI JSON, bukan
  komentar, dan merusak parsing-nya (`invalid input syntax for type json ... Token "-" is
  invalid`). Karena `INSERT INTO settings (...) VALUES (...), (...), ...` ini SATU pernyataan
  dengan enam baris, satu baris gagal berarti keenamnya gagal sekaligus — nama sekolah, aturan jam
  presensi, `scanners`, `scan`, dan seluruh template pesan WhatsApp tidak pernah tersimpan.
  <br>✅ Dipindahkan ke luar tanda kutip, sebagai komentar SQL biasa sebelum tuple `('whatsapp',
  ...)`. Diverifikasi ulang dari volume Docker kosong: `INSERT 0 6` untuk `settings`, tanpa galat.
  <br>ℹ️ Pelajarannya: `psql` (dan `docker-entrypoint-initdb.d`) TIDAK memvalidasi isi kolom `json`
  di dalam satu `INSERT` multi-baris secara terpisah per baris — satu baris yang gagal
  membatalkan seluruh pernyataan. Uji manual seed.sql sebelum dipaketkan, bukan hanya dibaca.

- [x] **BE-098** Paket deploy Docker: verifikasi keutuhan berkas sebelum dipakai (21 September 2026)
  <br>*Selesai bila:* client yang menerima paket rusak dapat pesan jelas "unduh ulang", bukan
  galat Docker yang membingungkan.
  <br>🐛 **Kejadian nyata:** `presensee-images.tar` (974MB, 3 image) terbukti valid dan berhasil
  di-`docker load` di mesin pembuatnya, tapi gagal di PC client Windows dengan
  `archive/tar: invalid tar header` — rusak saat kompresi ZIP/transfer/ekstraksi, bukan saat
  dibuat. Karena `docker load` gagal, `docker compose up` lalu diam-diam mencoba MENARIK
  `presensee-api` dari Docker Hub (image custom yang memang tidak pernah ada di sana) dan gagal
  dengan `pull access denied ... repository does not exist` — pesan yang menuduh "aplikasinya
  rusak", padahal penyebab aslinya cuma berkas yang corrupt di jalan.
  <br>✅ Diperbaiki tiga lapis di `tools/buat-paket-deploy.mjs` & `JALANKAN-PRESENSEE.bat`:
  checksum SHA256 (`presensee-images.tar.sha256`) diverifikasi via `certutil` **sebelum**
  `docker load` dicoba sama sekali; sesudah `docker load`, kedua image diverifikasi ulang lewat
  `docker image inspect` secara eksplisit (TIDAK dipercaya dari kode keluar `docker load` saja);
  `presensee.zip` sendiri diverifikasi (`unzip -tq`) segera setelah dibuat, sebelum dikirim ke
  siapa pun.
  <br>✅ `postgres:16-alpine` dikeluarkan dari tar — image publik biasa, `docker compose` menariknya
  sendiri dari Docker Hub. Mengecilkan berkas paling rawan rusak (313MB → 191MB) sekaligus
  mengurangi satu titik gagal.
  <br>🐛 Ditemukan sekalian: `hasCommand()` di skrip packaging memakai `<cmd> --version` untuk cek
  keberadaan perkakas — `unzip --version` sendiri keluar dengan kode bukan-nol (Info-ZIP unzip
  tidak mengenal opsi gaya `--panjang`, tiap huruf di "version" ditafsirkan flag pendek terpisah),
  sehingga verifikasi zip DIAM-DIAM TERLEWAT walau `unzip` terpasang. Diganti memakai
  `which`/`where`.
  <br>✅ Diuji ujung-ke-ujung dari PC "baru" tiruan (image `presensee-*` dihapus total dari Docker
  lokal): checksum cocok → `docker load` → `docker image inspect` kedua image ada → `docker
  compose up` dari volume kosong → login sungguhan `200 OK`.

- [x] **BE-099** `JALANKAN-PRESENSEE.bat`: deteksi Docker Desktop tidak lagi bergantung lokasi instalasi (21 September 2026)
  <br>🐛 Ditemukan setelah BE-096…BE-098 dikirim ulang ke PC client yang sama: skrip bilang
  "[ERROR] Docker Desktop belum terpasang di PC ini!" padahal ikonnya jelas ada di Desktop.
  <br>**Sebabnya:** skrip lama hanya mencari `.exe`-nya di dua lokasi baku (`Program Files\Docker\...`
  dan `Program Files (x86)\Docker\...`). Di PC client, Docker Desktop rupanya terpasang di lokasi
  lain — kemungkinan besar mode instal "tanpa admin" yang menaruhnya di `%LocalAppData%`, umum di
  PC dengan hak akses terbatas. `docker` CLI-nya sendiri terbukti berfungsi normal (semua
  percobaan lain sebelumnya berhasil lewat `docker info`), jadi kesimpulan "belum terpasang" itu
  salah total.
  <br>✅ Diperbaiki berlapis: (1) `docker desktop start` dicoba lebih dulu — subcommand bawaan
  Docker Desktop modern yang menyalakan mesinnya tanpa perlu tahu lokasi `.exe` sama sekali, selama
  CLI `docker` ada di PATH; (2) kalau tidak dikenali (versi lama), dicoba empat lokasi `.exe`,
  termasuk dua folder `%LocalAppData%` yang sebelumnya tidak dicek; (3) batas waktu tunggu 2 menit
  (sebelumnya bisa menunggu selamanya tanpa kepastian); (4) pesan error diperbaiki — tidak lagi
  mengklaim "belum terpasang", melainkan "kemungkinan besar sudah terpasang, buka manual sekali ini".
  <br>🐛 Ditemukan sekalian: kode ASLI memakai `%ProgramFiles(x86)%` langsung di dalam blok
  `if(...) else if(...) else(...)` — tanda kurung yang jadi bagian NAMA variabel itu sendiri bisa
  membingungkan pencocokan kurung blok `cmd.exe` (jebakan batch scripting yang sudah lama dikenal).
  Diperbaiki dengan memindahkan nilainya ke variabel biasa (`%PF86%`) di luar blok dulu.
  <br>✅ Tutorial (`DOKUMENTASI.md` & `PANDUAN-INSTALL-WINDOWS.md`) ditambah dua catatan: (a)
  pemasang Docker Desktop tidak selalu ikut memasang WSL2 — kalau gagal menyala dan pesannya
  menyebut WSL, jalankan `wsl --install` lewat PowerShell Administrator lalu restart; (b) setelan
  "Open Docker Dashboard when Docker Desktop starts" di Settings → General menentukan jendela
  dashboard-nya muncul atau tidak tiap kali dinyalakan — dimatikan sekali, berlaku seterusnya.

- [x] **BE-100** Paket Scanner Agent: `npm run ports` & `npm run build` dari README gagal di paket client (22 September 2026)
  <br>🐛 Ditemukan saat client bertanya "config sudah di-set, ngapain?" — sebelum menjawab, langkah
  README direproduksi ulang di salinan terpisah, dan **`npm run ports` gagal**:
  ```
  > tsx src/cli-ports.ts
  sh: 1: tsx: not found
  ```
  <br>**Sebabnya:** `package.json` dan `README.md` disalin apa adanya dari repo sumber ke paket
  client, tapi `scripts`-nya (`dev`, `build`, `ports`) semua menunjuk ke `src/` dan `tsx` — padahal
  paket client HANYA membawa `dist/` (hasil kompilasi), TANPA `src/`, dan `tsx` adalah
  devDependency yang sengaja tidak ikut `npm install --omit=dev`. Kalau diikuti apa adanya,
  langkah "periksa scanner terbaca" — yang README sendiri sebut sebagai "diagnosa terpenting" —
  justru yang paling dulu gagal.
  <br>✅ `scripts` paket client diganti (bukan lagi disalin apa adanya): `ports` memanggil
  `node dist/cli-ports.js` langsung, `start` tetap `node dist/index.js`, `dev`/`build`/`typecheck`
  dihapus sepenuhnya (tidak berlaku tanpa `src/`). README client ditulis ulang khusus untuk paket
  terkompilasi — bagian "Pemasangan" tidak lagi menyebut `npm run build`.
  <br>✅ Diuji ujung-ke-ujung di salinan terpisah: `npm install --omit=dev` → `npm run ports` →
  benar-benar jalan dan mencetak pesan diagnosa yang semestinya (bukan error `tsx: not found`).
  <br>⚠️ `node_modules` hasil instalasi uji **dihapus lagi sebelum di-zip** — `serialport` punya
  binding native yang dikompilasi untuk OS tempat `npm install` dijalankan; kalau ikut terkirim
  dari mesin Linux, binding-nya tidak akan jalan sama sekali di Windows client.

- [x] **BE-101** `JALANKAN-PRESENSEE.bat`: Scanner Agent disiapkan otomatis (config.json, `npm install`, cek service) (22 September 2026)
  <br>*Selesai bila:* klik 2x `JALANKAN-PRESENSEE.bat` cukup untuk menyiapkan Scanner Agent
  sampai tinggal satu langkah manual (pasang layanan sekali, butuh admin).
  <br>**Kenapa perlu:** sebelumnya client harus mengetik manual `npm install --omit=dev`, membuat
  `config.json` sendiri, dan menebak isinya. Untuk skenario All-in-One (Scanner Agent di PC yang
  sama dengan Docker), nilai `apiUrl`/`apiKey` yang benar SELALU sama (cocok dengan
  `docker-compose.yml`), jadi tidak ada alasan itu manual.
  <br>✅ Ditambahkan sebagai langkah `[4/4]`, dilewati (bukan gagal) kalau paket ini tidak membawa
  Scanner Agent terkompilasi atau Node.js tidak terpasang: (1) `config.json` dibuat otomatis
  **hanya kalau belum ada** (tidak menimpa setelan manual PC 2 di skenario multi-gerbang); (2)
  `npm install --omit=dev` dijalankan otomatis kalau `node_modules` belum ada; (3) status layanan
  Windows dicek (`sc query`) dan dinyalakan kalau sudah terpasang tapi berhenti.
  <br>⚠️ **Memasang** layanan (`install-service.bat`) TETAP manual, butuh diklik "Run as
  administrator" sendiri — itu proteksi Windows yang tidak bisa/tidak boleh dipaksa diam-diam dari
  skrip yang tidak berjalan sebagai admin. Cukup sekali seumur hidup PC; sesudahnya service-nya
  auto-start sendiri tiap boot, dan langkah `[4/4]` di atas tinggal menegaskan statusnya.
  <br>🐛 **Ditemukan sendiri sebelum sempat dikirim ke client:** baris komentar `REM` yang
  menuliskan `install-service.bat > Run as administrator` (untuk dokumentasi cara membukanya)
  ternyata membuat `cmd.exe` memproses tanda `>` itu sebagai redirection SUNGGUHAN — `REM` tidak
  melindungi dari itu, bahkan di dalam komentar. Diam-diam akan membuat berkas kosong bernama
  `Run` tiap kali skrip dijalankan. Diperbaiki dengan menulis ulang kalimatnya tanpa karakter
  `< > | &` mentah sama sekali di baris `REM` mana pun.

- [x] **BE-102** `config.json` Scanner Agent diisi nilai asli langsung di paket deploy, bukan cuma
  `config.example.json` (23 September 2026)
  <br>*Selesai bila:* skenario All-in-One (Scanner Agent satu PC dengan Docker) tidak perlu client
  menyalin & mengisi `config.example.json` sendiri — `apiUrl`/`apiKey` sudah benar begitu paket
  diekstrak.
  <br>**Kenapa perlu:** nilainya SELALU sama untuk skenario ini (cocok persis dengan
  `docker-compose.yml`), jadi mengharuskan client mengisi manual cuma menambah satu langkah yang
  bisa salah ketik tanpa manfaat.

- [x] **BE-103** `install-service.bat`: Node.js dipasang otomatis kalau belum ada — dua lapis
  fallback (winget, lalu unduhan MSI langsung dari nodejs.org) (23 September 2026)
  <br>*Selesai bila:* client yang belum punya Node.js tidak berhenti total di `install-service.bat`
  — skrip mencoba memasangnya sendiri dulu sebelum menyerah ke instruksi manual.
  <br>✅ Lapis 1: `winget install --id OpenJS.NodeJS.LTS`. Lapis 2: kalau `winget` tidak ada/gagal,
  unduh installer resmi dari `nodejs.org/dist/index.json` (rilis LTS terbaru) lewat PowerShell —
  dipilih karena PowerShell selalu ada sejak Windows 7, sementara Chocolatey (alternatif yang
  sempat dipertimbangkan) sama-sama tidak terpasang bawaan dan butuh bootstrap `irm | iex`
  tambahan (permukaan risiko baru, bukan solusi lebih sederhana) — lalu pasang diam-diam lewat
  `msiexec /quiet`. Skrip PowerShell-nya ditulis LANGSUNG di dalam `install-service.bat` lewat
  `powershell -EncodedCommand <base64>` (bukan berkas `.ps1` terpisah) — lihat BE-105 untuk alasan
  desain ulang ini.
  <br>🐛 Header komentar `REM` di baris 4 juga menuliskan `(klik kanan > Run as administrator)` —
  bug redirection yang sama seperti temuan BE-101, di berkas yang berbeda. Diperbaiki dengan kalimat
  tanpa karakter `>` mentah.
  <br>⚠️ **Diverifikasi di PC client sungguhan (23 September 2026):** lapis winget terbukti jalan
  (pesan `[INFO] ... lewat winget` muncul di terminal client), tapi PC itu ternyata tidak punya
  `winget` terpasang sama sekali (bukan gagal — memang tidak ada), sehingga jatuh ke instruksi
  manual. Lapis 2 (unduhan MSI langsung) ditambahkan justru karena temuan ini — **belum sempat
  diuji di PC client sungguhan**, package ID `OpenJS.NodeJS.LTS` untuk winget juga masih belum
  terverifikasi kalau winget-nya tersedia.
  <br>🐛 **Ditemukan sendiri:** perbaikan winget sempat hanya menyentuh berkas sumber
  `apps/scanner-agent/install-service.bat`, tidak ikut tersalin ke salinan yang sudah diekstrak di
  `presensee/apps/scanner-agent/`, yang justru berkas yang dikirim ke client — client sempat
  menerima versi lama tanpa disadari. Pelajaran: setiap edit ke `apps/scanner-agent/*` atau `*.bat`
  di root harus ditegaskan tersalin ke salinan `presensee/` yang sudah diekstrak (lewat `diff`),
  jangan diasumsikan sudah sinkron dari sesi sebelumnya.

- [x] **BE-104** Teks `echo` di berkas `.bat` yang memakai tanda hubung panjang (em dash `—`)
  tampil rusak di `cmd.exe` (23 September 2026)
  <br>*Selesai bila:* pesan yang dicetak `install-service.bat` dan `JALANKAN-PRESENSEE.bat` terbaca
  normal di client, bukan `ЃГ` atau karakter acak lain.
  <br>**Kenapa perlu:** `cmd.exe` membaca berkas `.bat` dengan code page OEM bawaan (bukan UTF-8)
  kecuali `chcp 65001` dijalankan lebih dulu — karakter multi-byte seperti em dash langsung tampil
  rusak. Ditemukan dari tangkapan layar client sungguhan. Diganti tanda hubung biasa (`-`) di semua
  baris `echo` (baris `REM`, yang tidak pernah tampil ke layar, sengaja dibiarkan).

- [x] **BE-105** `pasang-nodejs.ps1` (lapis 2 Node.js di BE-103) digabung langsung ke dalam
  `install-service.bat`, bukan berkas terpisah (23 September 2026)
  <br>*Selesai bila:* `install-service.bat` bisa disalin SENDIRIAN ke PC client (satu berkas) dan
  tetap berfungsi penuh, termasuk lapis 2 pemasangan Node.js.
  <br>🐛 **Ditemukan dari client sungguhan:** `PowerShell -File "...\pasang-nodejs.ps1"` gagal dengan
  `The argument '...\pasang-nodejs.ps1' to the -File parameter does not exist` — client
  mentransfer `install-service.bat` saja lewat scp satu-berkas (pola yang sama seperti temuan
  sebelumnya di BE-103), tidak ikut menyalin `pasang-nodejs.ps1` yang baru ditambahkan bersamanya,
  karena berkas itu memang belum pernah ada di PC client sebelumnya. Pola transfer satu-berkas ini
  sudah dua kali menyebabkan masalah — bukan sesuatu yang bisa diasumsikan hilang ke depannya.
  <br>✅ Skrip PowerShell dikodekan base64 (UTF-16LE, sesuai yang diharapkan `-EncodedCommand`) dan
  ditempel langsung sebagai argumen `powershell -EncodedCommand <base64>` di `install-service.bat`.
  Ini juga sekaligus menghindari seluruh masalah quoting cmd.exe/PowerShell bersarang yang muncul
  kalau kode PowerShell ditulis manual sebagai satu baris `-Command` panjang. `pasang-nodejs.ps1`
  dan referensinya di `buat-paket-deploy.mjs` (daftar berkas Scanner Agent yang disalin) dihapus.
  <br>⚠️ **Belum diuji di PC client sungguhan** — perlu konfirmasi lapis 2 benar-benar mengunduh dan
  memasang Node.js sebelum dianggap tuntas.

- [x] **BE-106** `install-service.bat`: path `node.exe` untuk NSSM ditebak dari lokasi baku,
  bukan dicari sungguhan (23 September 2026)
  <br>*Selesai bila:* `nssm start PresenSeeScannerAgent` tidak lagi gagal dengan `Unexpected status
  SERVICE_STOPPED in response to START control` pada PC yang Node.js-nya terpasang di luar
  `%ProgramFiles%\nodejs`.
  <br>🐛 **Ditemukan dari client sungguhan:** `nssm install` sebelumnya selalu memakai
  `"%ProgramFiles%\nodejs\node.exe"` mentah-mentah sebagai path executable, padahal pengecekan
  `NODE_ADA` di atasnya cuma memastikan `node` ADA di PATH (`where node`), bukan memastikan dia ADA
  persis di lokasi itu. Instalasi lewat winget atau MSI (BE-103) tidak selalu berakhir di path baku
  itu — hasilnya `nssm install` "berhasil" (tidak ada pesan galat sama sekali), tapi layanannya mati
  seketika begitu di-start karena executable yang dirujuk tidak ada di path tersebut.
  <br>✅ Path `node.exe` yang sungguhan sekarang dicari lewat `where node` (baris pertama hasilnya)
  sebelum `nssm install` dipanggil, dengan fallback ke `%ProgramFiles%\nodejs\node.exe` kalau
  `where` gagal; kalau keduanya tidak ketemu, skrip berhenti dengan pesan jelas alih-alih lanjut ke
  `nssm install` dengan path yang mungkin salah.
  <br>⚠️ **Dikonfirmasi BUKAN akar masalah di kasus client yang melapor** — `where node` di PC itu
  menunjukkan node.exe memang persis di `%ProgramFiles%\nodejs\node.exe` sejak awal. Perbaikan ini
  tetap berguna untuk PC lain yang instalasinya di lokasi berbeda, tapi akar masalah client ini
  ternyata BE-107 di bawah. Pelajaran: jangan berhenti di kecurigaan pertama yang masuk akal —
  tetap butuh bukti langsung (log Windows) untuk sebab sesungguhnya.

- [x] **BE-107** `install-service.bat`: `nssm set AppDirectory "%~dp0"` membuat service GAGAL START
  di SEMUA PC — akar masalah sesungguhnya di balik seluruh rentetan `SERVICE_STOPPED` yang dilaporkan
  client (23 September 2026)
  <br>*Selesai bila:* `nssm start PresenSeeScannerAgent` berhasil (`SERVICE_RUNNING`) di PC client
  yang sebelumnya gagal terus, di drive mana pun.
  <br>🐛 **Ditemukan dari Windows Event Viewer client** (Application log, Source `nssm`, Event 1010):
  `Program C:\Program Files\nodejs\node.exe couldn't be launched. CreateProcess() failed: The
  directory name is invalid.` — bukan soal node.exe atau `node_modules` (BE-103/BE-106 sempat
  dicurigai lebih dulu dan diperbaiki, tapi ternyata tidak relevan di kasus ini), dan bukan soal
  drive `D:` vs `C:` (diuji ulang persis di `C:`, hasilnya identik).
  <br>**Akar masalahnya:** `%~dp0` SELALU diakhiri backslash (`C:\scanner-agent\`). Ditulis
  `nssm set PresenSeeScannerAgent AppDirectory "%~dp0"`, Windows membaca `\"` di ujung itu sebagai
  ESCAPE untuk tanda kutipnya — bukan penutup string — sehingga argumen yang benar-benar diterima
  nssm adalah path dengan tanda kutip literal nyasar di dalamnya (bukan path yang valid). nssm
  "berhasil" menyetel AppDirectory (tidak ada pesan galat saat `nssm set`), tapi nilainya sudah
  rusak, dan CreateProcess menolaknya setiap kali service dicoba di-start — persis cocok dengan
  gejala `Unexpected status SERVICE_STOPPED in response to START control` yang berulang SEJAK AWAL
  di seluruh sesi troubleshooting ini, di D: maupun C:, sebelum maupun sesudah BE-103/106.
  <br>✅ Diganti jadi `"%~dp0."` (tambah titik di akhir) — mengacu ke folder yang SAMA persis, tapi
  tidak lagi diakhiri backslash mentah sebelum tanda kutip penutup, jadi bug parsing-nya tidak
  ketrigger. Disapu ulang seluruh berkas untuk pola `"%~dp0"` yang sama — cuma satu kejadian,
  sudah diperbaiki.
  <br>✅ **Dikonfirmasi di PC client sungguhan:** `nssm status` → `SERVICE_RUNNING` setelah
  `install-servicenew.bat` dijalankan ulang.

- [x] **BE-108** Lampiran presensi (foto surat izin/sakit) — kolom baru + endpoint upload/lihat/hapus
  (23 September 2026)
  <br>*Selesai bila:* admin bisa melampirkan foto JPG/PNG ke baris presensi IZIN/SAKIT, mengambilnya
  lagi, dan menghapusnya — diverifikasi ujung-ke-ujung (bukan cuma dibaca kodenya).
  <br>✅ Kolom baru `attendance.attachment_path` (migrasi `008_lampiran_presensi_manual.sql`,
  nullable, TIDAK melanggar aturan 8-tabel — cuma kolom biasa). Tiga endpoint baru di
  `presensi.routes.ts`, pola disalin persis dari `foto.routes.ts` (foto siswa) yang sudah ada:
  `multer` memory storage, jenis berkas diperiksa dari **magic bytes** (bukan `Content-Type`,
  yang bisa dipalsukan klien), nama berkas `${id}${ext}` di `storage/presensi/`, endpoint GET-nya
  butuh sesi masuk (data pribadi anak) dan memvalidasi ulang pola nama berkas sebelum dipakai jadi
  path (jaga-jaga dari path traversal kalau nilai di DB pernah diutak-atik).
  <br>✅ **Diuji ujung-ke-ujung** lewat stack Docker sekali-pakai terpisah (bukan cuma unit/typecheck):
  login sungguhan → tandai SAKIT → unggah JPEG asli → unduh lagi → **byte-identik** dengan aslinya →
  konfirmasi `punyaLampiran` benar di `GET /attendance` → berkas ADA di volume host yang di-mount →
  hapus → GET jadi 404 → berkas HILANG dari host. Juga diuji: berkas bukan gambar (teks polos
  berekstensi `.jpg`) ditolak `BAD_REQUEST` sesuai magic-byte check, dan id presensi yang tidak ada
  mengembalikan 404 (bukan 500).
  <br>🐛 **Ditemukan sendiri lewat pengujian di atas** (bukan sekadar dibaca kodenya) — lihat BE-109:
  upload pertama kali gagal `EACCES` karena bug path storage yang SUDAH ADA SEBELUM fitur ini
  ditulis, di fitur foto siswa yang sama polanya.

- [x] **BE-109** `STORAGE_PATH`/`WA_SESSION_PATH` di Docker resolve ke path yang BUKAN volume
  persisten — sesi WhatsApp & foto/lampiran bisa hilang tiap container di-recreate (23 September 2026)
  <br>*Selesai bila:* berkas yang ditulis lewat `STORAGE_PATH`/`WA_SESSION_PATH` benar-benar
  mendarat di volume host yang di-mount, bukan di lapisan container yang sekali pakai.
  <br>🐛 **Ditemukan sendiri saat menguji BE-108 end-to-end** (bukan laporan client) — upload
  lampiran gagal `EACCES: permission denied, mkdir '/app/storage'`. Diselidiki: `env.ts` men-default
  `STORAGE_PATH` ke `./storage` dan `WA_SESSION_PATH` ke `./storage/wa-session` — path RELATIF ini
  benar untuk dev lokal (proses jalan dari `apps/api/`, jadi resolve ke `apps/api/storage/`, persis
  folder yang di-mount `docker-compose.yml`), tapi SALAH di dalam container: `WORKDIR` prosesnya
  `/app` (lihat `apps/api/Dockerfile`), jadi path relatif yang sama resolve ke `/app/storage` —
  BUKAN `/app/apps/api/storage` yang sungguhan di-mount persisten.
  <br>⚠️ **Ini bug lama, bukan yang baru dibuat BE-108** — sudah ada sejak fitur foto siswa
  (BE-025) ditulis, cuma tidak pernah ketahuan karena fitur itu tidak pernah dipakai frontend-nya
  (lihat FE, `photo_path` tidak pernah diisi) DAN sesi WhatsApp di paket client masih `dummy`
  (`WA_PROVIDER` tidak diset ke `baileys` di `docker-compose.yml` manapun — lihat catatan di
  bawah), jadi belum pernah ada yang benar-benar menulis ke path yang salah itu di deployment
  sungguhan sampai BE-108 mencobanya.
  <br>✅ Diperbaiki dengan menyetel `STORAGE_PATH: /app/apps/api/storage` dan
  `WA_SESSION_PATH: /app/apps/api/storage/wa-session` eksplisit di `environment:` service `api`
  pada `docker-compose.yml` (source) dan `presensee/docker-compose.yml` (paket client) — BUKAN
  mengubah default di `env.ts`, supaya dev lokal (yang sudah benar) tidak ikut rusak.
  <br>✅ **Diverifikasi ulang** setelah perbaikan: container di-recreate dengan env baru, upload
  lampiran berhasil, berkas ADA di direktori host yang di-mount (bukan cuma di dalam container).
  <br>📌 **Catatan terpisah, bukan bug:** paket `presensee/docker-compose.yml` tidak pernah
  menyetel `WA_PROVIDER: baileys` di mana pun, jadi WhatsApp di deployment client SELALU jalan
  mode `dummy` (pesan cuma dicatat log, tidak benar-benar terkirim) sampai seseorang menambahkannya
  manual. Belum tentu ini perlu diperbaiki — bisa jadi memang sengaja untuk fase uji coba (lihat
  memori sesi: "jangan sampai WhatsApp terkirim saat uji"). Dibiarkan apa adanya, tidak diubah
  tanpa diminta.

- [x] **BE-110** PDF Matriks Bulanan per Kelas: kolom Nama dibatasi lebar, label bulan ditulis
  nama bukan angka (24 September 2026)
  <br>*Selesai bila:* PDF-nya diverifikasi ulang dari API sungguhan (bukan cuma dibaca kodenya).
  <br>✅ Kolom Nama Siswa sebelumnya menyerap SEMUA sisa lebar per blok tanggal — pada blok yang
  harinya sedikit (mis. 21 hari terbagi rata jadi dua blok 11 hari), kolom itu bisa melebar ratusan
  poin. Dibatasi maksimal 130pt (`LEBAR_NAMA_MAKS`).
  <br>🔁 **Sempat dicoba, lalu dibatalkan:** kertas diganti dari A4 ke F4/Folio (612×936pt) supaya
  lebih banyak kolom tanggal muat per blok. Diuji, TERNYATA tidak mengurangi jumlah halaman untuk
  kasus 32 siswa/30 hari — lebar kertas cuma mempengaruhi berapa banyak KOLOM tanggal muat per blok
  (F4 tidak mengubah itu untuk 30 hari, karena 2 blok sudah cukup di A4 maupun F4), sedangkan 4
  halaman yang muncul itu penyebab utamanya jumlah BARIS siswa (32) yang memang tidak muat 1
  halaman — dua hal berbeda, lebar kertas tidak membantu yang kedua. Dikembalikan ke A4 atas
  permintaan pemilik proyek setelah penjelasan ini; `buatDok()` kembali ke bentuk semula (tanpa
  parameter ukuran kertas, karena jadi tidak terpakai).
  <br>✅ `${bulan}` mentah ("2026-09") diganti fungsi `labelBulan()` baru ("September 2026") di
  tiga tempat: judul blok pertama, judul blok lanjutan, dan laporan Rekap Bulanan per Siswa
  (`Periode ...`) yang punya bug sama. `BULAN` (daftar nama bulan) diekspor dari
  `modules/whatsapp/template.ts` supaya tidak menduplikasi array yang sama untuk ketiga kalinya.
  <br>✅ **Diverifikasi lewat PDF sungguhan** dari dev API (login, generate, baca ulang) — bukan
  cuma dibaca kodenya: kolom Nama sudah ringkas, header sudah "Kelas VII-A • September 2026".

- [x] **BE-111** Paket deploy NATIVE (Node.js + PostgreSQL + NSSM, tanpa Docker) — rencana di
  `docs/DEPLOY-NATIF.md`, dibangun sebagai `presensee_build/` (24 September 2026)
  <br>*Selesai bila:* paket bisa dibuat lewat `node tools/buat-paket-native.mjs`, terpisah total
  dari paket Docker (`presensee.zip`) — tidak saling menimpa.
  <br>✅ `database/seed-esensial.sql` baru (akun login + setelan saja, TANPA kelas/siswa contoh)
  — dipasangkan dengan `seed.sql` + `contoh-multi-kelas.sql` yang sudah ada untuk jalur "ya, data
  contoh". **Diuji sungguhan** kedua jalur di database sekali-pakai terpisah: esensial → 2 users,
  6 settings, 0 baris lain; penuh → 3+30+28 siswa lintas 3 kelas dengan presensi sampai hari ini.
  `install.bat` menanyakan Y/N saat instalasi dan menjalankan skrip yang sesuai.
  <br>🐛 **Ditemukan sendiri, diperbaiki sebelum sempat dikirim:** `.next/standalone` hasil build
  di mesin Linux membawa `sharp` terkompilasi untuk Linux (`@img/sharp-linux-x64`) — kalau
  dijalankan di Windows tanpa pernah dipakai `next/image` itu sebenarnya aman, tapi tetap
  dikeluarkan total lewat `outputFileTracingExcludes` di `next.config.ts` (yang aktif dulu
  ternyata TIDAK cukup) — 100% bebas binary native sekarang, diverifikasi (`find -iname "*.node"`
  kosong).
  <br>🐛 **Ditemukan sendiri:** `@siklon/shared: "workspace:*"` di `package.json` API tidak
  dimengerti `npm install` biasa (protokol pnpm) — diganti `file:../../shared` di package.json
  yang dipaketkan, merujuk salinan `packages/shared/dist` yang dibundel sebagai folder sendiri.
  <br>⚠️ **Node.js/PostgreSQL untuk API TIDAK dibundel node_modules-nya** — sengaja: dependensi
  native (`@node-rs/argon2`) yang dikompilasi di Linux tidak akan jalan di Windows (pelajaran
  BE-100 untuk Scanner Agent, dipakai lagi di sini). `install.bat` menjalankan
  `npm install --omit=dev` SUNGGUHAN di PC Windows saat pemasangan, supaya npm mengambil binary
  platform yang benar sendiri.
  <br>✅ Keempat `.bat` (`install`, `jalankan`, `hentikan`, `uninstall`) disapu ulang untuk SEMUA
  pola bug yang sudah ditemukan sepanjang sesi ini: karakter `< > | &` mentah di baris `REM`
  ATAU `echo` (baik di dalam maupun di luar blok `(...)`), em dash di baris `echo`, backslash
  mentah sebelum tanda kutip penutup pada argumen ke proses eksternal (`AppDirectory` NSSM, pola
  `"%~dp0apps\api."` — titik di akhir, sama seperti BE-107), dan path `node.exe`/`psql.exe`
  dicari sungguhan bukan ditebak dari lokasi baku.
  <br>✅ Password PostgreSQL dibuat pakai `%RANDOM%` bawaan cmd.exe, BUKAN PowerShell dengan pipe
  bersarang di dalam tanda kutip di dalam blok `(...)` — pola itu awalnya dipakai, disadari
  berisiko tinggi (persis kelas bug yang sudah berulang kali ditemukan sesi ini), diganti sebelum
  sempat dikirim.
  <br>⚠️ **BELUM DIUJI DI WINDOWS SUNGGUHAN** — tidak seperti bagian SQL (diuji nyata di database
  sekali-pakai) dan build web/api (diuji nyata, `sharp` dikonfirmasi hilang), keempat `.bat` dan
  flag silent-install PostgreSQL (`--mode unattended --superpassword ...`) cuma diverifikasi lewat
  pembacaan kode & penyapuan pola bug yang sudah diketahui — TIDAK bisa dijalankan sungguhan dari
  mesin Linux ini. Kemungkinan besar masih ada bug yang cuma ketahuan di percobaan pertama di PC
  Windows sungguhan, persis seperti pola berulang sepanjang sesi ini (BE-103 s.d. BE-107).

- [x] **BE-112** `install.bat` — perbaikan dari percobaan pertama sungguhan di PC Windows (29
  September 2026)
  <br>*Selesai bila:* akar masalah "terminal tertutup sendiri tanpa pesan" ditemukan & diperbaiki,
  bukan cuma ditambal gejalanya.
  <br>🐛 **Ditemukan dari client sungguhan:** setelah selesai memasukkan data contoh, terminal
  tertutup sendiri tanpa pesan apa pun — NSSM tidak sempat terpasang, prompt Scanner Agent (langkah
  6) tidak pernah muncul. **Akar masalah yang paling mungkin** (tidak bisa dipastikan 100% dari
  Linux, tapi persis pola yang sudah dua kali ditemukan sesi ini): `goto` yang melompat KELUAR dari
  blok tanda kurung `( ... )` — dipakai di bagian NSSM dan bagian Database — pola yang sudah
  ditandai berisiko sejak lebih awal (itu sebabnya `JALANKAN-PRESENSEE.bat` sudah lebih dulu
  memakai variabel penanda, bukan goto/label, untuk alasan yang sama). Kedua bagian ditulis ulang
  memakai pola variabel penanda (`if not defined ...`), goto dihapus total kecuali di bagian
  Node.js yang terbukti jalan baik di percobaan sungguhan ini (dibiarkan).
  <br>✅ **Log otomatis** ke `install-log.txt` — checkpoint penting (tiap langkah, [OK]/[GAGAL],
  status NSSM start) dicatat lewat `>>"file" echo` di baris terpisah dari `echo` layar biasa,
  BUKAN lewat redirect `> file 2>&1` menyeluruh — supaya form Y/N dan password tetap tampil normal
  di layar (redirect menyeluruh sempat dicoba client sebagai diagnosis manual dan terbukti
  menyembunyikan promptnya, walau tetap menunggu ketikan).
  <br>✅ **Urutan diubah**: Node.js → NSSM → PostgreSQL (diminta pemilik proyek) → Database.
  <br>✅ **Password PostgreSQL diubah dari acak jadi tetap** (`p0stgr3sql`, diminta pemilik
  proyek) — predictable tiap install ulang (mis. saat uji coba: uninstall lalu pasang lagi), dan
  tetap aman ditulis langsung ke command-line installer (murni alfanumerik, tidak ada karakter
  yang bisa merusak baris perintah — pelajaran yang sama seperti alasan password acak sebelumnya).
  Kalau PostgreSQL yang sudah ada BUKAN dari skrip ini (password tetap tidak cocok), otomatis
  jatuh ke tanya manual — dicoba dulu lewat `psql -c "SELECT 1"` sungguhan, bukan diasumsikan.
  <br>✅ NSSM diverifikasi sungguhan (berkas benar-benar ada di path yang ditemukan) dan hasil
  `nssm status` API/Web ikut dicatat ke log.
  <br>⚠️ **Belum ada konfirmasi ulang dari client** bahwa percobaan berikutnya berhasil sampai
  selesai — perbaikan ini berdasarkan diagnosis terbaik yang bisa dilakukan dari gejala yang
  dilaporkan, bukan reproduksi langsung (tidak bisa menjalankan Windows dari mesin ini).

- [x] **BE-113** `install.bat` — akar masalah SEBENARNYA di balik "terminal tertutup sendiri"
  ditemukan lewat client sungguhan (30 September 2026)
  <br>*Selesai bila:* client menjalankan `install.bat` yang diperbaiki dan proses lanjut sampai
  ke NSSM + Scanner Agent tanpa terputus. **Terpenuhi** — client mengonfirmasi lewat tangkapan
  layar proses lanjut sampai langkah [6/6] Scanner Agent.
  <br>🐛 **Ditemukan dari client sungguhan (tangkapan layar persis di baris yang macet):** dua
  pemanggilan `"%NPM_CMD%" install` di langkah [5/6] (untuk `shared/` dan `apps/api/`) tidak
  memakai `call`. `npm.cmd` di Windows adalah berkas `.cmd`, bukan `.exe` — memanggil berkas
  `.bat`/`.cmd` dari dalam skrip `.bat` lain TANPA `call` menyerahkan kendali ke situ selamanya:
  begitu proses npm selesai, seluruh jendela `cmd.exe` ikut tertutup, `install.bat` tidak pernah
  kembali melanjutkan ke baris sesudahnya. Ini persis cocok dengan gejala yang dilaporkan: tulisan
  "[5/6] Memasang dependensi..." muncul, lalu jendela langsung tertutup tanpa pesan.
  <br>✅ Diperbaiki dengan menambah `call` di kedua pemanggilan. Seluruh berkas `.bat` lain di
  paket ini diperiksa ulang (`grep` untuk pemanggilan `.bat`/`.cmd`) — tidak ada yang kelewatan
  selain dua ini.
  <br>ℹ️ BE-112 (dugaan `goto` keluar blok kurung) tetap dipertahankan sebagai perbaikan yang sah
  dan tidak berbahaya, tapi BE-113 ini yang terbukti jadi penyebab utama sungguhan — dikonfirmasi
  langsung dari lokasi persis tempat client melaporkan macetnya (bukan cuma dugaan pola berulang).

- [x] **BE-114** `install.bat` — dua perbaikan lanjutan dari percobaan client berikutnya (30
  September 2026)
  <br>*Selesai bila:* dua gejala baru yang dilaporkan client (npm EPERM saat symlink, dan pesan
  "[OK]" yang tidak benar-benar memverifikasi layanan) ditangani.
  <br>🐛 **Ditemukan dari client sungguhan:** setelah perbaikan BE-113, percobaan berikutnya (di
  atas folder `presensee_build` yang SAMA, cuma `install.bat`-nya ditimpa, bukan folder bersih)
  gagal dengan `npm error EPERM ... symlink 'D:\presensee_build\shared' ->
  '...\apps\api\node_modules\@siklon\shared'`, didahului peringatan `npm warn cleanup Failed to
  remove some directories` di `node_modules\@fast-csv\...`. Penyebabnya: `apps\api\node_modules`
  dari percobaan GAGAL sebelumnya (sebelum BE-113) masih tertinggal di folder itu, sebagian
  berkasnya mengganjal saat npm mencoba membuat ulang symlink `@siklon/shared` di lokasi yang
  sama. **Ini bukan bug baru di skrip, tapi konsekuensi dari saran saya sendiri** (menimpa satu
  berkas `install.bat` saja tanpa membersihkan `node_modules` lama) — dampaknya nyata: dependensi
  `apps/api` kemungkinan besar TIDAK lengkap terpasang di percobaan itu.
  <br>✅ Ditambahkan pembersihan defensif: `apps\api\node_modules\@siklon\shared` dihapus dulu
  (kalau ada) sebelum `npm install` dijalankan, supaya lokasi symlink selalu kosong — aman
  dijalankan berkali-kali, bukan cuma untuk kasus ini.
  <br>🐛 **Ditemukan sendiri lewat pembacaan kode:** pesan "[OK] Layanan terpasang dan
  dijalankan." tercetak TANPA SYARAT (tidak pernah mengecek apakah `nssm install`/`start`
  benar-benar berhasil) — jadi tidak bisa dipakai untuk memastikan layanan sungguhan sehat,
  padahal client sempat melihat banyak baris `Can't open service! OpenService(): The specified
  service does not exist as an installed service.` tepat sebelum pesan "[OK]" itu (kemungkinan
  besar sisa registrasi layanan dari percobaan sebelumnya yang gagal, bukan bug baru — tapi tidak
  bisa dipastikan tanpa log `nssm status` yang sebenarnya).
  <br>✅ Diganti jadi pengecekan sungguhan: tunggu 3 detik (beri waktu proses yang crash-loop
  ketahuan), lalu cek `nssm status PresenSeeApi`/`PresenSeeWeb` sungguhan — cetak "[OK]" hanya
  kalau KEDUANYA `SERVICE_RUNNING`, kalau tidak cetak "[PERINGATAN]" beserta cara mengecek log
  error (`apps\api\log\api.log`, `apps\web\log\web.log`).
  <br>✅ **Dikonfirmasi dari client sungguhan** (30 September 2026, folder diekstrak bersih dari
  zip baru): `npm install` `apps/api` selesai bersih (350 paket, tanpa `EPERM`), dan registrasi
  NSSM untuk kedua layanan (`PresenSeeApi`, `PresenSeeWeb`) berhasil total tanpa satu pun pesan
  `Can't open service!` — mengonfirmasi dugaan sebelumnya bahwa masalah itu memang dari sisa
  keadaan folder yang tidak bersih, bukan bug baru di skrip.

- [x] **BE-115** Dua bug lagi dari langkah [6/6] Scanner Agent dan `jalankan.bat`, ditemukan dari
  client sungguhan (30 September 2026)
  <br>*Selesai bila:* Scanner Agent terpasang tidak lagi `SERVICE_PAUSED`, dan `jalankan.bat` tidak
  menampilkan "Access is denied" saat dipanggil tanpa hak Administrator.
  <br>🐛 **Ditemukan dari client sungguhan:** setelah `install.bat` sampai [6/6] dan menjawab Y
  untuk Scanner Agent, layanannya terpasang tapi log `install.bat` menunjukkan
  `PresenSeeScannerAgent: Unexpected status SERVICE_PAUSED in response to START control.` — nssm
  memasukkan layanan ke status paused karena prosesnya berulang kali crash dalam waktu singkat
  (mekanisme anti-restart-loop bawaan nssm). **Akar masalah:** `apps/scanner-agent/install-service.bat`
  tidak pernah menjalankan `npm install` — paket yang dikirim cuma berisi `dist/` (hasil kompilasi
  TypeScript), bukan `node_modules`. Dependensinya (`serialport`) adalah modul NATIVE yang harus
  benar-benar di-install di PC Windows itu sendiri, persis pelajaran yang sama seperti
  `@node-rs/argon2` di `apps/api` (BE-111) — jadi `dist\index.js` gagal `MODULE_NOT_FOUND` setiap
  kali dicoba dijalankan.
  <br>✅ Ditambahkan langkah `npm install --omit=dev` di `install-service.bat` sebelum registrasi
  nssm (dijalankan sekali saja, dilewati kalau `node_modules` sudah ada) — diperbaiki di skrip
  `apps/scanner-agent/install-service.bat` itu sendiri (bukan cuma di `install.bat`), karena skrip
  yang sama juga dipakai berdiri sendiri di **Skenario B — Client Saja** (PC gerbang tambahan yang
  tidak pernah menjalankan `install.bat` sama sekali).
  <br>🐛 **Ditemukan sendiri lewat pembacaan kode**, dipicu tangkapan layar client yang menunjukkan
  `jalankan.bat` gagal dengan `Can't open service! OpenService(): Access is denied.` untuk kedua
  layanan API dan Web: `jalankan.bat` (beda dari `install.bat`/`uninstall.bat`) tidak pernah
  mengecek hak Administrator, padahal query/start layanan Windows lewat nssm butuh hak itu. Kalau
  dipanggil tanpa admin (mis. lewat pintasan di folder Startup sesuai anjuran panduan install),
  semua query itu gagal "Access is denied" walau layanannya sendiri sehat (statusnya sudah
  `SERVICE_AUTO_START`, jadi memang tidak butuh `jalankan.bat` untuk menyala). Pesan akhir "[OK]"
  juga tercetak tanpa syarat, sama seperti bug BE-114 sebelumnya tapi di berkas berbeda.
  <br>✅ **Sengaja TIDAK dipaksa jadi "Run as administrator"** — `jalankan.bat` ditaruh di folder
  Startup untuk buka browser otomatis saat boot, dan UAC yang minta klik "Yes" tiap boot akan
  merepotkan di PC kios tanpa pengawasan. Sebagai gantinya: dicek levelnya dulu, kalau admin
  jalankan pengecekan/start layanan seperti biasa, kalau bukan admin bagian itu dilewati dengan
  pesan informatif ("layanan seharusnya sudah menyala sendiri, klik kanan untuk mode admin kalau
  mau memaksa").
  <br>⚠️ **Belum ada konfirmasi ulang dari client** bahwa Scanner Agent sekarang `SERVICE_RUNNING`
  (bukan `SERVICE_PAUSED`) dan `jalankan.bat` tidak lagi menampilkan "Access is denied".

- [x] **BE-116** `npm install` `apps/api` gagal `EPERM` LAGI di client sungguhan meski folder
  sudah diekstrak bersih (30 September 2026)
  <br>*Selesai bila:* mekanisme percobaan ulang otomatis ada untuk kegagalan npm yang bersifat
  sesaat, bukan cuma dugaan akar masalah yang tidak terbukti.
  <br>🐛 **Ditemukan dari client sungguhan:** persis error `EPERM ... symlink
  '...\shared' -> '...\apps\api\node_modules\@siklon\shared'` yang sama seperti BE-114 muncul
  LAGI, kali ini di folder yang BENAR-BENAR baru diekstrak dari zip bersih (bukan folder lama yang
  ditimpa) — membuktikan dugaan BE-114 ("sisa folder dari percobaan gagal sebelumnya") SALAH atau
  setidaknya tidak lengkap. npm sendiri mencurigai penyebab yang berbeda di pesan errornya: *"It's
  possible that the file was already in use (by a text editor or antivirus)"* — pola yang sangat
  dikenal di Windows: antivirus real-time (mis. Windows Defender) memindai berkas yang baru saja
  ditulis npm dalam window waktu singkat, dan operasi filesystem berikutnya (rmdir/symlink) yang
  menyentuh berkas itu ditolak `EPERM` sesaat, lalu biasanya berhasil sendiri kalau dicoba ulang.
  <br>✅ Ditambahkan mekanisme percobaan ulang otomatis (3x) di `install.bat` untuk `apps/api`, dan
  pola yang sama di `apps/scanner-agent/install-service.bat` (risiko serupa karena `serialport`
  juga modul native) — folder `node_modules` dihapus total di antara percobaan supaya tiap
  percobaan mulai dari keadaan bersih, jeda 5 detik di antaranya. Kalau tetap gagal setelah 3x,
  pesan `[PERINGATAN]` mengarahkan ke langkah manual: kecualikan folder instalasi dari pemindaian
  real-time Windows Defender/antivirus yang dipakai, lalu jalankan ulang.
  <br>⚠️ **Belum ada konfirmasi ulang dari client** bahwa percobaan ulang otomatis ini benar-benar
  menyelesaikan masalahnya (bisa saja butuh percobaan lebih dari 3x kalau antivirus di PC tersebut
  memindai lebih lambat, atau perlu pengecualian folder secara eksplisit).

- [x] **BE-117** Paket Docker (`tools/buat-paket-deploy.mjs`) — Scanner Agent dipasang otomatis
  pakai installer bawaan, bukan cuma winget/unduhan online (1 Oktober 2026)
  <br>*Selesai bila:* `installer/` (Node.js + NSSM) ikut ke paket Docker, dan baik
  `JALANKAN-PRESENSEE.bat` maupun `install-service.bat` mencoba pasang dari situ dulu.
  <br>📋 **Keputusan pemilik proyek:** setelah instalasi native (BE-111 … BE-116, Node.js +
  PostgreSQL + NSSM langsung di Windows tanpa Docker) berkali-kali kena bug khas Windows di PC
  client sungguhan (npm EPERM antivirus, symlink, service pause, dsb — lihat BE-112 s.d. BE-116),
  diputuskan kembali ke paket Docker yang sudah terbukti jalan sungguhan (BE-096 … BE-098), TAPI
  dengan Scanner Agent-nya (yang tetap jalan di host Windows langsung, bukan di container, karena
  butuh akses USB) dipasangkan otomatis juga setelah seluruh container Docker-nya terpasang —
  sebelumnya `JALANKAN-PRESENSEE.bat` langkah [4/4] cuma bilang "Node.js tidak ditemukan, pasang
  manual dari nodejs.org" kalau belum ada, dan `install-service.bat` cuma punya winget/unduhan
  online untuk NSSM. Instalasi native TIDAK dihapus (`tools/native-deploy/`, `docs/DEPLOY-NATIF.md`
  tetap ada sebagai alternatif), cuma Docker yang sekarang jadi jalur utama lagi.
  <br>✅ `data/node-*.msi` dan `data/nssm-2.24/.../nssm.exe` — installer yang SAMA PERSIS dipakai
  paket native — sekarang ikut disalin ke `installer/` di root paket Docker (sejajar `apps/`,
  `database/`) lewat `tools/buat-paket-deploy.mjs`. Opsional: kalau `data/` tidak ada installernya,
  dilewati saja (Scanner Agent tetap bisa dipasang manual seperti sebelumnya, tidak jadi gagal
  total).
  <br>✅ `JALANKAN-PRESENSEE.bat` langkah [4/4] (kedua mode pembuatan paket: Docker-image dan
  bundling-JS, dua blok identik secara fungsi di skrip ini) sekarang mencoba pasang Node.js dari
  `installer\node-*.msi` bawaan dulu (`msiexec /quiet`, tidak perlu internet) sebelum menyerah dan
  menyuruh pasang manual. Dibangun pakai gaya goto/label (bukan variabel penanda + delayed
  expansion) supaya konsisten dengan gaya skrip ini sendiri yang sudah begitu sejak awal — berkas
  ini TIDAK memakai `setlocal enabledelayedexpansion`, jadi pola flag-variable+`!VAR!` dari
  `tools/native-deploy/install.bat` sengaja tidak dipaksakan ke sini.
  <br>✅ `apps/scanner-agent/install-service.bat` — dipakai BERSAMA oleh paket native DAN Docker —
  ditambah pengecekan `installer\nssm.exe` dan `installer\node-*.msi` bawaan (path relatif
  `..\..\installer\`, dua tingkat di atas `apps\scanner-agent\`, konsisten di kedua struktur paket)
  sebagai percobaan PERTAMA sebelum winget/unduhan online, dengan pola variabel penanda
  (`NODE_ADA`/`NSSM_ADA`) — BUKAN `goto` keluar blok kurung, mengulang pelajaran BE-112 supaya
  tidak mengulang bug yang sama di berkas ini.
  <br>🐛 **Ditemukan sendiri sambil menyapu bug sejenis, diperbaiki sebelum sempat dikirim:**
  `echo [1/3] Memulai service PresenSee (Database, API, & Web)...` di `JALANKAN-PRESENSEE.bat`
  mode bundling-JS memakai ampersand mentah — cmd.exe membacanya sebagai pemisah perintah
  (memecah baris jadi dua perintah terpisah), bukan sekadar teks biasa, persis kelas bug yang sama
  seperti em dash/redirection mentah yang sudah berkali-kali ditemukan sepanjang sesi ini. Diganti
  `^&` (escaped).
  <br>⚠️ **BELUM DIUJI di PC Windows sungguhan** — diverifikasi lewat: `node --check` (sintaks JS
  valid), ekstraksi kedua blok `jalankanBat` dan pengecekan keseimbangan tanda kurung + karakter
  pengalihan mentah di baris `echo`/`REM` (bersih di keduanya), dan menjalankan
  `buat-paket-deploy.mjs` sungguhan sampai selesai (lihat log pembuatan paket). TIDAK bisa
  memverifikasi perilaku `msiexec`/`nssm`/`winget` sungguhan dari mesin Linux ini.

- [x] **BE-118** `INSTAL-DOCKER.bat` baru — pasang Docker Desktop + WSL2 otomatis dari installer
  bawaan, terpisah dari `JALANKAN-PRESENSEE.bat` (1 Oktober 2026)
  <br>*Selesai bila:* Docker Desktop (~600MB) bisa dipasang tanpa unduh manual dari docker.com,
  WSL2 diaktifkan otomatis kalau belum ada, dan restart (kalau perlu) ditanyakan Y/N di akhir
  proses — bukan dipaksa di tengah jalan.
  <br>📋 **Permintaan pemilik proyek:** setelah sempat membahas alternatif Docker Engine langsung
  di WSL2 tanpa Docker Desktop (lebih kecil tapi lebih rapuh untuk auto-start — lihat diskusi di
  percakapan), diputuskan tetap pakai Docker Desktop resmi tapi installernya (`data/Docker Desktop
  Installer.exe`) dibundel sama seperti Node.js/NSSM (BE-117), bukan diunduh manual oleh client.
  Permintaan eksplisit: restart jangan dipaksa di tengah proses instalasi — tanya Y/N di akhir, dan
  WSL dicek/dipasang otomatis kalau belum ada.
  <br>✅ `tools/buat-paket-deploy.mjs` disalin `data/Docker Desktop Installer.exe` ke `installer/`
  di root paket (sejajar `node-*.msi`, `nssm.exe`) — opsional, kalau tidak ada di `data/` dilewati
  saja (client tetap bisa pasang manual dari docker.com).
  <br>✅ `INSTAL-DOCKER.bat` (berkas BARU, bukan bagian dari `JALANKAN-PRESENSEE.bat`) — sengaja
  dipisah karena ini operasi SEKALI PASANG yang butuh hak admin dan berpotensi minta restart
  (aktivasi fitur Windows), beda sifat dari `JALANKAN-PRESENSEE.bat` yang jalan ringan tiap boot.
  Alurnya: (1) kalau Docker Desktop sudah terpasang, langsung selesai tanpa apa-apa; (2) kalau
  belum, cek status fitur Windows WSL2 + VirtualMachinePlatform lewat `dism /online
  /get-featureinfo` (BUKAN `wsl --status`, yang di sebagian kondisi bisa memicu wizard pasang
  interaktif sendiri dan bikin skrip tanpa pengawasan macet menunggu input); (3) kalau belum aktif,
  aktifkan lewat `dism.exe /online /enable-feature ... /norestart` (`/norestart` supaya tidak
  restart paksa seketika itu juga); (4) pasang Docker Desktop lewat `install --quiet
  --accept-license --backend=wsl-2`; (5) di akhir, kalau fitur WSL2 baru diaktifkan ATAU Docker
  Desktop baru dipasang, tanya `Restart PC sekarang? (Y/N)` — Y jalankan `shutdown /r /t 10`, N
  kasih pesan untuk restart manual nanti sebelum pakai `JALANKAN-PRESENSEE.bat`.
  <br>✅ Ditulis pakai gaya goto/label (bukan variabel penanda + delayed expansion) tanpa SATU PUN
  `goto` yang melompat KELUAR dari blok tanda kurung `(...)` — pelajaran BE-112 dipegang lagi di
  sini: `set /p RESTART_SEKARANG=` dan pembacaan `%RESTART_SEKARANG%` sengaja ditulis sebagai dua
  baris berurutan di level atas (bukan di dalam satu blok kurung yang sama), supaya tidak kena
  jebakan ekspansi `%VAR%` yang dibaca saat parse, bukan saat eksekusi.
  <br>✅ `PANDUAN-INSTALL-WINDOWS.md` (mode Docker) Langkah 1 ditulis ulang total: dari "unduh
  manual dari docker.com, centang WSL2, restart, buka Docker Desktop" jadi "klik kanan
  INSTAL-DOCKER.bat → Run as administrator", dengan catatan soal pertanyaan restart Y/N dan jalur
  darurat `wsl --update` kalau masih gagal.
  <br>⚠️ **BELUM DIUJI di PC Windows sungguhan** — diverifikasi lewat: keseimbangan tanda kurung +
  karakter pengalihan mentah di `echo`/`REM` (bersih), `node --check` untuk skrip pembuat paket,
  dan `buat-paket-deploy.mjs` dijalankan sungguhan sampai paket jadi (lihat log). Perilaku
  `dism`/`shutdown`/instalasi Docker Desktop yang sesungguhnya TIDAK bisa diverifikasi dari mesin
  Linux ini — khususnya apakah teks keluaran `dism /online /get-featureinfo` benar-benar cocok
  dengan pola `findstr` yang dipakai (`"State : Enabled"`), ini yang paling berisiko meleset di
  Windows sungguhan.

- [x] **BE-119** `install.bat` baru — satu titik masuk untuk seluruh instalasi Docker (1 Oktober
  2026)
  <br>*Selesai bila:* satu kali `install.bat` menangani Docker Desktop+WSL2, data awal database,
  container, dan Scanner Agent — tanpa client harus membuka beberapa skrip terpisah secara manual
  seperti sebelumnya (BE-117, BE-118).
  <br>📋 **Permintaan pemilik proyek:** paket native (`tools/native-deploy/install.bat`) punya
  pengalaman "satu kali jalan, semua ke-handle" — Scanner Agent, data contoh, dependensi otomatis.
  Diminta paket Docker disamakan: satu `install.bat` yang mengurus semuanya berurutan, plus Docker
  Desktop diatur supaya tidak membuka jendela dashboard saat start.
  <br>✅ **`install.bat` (BARU, root paket)** — orkestrator 3 langkah: [1/3] `call
  "INSTAL-DOCKER.bat" --dari-install` (Docker Desktop+WSL2, lihat BE-118) → [2/3] data awal
  database → [3/3] `call "JALANKAN-PRESENSEE.bat"` (nyalakan container + Scanner Agent). Dibangun
  lewat kode keluar dari `INSTAL-DOCKER.bat`: `0` = lanjut normal, `2` = perlu restart dulu (berhenti
  rapi, minta client jalankan `install.bat` lagi setelah PC nyala — langkah yang sudah selesai
  tidak diulang), `1` = gagal sungguhan.
  <br>✅ **Syarat restart direlaksasi** dari BE-118: sebelumnya SETIAP pemasangan Docker Desktop
  baru otomatis minta restart, sekarang HANYA kalau fitur Windows WSL2/VirtualMachinePlatform
  benar-benar baru diaktifkan di run itu juga (`dism /enable-feature`) — supaya kasus umum (PC yang
  WSL2-nya sudah siap) selesai sekali jalan tanpa restart sama sekali, sesuai permintaan "restart
  nanti aja kalau sudah selesai".
  <br>✅ **Data awal database dipindah ke `install.bat`, bukan lagi hardcode di `docker-compose.yml`**
  — `database/seed.sql` yang dipetakan ke `/docker-entrypoint-initdb.d/02-seed.sql` cuma dijalankan
  Postgres SEKALI saat volume datanya kosong, jadi keputusan Y/N harus diambil SEBELUM `docker
  compose up` pertama. Kalau dijawab N, `database/seed-esensial.sql` (dibuat sesi sebelumnya untuk
  paket native, sekarang ikut disalin ke paket Docker juga) menimpa `database/seed.sql` di paket
  deploy. Ditandai lewat marker file `database\.data-sudah-diisi` supaya tidak ditanya ulang kalau
  `install.bat` dijalankan lagi (mis. setelah restart).
  <br>✅ **Scanner Agent didaftarkan OTOMATIS, bukan cuma pesan manual lagi** — `JALANKAN-PRESENSEE.bat`
  (dua blok, Docker-image & bundling-JS) sekarang cek `net session`: kalau skrip ini kebetulan
  dipanggil elevated (seperti saat dipanggil dari `install.bat`), langsung `call install-service.bat`
  otomatis; kalau TIDAK elevated (pemakaian harian lewat pintasan Startup folder), tetap cuma kasih
  instruksi manual seperti sebelumnya — sengaja dibedakan supaya tidak memicu popup UAC yang
  mengganggu alur boot otomatis harian.
  <br>✅ **Docker Desktop tidak buka jendela dashboard saat start** — jalur utama
  (`docker desktop start`, dipakai `JALANKAN-PRESENSEE.bat`) memang sudah didesain Docker untuk
  tidak menampilkan dashboard sama sekali, jadi kasus yang paling sering (start otomatis lewat
  skrip) sudah aman dari awal. Ditambah lapisan cadangan di `INSTAL-DOCKER.bat`: menulis
  `OpenUIOnStartupDisabled: true` ke `%AppData%\Docker\settings-store.json` lewat PowerShell
  `-EncodedCommand` (base64 — pola yang sama dipakai di `install-service.bat` untuk alasan sama:
  hindari jebakan quoting batch), sengaja **TIDAK** pakai `ConvertFrom-Json -AsHashtable` karena
  parameter itu tidak ada di Windows PowerShell 5.1 bawaan Windows (cuma PowerShell 7+) — dibungkus
  try/catch, gagal diam-diam kalau nama kunci/format berubah di versi Docker Desktop lain.
  <br>⚠️ **Dua hal paling berisiko, tidak bisa diverifikasi dari mesin Linux ini:** (1) nama kunci
  `OpenUIOnStartupDisabled` di `settings-store.json` berdasar perilaku yang didokumentasikan
  komunitas, bukan API resmi Docker — kalau salah/berubah, dampaknya cuma dashboard tetap terbuka
  sendiri saat dibuka manual (bukan error, dan jalur `docker desktop start` otomatis tidak
  terpengaruh sama sekali); (2) alur `install.bat` → restart → jalankan `install.bat` lagi belum
  pernah dicoba ujung-ke-ujung di PC Windows sungguhan.
  <br>⚠️ **BELUM DIUJI di PC Windows sungguhan** — diverifikasi lewat: keseimbangan tanda kurung +
  karakter pengalihan mentah (bersih di semua berkas yang disentuh), `node --check`, dan
  `buat-paket-deploy.mjs` dijalankan sungguhan sampai paket jadi (lihat log pembuatan paket).
