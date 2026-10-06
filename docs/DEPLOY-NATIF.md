# Paket Deploy Native (Tanpa Docker)

> **Status: DIBANGUN, BELUM DIUJI DI WINDOWS SUNGGUHAN.** Lihat BE-111 di `docs/TASKS-BACKEND.md`
> untuk detail apa yang sudah diverifikasi nyata (bagian SQL, build web/api) vs. yang cuma
> disapu untuk pola bug yang sudah diketahui (keempat `.bat`-nya) — mesin pengembangan ini tidak
> bisa menjalankan Windows untuk uji langsung. Jalankan `node tools/buat-paket-native.mjs` untuk
> membuat ulang `presensee_build/` kapan pun ada perubahan.

## Kenapa

Hampir semua kesulitan di paket deploy Docker (`presensee.zip`) sepanjang sesi sebelumnya
spesifik masalah Docker, bukan masalah aplikasinya: WSL2 belum aktif, Docker Desktop tidak
terdeteksi tergantung lokasi instalasi, checksum korup saat transfer image 600MB+, dan bug
`STORAGE_PATH` yang murni akibat working directory proses di dalam container. Scanner Agent —
yang dari awal SUDAH native (Node.js + NSSM) — justru terbukti bisa jalan mulus di PC yang sama,
begitu bug-bug khususnya (path `node.exe`, bug backslash `AppDirectory`) diperbaiki.

Docker Desktop juga mensyaratkan WSL2/virtualisasi aktif di BIOS — belum tentu tersedia di semua
PC sekolah. Node.js + PostgreSQL + NSSM tidak butuh itu sama sekali.

**Trade-off yang harus dijaga sengaja:** Docker volume otomatis melindungi data (`postgres_data`)
dari kesalahan saat update image. Di cara native, `install.bat` (atau versi baru yang menjalankan
ulang) **wajib tidak pernah menyentuh folder data PostgreSQL yang sudah ada** — ini bukan gratis
seperti di Docker, harus ditulis sengaja.

## Struktur yang diusulkan

Dua berkas utama, meniru pola Scanner Agent yang sudah terbukti:

- **`install.bat`** — dijalankan SEKALI di awal (atau saat mau upgrade versi). Urutannya:
  1. Cek/pasang Node.js (winget dulu, fallback unduh MSI resmi langsung dari nodejs.org — pola
     yang sama persis dengan `apps/scanner-agent/install-service.bat` sekarang).
  2. Cek/pasang PostgreSQL 16 (instalasi diam-diam / silent install).
  3. **Kalau baru pertama kali pasang** (folder data PostgreSQL belum ada): buat database `absen`,
     jalankan `database/schema.sql` + `database/seed.sql`.
     **Kalau sudah pernah pasang** (upgrade): jalankan migrasi baru dari `database/migrations/`
     saja — folder data lama TIDAK disentuh sama sekali.
  4. Cek/pasang NSSM (winget dulu, fallback unduh dari nssm.cc — pola yang sama juga).
  5. Daftarkan `presensee-api` dan `presensee-web` sebagai layanan Windows lewat NSSM (auto-start,
     auto-restart saat crash, log berputar — persis seperti Scanner Agent sekarang).
  6. Tanya: **"Pasang Scanner Agent di PC ini juga? (Y/N)"** — kalau Y, langsung jalankan
     `apps\scanner-agent\install-service.bat` yang sudah ada (tidak perlu ditulis ulang).

- **`jalankan.bat`** — dijalankan tiap PC menyala / kalau servicenya mati. Isinya jauh lebih
  sederhana dari `install.bat`:
  1. Cek servis PostgreSQL — nyalakan kalau mati.
  2. Cek servis `presensee-api`/`presensee-web` (NSSM) — nyalakan kalau mati.
  3. Buka browser ke `localhost:3000`.

- **`hentikan.bat`** — kebalikan `jalankan.bat`, hentikan ketiga servis dengan rapi.

- **`uninstall.bat`** — hapus registrasi servis NSSM (`presensee-api`, `presensee-web`). **Tidak**
  menghapus data PostgreSQL maupun PostgreSQL itu sendiri — copot data itu keputusan terpisah yang
  harus disengaja, bukan efek samping uninstall biasa.

## Berkas yang saya siapkan

Semuanya lewat kode, tidak perlu tindakan manual dari Anda selain menjalankan skrip build:

1. `install.bat`, `jalankan.bat`, `hentikan.bat`, `uninstall.bat` — baru.
2. Hasil build aplikasi sebagai berkas biasa (bukan image Docker):
   - `apps/api/dist/` + `node_modules` produksi (`--omit=dev`) — pola sama seperti Scanner Agent
     dikompilasi sekarang.
   - `apps/web/.next/standalone` + `apps/web/.next/static` — output "standalone" Next.js yang
     sudah dipakai di `apps/web/Dockerfile` saat ini, cuma sekarang dipaketkan sebagai folder
     biasa, bukan disalin ke dalam image.
3. Skrip migrasi database dijalankan langsung dari `install.bat`/berkas pendukungnya, memakai
   `psql` (dipasang bersama PostgreSQL) — tidak perlu Node.js/tsx untuk migrasi lagi seperti di
   dev.
4. Perubahan/berkas baru di `tools/buat-paket-deploy.mjs` (atau skrip packaging terpisah) untuk
   menghasilkan paket ini.
5. Dokumen panduan client versi baru (`PANDUAN-INSTALL-WINDOWS.md`/`PETUNJUK-CLIENT.txt`
   diperbarui, atau dokumen baru kalau isinya beda jauh dari versi Docker).

## Berkas eksternal yang perlu Anda siapkan

Ini yang **tidak bisa saya unduh dan bungkus sendiri** dari sini — perlu diunduh manual sekali,
lalu diletakkan di folder yang akan saya tentukan strukturnya (mis. `installer/`) supaya
`install.bat` bisa memasangnya tanpa bergantung internet sekolah yang kadang lambat:

| Berkas | Sumber resmi | Kenapa perlu dibungkus (bukan cuma winget) |
|---|---|---|
| **Installer Node.js (.msi)**, versi LTS 22 ke atas | https://nodejs.org/en/download | **Opsional** — `install.bat` sudah bisa coba winget dulu, baru unduh langsung kalau gagal (pola yang sudah ada). Membungkus installer-nya mempercepat & tidak butuh internet sekolah, tapi bukan keharusan. |
| **Installer PostgreSQL (.exe)**, versi 16.x — sesuaikan versi minor dengan `postgres:16-alpine` yang dipakai sekarang | https://www.postgresql.org/download/windows/ (installer EDB) | PostgreSQL punya paket winget juga, tapi instalasinya lebih rumit dari Node.js (perlu password superuser, port, lokasi data) — lebih aman kalau installer resminya dibungkus dan dipasang dengan flag *silent* yang sudah ditentukan, bukan bergantung parameter winget yang kurang terkontrol. |
| **`nssm.exe`** | https://nssm.cc/download | Sudah ada fallback winget di kode Scanner Agent sekarang, tapi berkasnya sendiri cuma ~340KB — lebih simpel dibungkus langsung daripada bergantung winget lagi. |

Kalau tiga berkas itu sudah diunduh, taruh saja di satu folder dan kabari saya — saya sesuaikan
`install.bat` untuk mencarinya di situ (dengan fallback ke winget/unduh langsung kalau berkasnya
tidak ada, persis pola yang sudah terbukti di Scanner Agent).

## Yang belum diputuskan (perlu jawaban Anda sebelum mulai)

- Versi PostgreSQL persis berapa (16.x — angka minor mana)?
- Nama folder untuk taruh tiga installer itu?
- Apakah paket lama (Docker, `presensee.zip`) tetap dipertahankan sebagai opsi, atau native ini
  yang akan menggantikannya sepenuhnya?
