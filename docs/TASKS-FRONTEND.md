# SIKLON — Langkah Pengerjaan: Frontend

**Lingkup:** `apps/web` (Next.js 15 App Router).
Backend ada di [TASKS-BACKEND.md](TASKS-BACKEND.md). Acuan tampilan: [`mockup/index.html`](../mockup/index.html).

> **Cara memakai berkas ini.** Setiap tugas punya kode (`FE-001`) dan kriteria selesai.
> Centang `- [x]` begitu tugasnya benar-benar jalan di browser, bukan saat kodenya baru ditulis.
> Perbarui baris **Progres** dan **Terakhir diperbarui** di bawah setiap kali ada perubahan.

**Progres: 62 / 62 selesai ✅** — seluruh fase tuntas
**Terakhir diperbarui:** 24 September 2026 — FE-065: kolom Jam masuk di dialog Presensi Manual
bisa diisi manual (default jam saat dialog dibuka, bisa diubah) — endpoint backend-nya sudah lama
mendukung ini, gap-nya cuma di UI. Sebelumnya FE-064: lampiran foto di dialog Ubah Status Presensi
(IZIN/SAKIT), dengan indikator di tabel Laporan Harian. Sebelumnya FE-063: Konsol Scan menerima
scan dari scanner USB mode keyboard (keyboard-wedge) selain pemindai serial — jalan pintas untuk
scanner client yang tidak berhasil dipindah ke mode serial. Sebelumnya FE-062: password tidak lagi bisa bocor ke URL saat
login (cacat keamanan nyata, terlihat di log dev). Sebelumnya FE-061: Laporan Harian jadi satu tabel
berisi data kelas. Sebelumnya FE-060: rekap per siswa pindah ke tombol cetak/Excel
di tiap baris matriks bulanan; tab "Per Siswa" dibuang. Sebelumnya FE-059: tombol PDF membuka tab baru dalam mode lihat,
tidak lagi langsung mengunduh. Sebelumnya FE-058: tombol PDF di Rekap Bulanan per kelas
(pasangan BE-090). Sebelumnya FE-057: batas lebar `<main>` dilepas, konten memakai
lebar layar penuh (dilaporkan pemilik proyek). Sebelumnya FE-056: baris tombol di kepala halaman Kelas bisa
turun baris, memperbaiki halaman yang bisa digeser mendatar di layar HP. Cacatnya ditemukan
rangkaian uji `tools/uji/` (BE-089), bukan dilaporkan pengguna.
Sebelumnya FE-055: **pergantian tahun ajaran** bisa dikerjakan
dari layar (salin kelas + kenaikan kelas lintas tahun). Sebelumnya FE-054 (wali kelas dihapus). Sebelumnya (9 September)
FE-048 & FE-049 atas permintaan pemilik proyek:
beberapa kamera menyala bersamaan, dan Konsol Scan tanpa tampilan kamera dengan tata letak 30/70.
Diverifikasi ulang di browser: Fase 3 **34/34**, Fase 6 **10/10**, dan rangkaian multi-kamera
baru **13/13** dengan dua kamera sungguhan (webcam bawaan + `/dev/video9`).

> **Dua hal masih menunggu backend** dan sudah ditandai di tugasnya masing-masing:
> `POST /wa/rekap` untuk kirim rekap ke wali (FE-040), dan `docker build` yang belum pernah
> dijalankan karena Docker tidak terpasang di mesin ini (FE-045).
> Endpoint scan ber-JWT untuk kamera **sudah selesai** (BE-078).

> **Tiga tugas dibatalkan** atas keputusan pemilik proyek, jadi jumlah tugas turun dari 45 jadi 42:
> ~~FE-015~~ (foto siswa), ~~FE-018~~ (halaman wali murid), ~~FE-020~~ (cetak QR massal).
> Alasannya ditulis di masing-masing tugas.

> **Seluruh fase sisa sudah terbuka.** Backend ada di 68/78 (Fase 0–5 dan 7 selesai), jadi
> Konsol Scan, WhatsApp, dan Laporan semuanya sudah punya endpoint-nya.

| Fase | Tugas | Selesai | Estimasi | Butuh backend |
|---|---|---|---|---|
| 0. Fondasi | FE-001 … FE-006 | **6/6 ✅** | 0,5 minggu | — |
| 1. Autentikasi | FE-007 … FE-012 | **6/6 ✅** | 0,5 minggu | BE-012 … BE-020 |
| 2. Master Data | FE-013 … FE-022 | **7/7 ✅** (3 dibatalkan) | 1,5 minggu | BE-021 … BE-030 ✅ |
| 3. Konsol Scan | FE-023 … FE-032 | **10/10 ✅** | 1,5 minggu | BE-036 … BE-043 ✅ |
| 4. WhatsApp | FE-033 … FE-036 | **4/4 ✅** | 0,5 minggu | BE-044 … BE-053 ✅ |
| 5. Laporan | FE-037 … FE-041 | **5/5 ✅** | 1 minggu | BE-054 … BE-060 ✅ |
| 6. Rilis | FE-042 … FE-065 | **24/24 ✅** | 0,5 minggu | — |

---

## Fase 0 — Fondasi

- [x] **FE-001** Init Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui
  <br>✅ `apps/web` dengan Next 15.5.25, React 19, Tailwind 4 (konfigurasi CSS-first), TanStack Query 5,
  react-hook-form + zod. Komponen shadcn/ui ditulis langsung ke `src/components/ui/` beserta
  `components.json`, jadi `shadcn add` berikutnya tetap bisa dipakai.
  <br>⚠️ Next 16 sudah rilis, tapi versi tetap dipatok 15 sesuai bunyi tugas ini. TypeScript di
  `apps/web` dipakai 5.9 (bukan 7 seperti `apps/api`) karena Next 15 belum diuji dengan TS 7.
- [x] **FE-002** Token desain dari mockup: warna status, radius, bayangan, tipografi
  <br>*Selesai bila:* `HADIR`/`TERLAMBAT`/`IZIN`/`SAKIT`/`ALPA` punya warna tetap yang dipakai konsisten di seluruh aplikasi.
  <br>✅ Seluruh variabel warna mockup dipindahkan ke `src/app/globals.css` (termasuk padanan gelapnya)
  dan dipetakan jadi utilitas Tailwind. Warna status hanya boleh keluar lewat komponen `StatusBadge`
  / `warnaStatus()` — tidak ada nilai heksadesimal di komponen mana pun.
- [x] **FE-003** Kerangka layout: sidebar + topbar + area konten, mode terang/gelap
  <br>*Selesai bila:* pilihan tema tersimpan dan tidak berkedip saat halaman dimuat ulang.
  <br>✅ Terbukti di Chrome: atribut `data-theme` sudah terpasang **sebelum elemen `<body>` ada**
  (diukur lewat MutationObserver), jadi tidak ada kilatan putih saat muat ulang. Pilihan
  terang/gelap/ikut-sistem tersimpan di localStorage.
- [x] **FE-004** Klien API + penanganan 401 otomatis (arahkan ke login)
  <br>✅ `src/lib/api.ts` membuka bungkus `{ ok, data }`, melempar `KesalahanApi` berkode, dan
  membedakan API mati (`KesalahanJaringan`) dari error biasa. 401 ditangani di satu tempat:
  cache dikosongkan lalu diarahkan ke `/login?next=…`.
- [x] **FE-005** Provider TanStack Query + konvensi query key
  <br>✅ `src/lib/query-keys.ts` — tiap sumber daya punya satu akar sehingga satu `invalidateQueries`
  menyegarkan semua turunannya. Percobaan ulang dimatikan untuk error 4xx supaya pesan 403/404
  langsung muncul, bukan tertunda tiga kali percobaan.
- [x] **FE-006** Komponen dasar: `StatusBadge`, `DataTable` (sortir/pagination), `FormField`, `Toast`, `ConfirmDialog`, `EmptyState`
  <br>*Selesai bila:* `DataTable` dipakai ulang minimal di 3 halaman tanpa disalin-tempel.
  <br>✅ Terpenuhi di Fase 2: `DataTable` dipakai di **6 tempat** — Pengguna, Siswa, Riwayat
  Presensi (detail siswa), Kelas, Hari Libur, dan Tahun Ajaran.
  <br>✅ Ditambahkan mode `paginasiServer` karena daftar siswa dipaginasi server (600 siswa tidak
  boleh diambil sekaligus), sementara tabel lain tetap memotong sendiri di sisi klien.

## Fase 1 — Autentikasi

- [x] **FE-007** Halaman login sesuai mockup
  <br>*Selesai bila:* menampilkan pesan error yang sama untuk username salah maupun password salah.
  <br>✅ Terbukti di browser: username tidak terdaftar dan password salah sama-sama menghasilkan
  "Username atau password salah". Frontend hanya meneruskan pesan dari backend — jangan pernah
  menambahkan pembedaan di sisi ini.
  <br>⚠️ Tiga kontrol di mockup dihilangkan karena tidak ada di backend dan akan jadi janji palsu:
  kolom **Email**, centang **Ingat perangkat ini**, dan tautan **Lupa password?**. Yang terakhir
  diganti kalimat "hubungi Super Admin untuk mereset akun Anda".
- [x] **FE-008** Middleware proteksi rute + pengalihan ke halaman yang dituju setelah login
  <br>✅ `src/middleware.ts`. Tujuan asal disimpan di `?next=` dan divalidasi harus path internal —
  menerimanya mentah-mentah membuka celah pengalihan ke situs lain (open redirect).
  <br>⚠️ Middleware sengaja **hanya memeriksa ada/tidaknya cookie**, tidak memverifikasi tanda tangan
  JWT — itu berarti membagikan `JWT_SECRET` ke proses web tanpa perlu. Penjagaan sebenarnya tetap
  di backend; middleware ini murni soal kenyamanan.
  <br>⚠️ **Bug yang lolos sampai dipakai (diperbaiki 9 September 2026): lingkaran pengalihan saat
  sesi ditolak server.** Kalau cookie masih ada di browser tapi server menolaknya —
  `token_version` berubah (mis. database di-seed ulang, password diganti di perangkat lain), akun
  dinonaktifkan, atau JWT kedaluwarsa — maka: `/auth/me` menjawab 401 → aplikasi mengalihkan ke
  `/login` → middleware melihat cookie masih ada lalu memantulkannya balik ke `/dashboard` →
  401 lagi. Layar terjebak menampilkan kerangka pemuatan tanpa penjelasan apa pun.
  → Perbaikannya tiga bagian: **(a)** penangan 401 memanggil `POST /auth/logout` lebih dulu supaya
  cookie basi benar-benar dibuang; **(b)** pengalihannya membawa `?sesi=habis`, dan middleware
  tidak memantulkan halaman login yang membawa penanda itu; **(c)** halaman login menjelaskan
  kenapa pengguna tiba-tiba diminta masuk lagi.
  → Ditambahkan juga penjaga agar beberapa permintaan yang 401 bersamaan hanya memicu **satu**
  pengalihan, bukan satu per permintaan.
  → Pengujian sebelumnya hanya menutup kasus "tidak punya cookie sama sekali". Kasus "punya cookie
  tapi ditolak server" tidak pernah diuji — padahal justru itu yang terjadi di pemakaian nyata.
- [x] **FE-009** Layar wajib ganti password saat login pertama
  <br>*Selesai bila:* pengguna tidak bisa membuka halaman lain sampai passwordnya diganti.
  <br>✅ Terbukti: login pertama langsung mendarat di `/ganti-password`, tombol "Kembali"
  disembunyikan, dan mengetik `/dashboard` di URL memantul balik ke sana. Backend juga menolaknya
  dengan 403 lewat `wajibMasukPenuh`, jadi penjagaannya berlapis.
- [x] **FE-010** Ganti password dari menu profil
  <br>✅ Satu layar dipakai untuk dua keadaan (wajib dan sukarela); bedanya hanya kalimat pengantar
  dan ada/tidaknya tombol Kembali. Menu profil juga memuat "Keluar" dan "Keluar dari semua
  perangkat" (dengan konfirmasi).
- [x] **FE-011** Sembunyikan menu **Pengguna** untuk peran non-Super-Admin
  <br>*Selesai bila:* menyembunyikan menu hanya kosmetik — mengetik URL-nya langsung tetap ditolak backend 403 dan frontend menampilkan halaman "tidak punya akses".
  <br>✅ Terbukti dengan dua akun: Admin tidak melihat menunya, dan saat `/pengguna` diketik langsung
  backend menjawab 403 lalu halaman menampilkan "Anda tidak punya akses ke halaman ini".
- [x] **FE-012** Halaman Pengguna: daftar, buat admin, reset password, nonaktifkan
  <br>✅ Lengkap dengan ubah nama, cabut sesi, dan aktifkan kembali. Password sementara bisa diacak
  (tanpa karakter yang mudah tertukar seperti 0/O dan 1/l, supaya aman dibacakan lewat telepon).
  Semua diuji di browser sampai datanya benar-benar berubah.
  <br>⚠️ Kolom **Email** dan **Sesi Aktif** di mockup tidak dibuat: tabel `users` tidak punya kolom
  email, dan jumlah sesi tidak bisa dihitung karena sesi memang tidak disimpan (hanya
  `token_version`). Tombol **Cabut Sesi** menggantikan gunanya.

## Fase 2 — Master Data

- [x] **FE-013** Halaman Siswa: tabel + cari + filter kelas/status + pagination
  <br>*Selesai bila:* pencarian di-debounce dan keadaan filter tersimpan di URL (bisa di-bookmark & tombol Back berfungsi).
  <br>✅ Terbukti di browser: mengetik 4 huruf hanya menambah **1** entri riwayat (bukan 4),
  `?cari=` bertahan setelah muat ulang, dan tombol Back mengembalikan filter sebelumnya.
  <br>✅ Ditambahkan strip angka "lubang data" dari `GET /students/ringkasan` — siswa tanpa kelas,
  tanpa nomor HP, dan yang notifikasinya mati. Angkanya bisa diklik jadi filter.
- [x] **FE-014** Form tambah/edit siswa (react-hook-form + zod)
  <br>✅ Skema zod-nya disamakan dengan skema server, jadi NIS berisi karakter aneh atau nama
  kosong ditolak sebelum permintaan dikirim. Terbukti: submit form kosong menampilkan
  "wajib diisi" dan dialognya tidak menutup.
  <br>✅ Kolom wali kini **dua input teks biasa** — Nama wali dan No. HP wali — bukan lagi pemilih
  dari daftar wali. Nomor boleh ditulis format apa pun; server yang menyeragamkan ke E.164.
  Keterangan di formnya menjelaskan bahwa kakak-adik memang memakai nomor yang sama.
  <br>✅ Ditambahkan saklar **Kirimi notifikasi WhatsApp** (9 September 2026). Ini satu-satunya
  tempat notifikasi bisa dinyalakan lagi: balasan "BERHENTI" dari wali mematikan `notify` lewat
  backend, dan tanpa saklar ini tidak ada jalan kembali dari aplikasi. Terbukti di browser —
  perubahannya tersimpan dan penanda "notifikasi mati" di tabel Siswa ikut hilang.
- [ ] ~~**FE-015** Unggah foto siswa + pratinjau + pemotongan sederhana~~
  <br>❌ **Dibatalkan atas keputusan pemilik proyek (8 September 2026):** sistem tidak memakai
  foto siswa sama sekali — identitas siswa ditampilkan sebagai teks (nama, NIS, kelas).
  <br>⚠️ Ikutannya: **FE-024** (kartu hasil scan) tidak menampilkan foto, dan setelan
  `scan.tampilkan_foto` jadi tidak terpakai. Backend sudah terlanjur membuat unggah &
  penyaji foto (BE-025) — endpoint-nya dibiarkan, tapi tidak dipanggil frontend.
- [x] **FE-016** Detail siswa: profil, ~~wali,~~ nomor HP, kalender kehadiran, riwayat presensi
  <br>*Selesai bila:* kalender mewarnai tiap tanggal sesuai status dan hari libur tampil berbeda.
  <br>✅ Terbukti dengan data sungguhan: 1 Sep hijau (Hadir), 2 Sep kuning (Terlambat), 3 Sep biru
  (Izin), 4 Sep ungu (Sakit). Hari libur dan hari di luar `hari_sekolah` digambar bergaris abu —
  penting supaya kotak kosong karena libur tidak terbaca sebagai alpa.
  <br>✅ Diuji juga bahwa hari libur yang **baru ditambahkan** di Pengaturan langsung tampil beda
  di kalender ini.
- [x] **FE-017** Halaman Kelas + dialog kenaikan kelas massal
  <br>*Selesai bila:* menampilkan pratinjau "X siswa akan dipindahkan dari VII-A ke VIII-A" sebelum dijalankan.
  <br>✅ Terbukti di browser: pratinjau berbunyi "3 siswa akan dipindahkan dari VII-A ke VIII-A".
  Kelas tujuan ditebak otomatis (tingkat naik satu, akhiran nama tetap) tapi tetap bisa diubah.
  <br>✅ Kelas yang tidak dipindahkan diberi peringatan terpisah — itu biasanya kelas terakhir yang
  lulus, dan siswanya perlu dinonaktifkan supaya kartunya tidak bisa dipakai absen lagi.
- [ ] ~~**FE-018** Halaman Wali Murid + penanda nomor bermasalah dan opt-out~~
  <br>❌ **Dibatalkan atas keputusan pemilik proyek (8 September 2026):** wali murid tidak
  dikelola sebagai data tersendiri. Yang dibutuhkan hanya **satu kolom nomor HP di data siswa** —
  nama wali, opt-out, dan halaman khususnya tidak diperlukan.
  <br>✅ **Backend sudah menyusul (8 September 2026):** tabel `guardians` dibuang, endpoint
  `/guardians` dihapus (kini 404), dan kolom `guardian_name` / `guardian_phone` / `notify` ada di
  `students`. Frontend sudah disesuaikan: `use-wali.ts` dan `pilih-wali.tsx` dihapus, form siswa
  memakai input nomor biasa. Typecheck bersih, build produksi sukses.
- [x] **FE-019** Import Excel: unggah, pratinjau, tampilkan error per baris, unduh template
  <br>*Selesai bila:* pengguna melihat baris mana yang salah **sebelum** apa pun tersimpan.
  <br>✅ Diuji dengan berkas berisi 5 kesalahan sekaligus: semuanya dilaporkan dengan nomor baris
  dan nama kolom, jumlah siswa di database **tidak berubah**, dan tombol "Simpan ke database"
  tetap terkunci selama masih ada error.
  <br>✅ Berkas bersih: periksa → simpan → "4 siswa diimpor. 3 punya nomor wali (2 nomor berbeda)".
  Dua nomor yang ditulis beda format (`0812-9000-1111` vs `+62 812 9000 1111`) tersimpan sebagai
  nomor yang sama — penting supaya opt-out menemukan kedua anaknya.
- [ ] ~~**FE-020** Cetak QR massal: pilih siswa → unduh PDF~~
  <br>❌ **Dibatalkan atas keputusan pemilik proyek (8 September 2026):** sistem ini hanya
  **membaca** QR kartu siswa untuk absen, tidak mencetaknya. Kartu siswa dicetak di luar
  sistem, dan isinya cukup NIS.
  <br>⚠️ Backend sudah terlanjur membuat `POST /students/print-qr` (BE-028). Endpoint-nya
  dibiarkan ada tapi tidak dipakai frontend — tanyakan ke pemilik proyek apakah mau dihapus.
- [x] **FE-021** Halaman Pengaturan — kartu **Jam Masuk & Batas Terlambat**
  <br>*Selesai bila:* batas terlambat (`jam_masuk` + `toleransi`) dihitung dan ditampilkan langsung saat angkanya diubah, seperti di mockup.
  <br>✅ Terbukti: mengubah toleransi 10 → 25 mengubah batas terlambat 07:10 → 07:25 seketika,
  tanpa menyimpan dulu.
  <br>✅ Ditambahkan tabel **"Contoh penerapan"** yang ikut berubah — jam 07:22 berpindah dari
  TERLAMBAT ke HADIR saat toleransinya dinaikkan. Ini membuat akibat perubahan terlihat sebelum
  disimpan.
  <br>⚠️ Kolom **Jam pulang** di mockup tidak dibuat: proyek ini absen masuk saja, dan skema
  `settings.presensi` memang tidak punya kunci itu.
- [x] **FE-022** Pengaturan lain: hari libur, tahun ajaran, identitas sekolah
  <br>✅ Empat tab, dan tab aktif ikut masuk URL (`/pengaturan?tab=libur`) supaya bisa ditautkan.
  <br>✅ Hari libur diuji sampai tersimpan dan langsung terlihat di kalender siswa. Mengaktifkan
  tahun ajaran memakai konfirmasi karena efeknya luas — seluruh daftar kelas di aplikasi ikut
  berganti.

## Fase 3 — Konsol Scan

- [x] **FE-023** Kerangka Konsol Scan + koneksi Socket.IO + indikator sambungan
  <br>*Selesai bila:* koneksi putus tampil jelas di layar dan tersambung kembali otomatis.
  <br>✅ Terbukti di browser: jaringan dimatikan → spanduk merah lebar **"Layar ini tidak menerima
  scan"** muncul; jaringan dinyalakan lagi → hilang sendiri tanpa muat ulang.
  <br>⚠️ Socket.IO baru menyadari putus lewat ping timeout, jadi jeda sampai **~45 detik** itu wajar
  (server ping tiap 25 detik, klien menunggu 20 detik lagi). Bukan bug frontend.
  <br>✅ Autentikasi socket memakai cookie sesi yang sama dengan REST — tidak ada token yang perlu
  dititipkan ke JavaScript.
  <br>✅ Angka ringkasan di kepala layar ikut naik tiap scan masuk; tanpa itu operator melihat
  "0 hadir" padahal scan terus berdatangan, dan jadi ragu sistemnya mencatat atau tidak.
- [x] **FE-024** Kartu hasil scan besar: ~~foto,~~ nama, kelas, status, jam
  <br>*Selesai bila:* terbaca dari jarak 2 meter — ini layar untuk petugas gerbang, bukan untuk dibaca dari dekat.
  <br>⚠️ Tanpa foto — lihat FE-015. Nama dibuat sebesar mungkin sebagai gantinya.
  <br>✅ Diukur di browser: nama siswa dirender **48px**, status dan jam 36px. Kartunya memakai
  `aria-live="assertive"` supaya pembaca layar ikut mengumumkan hasilnya.
- [x] **FE-025** Warna & umpan balik per hasil: hijau hadir, kuning terlambat, merah ditolak
  <br>✅ Ketiganya diverifikasi dari warna latar yang sebenarnya dirender: `#dcfce7` (hadir),
  `#fef3c7` (terlambat), `#fee2e2` (ditolak) — token yang sama dengan `StatusBadge`.
- [x] **FE-026** Umpan balik audio berbeda untuk sukses dan gagal
  <br>*Selesai bila:* petugas bisa tahu hasilnya **tanpa melihat layar**.
  <br>✅ Dibangkitkan Web Audio, bukan berkas mp3 — tidak ada aset yang diunduh dan tidak ada jeda
  pada bunyi pertama. Tiga pola yang jelas berbeda, diverifikasi dengan merekam frekuensi
  osilator yang benar-benar dibunyikan: sukses **880→1320 Hz** (naik), terlambat
  **1046→784 Hz** (turun), gagal **200 Hz** tunggal dan panjang.
  <br>⚠️ Browser menahan AudioContext sampai ada gestur pengguna. Karena itu tombol "Bunyi"
  membangunkan konteksnya sekaligus membunyikan contoh — kalau tidak, bunyi pertama hilang dan
  operator mengira suaranya rusak.
- [x] **FE-027** Tabel riwayat scan hari ini + filter titik scan
  <br>✅ Filter titik scan diuji: 3 baris → 1 baris saat disaring ke GERBANG-2.
  <br>⚠️ Presensi manual sampai **dua kali** ke layar (balasan HTTP + siaran socket). Riwayatnya
  menolak entri kembar berdasarkan NIS + jam + titik scan, jadi satu kejadian tetap satu baris.
- [x] ~~**FE-028** Pemilih sumber input: Scanner Serial / Kamera~~ → **Pemilihnya dihapus**
  <br>✅ **Diubah atas keputusan pemilik proyek (9 September 2026):** kamera dan pemindai serial
  diperlakukan sama, jadi tidak ada lagi pilihan "sumber input" di Konsol Scan. Layar itu
  menerima scan dari mana pun tanpa perlu dipilih.
  <br>✅ Setelan keduanya dipindah ke **satu tempat**: halaman Scanner kini punya kartu
  **"Kamera Perangkat Ini"** (saklar nyala/mati + pemilih kamera + pratinjau) di atas daftar
  pemindai serial.
  <br>⚠️ Setelan kamera disimpan **di perangkat**, bukan di server: `deviceId` kamera hanya berarti
  di mesin tempat kamera itu terpasang. PC gerbang, laptop TU, dan HP masing-masing punya
  pilihannya sendiri — menyimpannya terpusat justru akan salah.
  <br>⚠️ Pratinjau di halaman Scanner sengaja **tidak mendekode QR** (`pindai={false}`), supaya
  tidak ada presensi tercatat tanpa sengaja dari halaman pengaturan.
- [x] **FE-029** Mode kamera: `getUserMedia` + daftar kamera + simpan pilihan terakhir
  <br>*Selesai bila:* menampilkan pesan jelas saat izin kamera ditolak, **dan** saat halaman dibuka lewat `http://` non-localhost (penyebab tersering kamera tidak jalan).
  <br>✅ Kedua keadaan diuji dengan browser sungguhan. Non-HTTPS dijelaskan lengkap dengan host yang
  sedang dipakai dan jalan keluarnya; izin ditolak menyebutkan bahwa memuat ulang saja **tidak
  cukup** — izinnya harus diubah dulu lewat ikon gembok.
  <br>✅ Pilihan kamera disimpan di localStorage supaya petugas tidak memilih ulang tiap pagi.
- [x] **FE-030** Pendekode QR: `BarcodeDetector` bila ada, jika tidak `qr-scanner`
  <br>*Selesai bila:* jalan di Chrome Linux (yang tidak punya `BarcodeDetector`) lewat jalur fallback.
  <br>✅ **Scan kamera kini presensi sungguhan (9 September 2026).** Atas keputusan pemilik proyek,
  sistem tidak perlu mencatat siswa absen lewat mana, dan kamera tidak lagi diperlakukan berbeda
  dari pemindai serial. Backend menambah `POST /attendance/scan` ber-JWT (BE-078); konsol
  memakainya, jadi presensinya tersimpan **tanpa** `device_code` dan **tanpa** `updated_by` —
  bukan lagi tercatat `MANUAL`. Peringatan kuning di layar sudah dihapus karena batasannya
  memang sudah tidak ada.
  <br>✅ Terbukti: di Chrome Linux `'BarcodeDetector' in window` bernilai **false** dan konsol
  otomatis memakai `qr-scanner`. Jalur yang dipakai ditampilkan sebagai label kecil di pojok
  video, jadi ketahuan tanpa membuka DevTools.
  <br>⚠️ **Bug yang lolos dari pengujian awal (diperbaiki 9 September 2026).** Jalur `qr-scanner`
  semula memakai `new QrScanner(video).start()`, padahal komponen ini sudah mengelola
  `video.srcObject` sendiri (demi daftar kamera, pilihan tersimpan, dan pesan izin). Keduanya
  berebut elemen video yang sama: pemindainya "start" **tanpa melempar error**, worker-nya
  dibuat, tapi tidak satu frame pun pernah dikirim ke worker itu. Gejalanya paling menyesatkan —
  kamera tampil normal, tidak ada error di konsol, QR tidak pernah terbaca.
  → Ditulis ulang memakai `QrScanner.scanImage()` di dalam loop `requestAnimationFrame` sendiri,
  dengan satu `qrEngine` yang dipakai ulang — bentuknya kini sama persis dengan jalur
  `BarcodeDetector`.
  → Penyebab bug ini lolos: asersinya hanya memeriksa **pustaka mana yang terpilih**, bukan
  bahwa QR benar-benar terbaca. Kamera palsu bawaan Chrome hanya menampilkan pola bergerak,
  jadi decode tidak pernah mungkin terjadi di pengujian itu. Sekarang pengujian memakai umpan
  kamera `--use-file-for-fake-video-capture` berisi **QR NIS sungguhan**, dan memastikan nama
  siswanya muncul di layar.
- [x] **FE-031** Input manual: cari siswa → catat presensi + alasan
  <br>✅ Pencarian di-debounce, alasan wajib diisi (aturan server), dan disediakan tiga alasan
  cepat yang paling sering dipakai supaya tidak perlu mengetik ulang tiap pagi.
- [x] **FE-032** Halaman Scanner: daftar port, pemetaan, tombol **Kenali Scanner**
  <br>*Selesai bila:* saat mode identifikasi, baris port yang barusan dipakai tersorot dan kursor otomatis ke kolom kodenya.
  <br>✅ Diuji dengan meniru Scanner Agent lewat endpoint aslinya: dua port dilaporkan, mode
  identifikasi dinyalakan, lalu satu "tempelan barcode" dikirim — barisnya tersorot dan
  `document.activeElement` benar-benar berpindah ke kolom Kode port itu.
  <br>✅ Port tanpa nomor seri diberi peringatan tersendiri: pemetaannya ikut lokasi colokan USB,
  jadi memindah kabel setelah diberi nama bisa membuat presensi tercatat dari gerbang yang salah.
  <br>✅ Port yang baru dipetakan default **aktif**. Kalau defaultnya mati, operator yang lupa
  menyalakan saklarnya akan mengira pemetaannya beres padahal agent tidak pernah membuka port
  itu — dan tidak satu pun scan masuk. Ini ikut diuji.

## Fase 4 — WhatsApp

- [x] **FE-033** Halaman status koneksi + QR pairing
  <br>*Selesai bila:* QR menyegarkan sendiri sebelum kedaluwarsa dan berpindah ke status "tersambung" tanpa perlu muat ulang.
  <br>✅ Terbukti di browser: QR pertama diganti QR kedua sendiri, lalu layar berpindah ke keadaan
  "tersambung" — semuanya tanpa halaman dimuat ulang. Status di-poll tiap 5 detik selama belum
  tersambung (QR Baileys hanya berlaku ~20 detik) dan dijarangkan jadi 20 detik setelahnya.
  <br>✅ QR datang dari server sebagai teks mentah dan dirender jadi gambar di browser.
  <br>✅ **Ringkasan pengaman ditampilkan paling atas** — `WA_PROVIDER`, mode production, dan status
  allowlist. Ini yang memberi tahu admin apakah pesan benar-benar terkirim ke orang atau hanya
  dicatat di log; tanpa itu, layar yang tampak normal bisa menipu.
- [x] **FE-034** Editor template + pratinjau gaya gelembung WhatsApp
  <br>✅ Pratinjau berubah **saat diketik**, bukan setelah disimpan — variabel disubstitusi dengan
  contoh yang sama persis dengan `pratinjau()` di backend, dan format `*tebal*` WhatsApp ikut
  dirender.
  <br>✅ Variabel yang tidak dikenal **diperingatkan**, karena backend sengaja membiarkannya apa
  adanya — salah tulis `{nama_wali}` akan ikut terkirim mentah ke wali murid.
  <br>⚠️ Daftar variabel di mockup sudah usang. Yang benar (dari `modules/whatsapp/template.ts`):
  `{wali}` `{siswa}` `{kelas}` `{tanggal}` `{jam}` `{menit}` `{sekolah}`, plus `{bulan}` `{hadir}`
  `{terlambat}` `{izin}` `{sakit}` `{alpa}` `{persen}` khusus REKAP.
  <br>⚠️ Pratinjau dirender tanpa `dangerouslySetInnerHTML`: isi template datang dari database dan
  menyisipkannya sebagai HTML akan jadi lubang XSS di halaman admin.
- [x] **FE-035** Log pengiriman: filter status, lihat isi pesan, kirim ulang yang gagal
  <br>✅ Nomor disamarkan di daftar (`0813****7890`) dan hanya tampil penuh saat pesannya dibuka —
  layar ini sering terbuka di ruang TU yang ramai.
  <br>✅ Isi pesan ditampilkan dalam gelembung WhatsApp yang sama dengan editor template, jadi
  admin melihat persis yang diterima wali.
  <br>⚠️ "Kirim ulang semua yang gagal" tidak menyentuh pesan berstatus CANCELLED — itu permintaan
  wali untuk berhenti, dan mengirimnya lagi justru pelanggaran. Dinyatakan di dialog konfirmasi.
- [x] **FE-036** Pengaturan notifikasi + penghitung volume langsung
  <br>*Selesai bila:* mencentang/menghapus kejadian langsung memperbarui perkiraan pesan/hari dan ekor antrean, seperti di mockup.
  <br>✅ Terbukti: menghapus centang MASUK menurunkan perkiraan seketika (3 → 0 pesan/hari) dan
  ekor antrean ikut berubah (11 detik → 0 detik); mencentangnya lagi mengembalikan angkanya.
  <br>✅ Angkanya **tidak dikarang**: jumlah penerima diambil dari ringkasan siswa (aktif, punya
  nomor, notifikasi menyala) dan proporsi hadir/terlambat/alpa dihitung dari presensi hari ini.
  Kalau data hari ini belum cukup, dipakai perkiraan kasar dan **hal itu dinyatakan di layar** —
  angka yang terlihat pasti padahal ditebak justru menyesatkan.
  <br>✅ "Ekor antrean" = selisih waktu antara pesan pertama dan terakhir bila semuanya masuk
  antrean bersamaan. Ini yang menentukan apakah wali dapat kabar saat anaknya baru sampai atau
  satu jam kemudian — inti tujuan sistem ini.

## Fase 5 — Laporan

- [x] **FE-037** Laporan harian per kelas + tombol **Ubah** status jadi IZIN/SAKIT
  <br>*Selesai bila:* dialog ubah status mewajibkan catatan, dan tabel langsung ter-refresh setelah disimpan.
  <br>✅ Keduanya terbukti di browser: tombol Simpan mati selama catatan kosong (dan **alasannya
  ditulis**, bukan tombol mati tanpa sebab), lalu tabel berubah sendiri begitu disimpan.
  <br>⚠️ Sumber datanya `GET /attendance`, bukan `GET /reports/harian` — hanya yang pertama
  mengembalikan `siswaId` dan `presensiId` yang dibutuhkan untuk mengubah status. Endpoint
  laporan tetap dipakai untuk unduhan Excel/PDF.
  <br>✅ Dua jalur simpan tergantung keadaan: siswa yang sudah punya baris presensi di-PATCH,
  yang belum ditandai lewat `/attendance/tandai` (server hanya menerima IZIN/SAKIT/ALPA di sana,
  dan pilihannya dibatasi mengikuti itu).
- [x] **FE-038** Rekap semua kelas + baris total sekolah
  <br>✅ Baris TOTAL SEKOLAH sengaja di luar tabel, bukan baris terakhir — kalau ikut di dalam,
  ia akan ikut tersortir saat kolom lain diklik dan berpindah ke tengah daftar.
  <br>✅ Nama kelas bisa diklik untuk langsung melihat daftar siswanya.
- [x] **FE-039** Laporan bulanan matriks siswa × tanggal
  <br>*Selesai bila:* kolom nama tetap terlihat saat tabel digeser ke kanan (sticky column).
  <br>✅ Terbukti diukur: setelah tabel digeser 400px, posisi kiri kolom nama tidak bergeser sama
  sekali.
  <br>⚠️ Tabelnya diberi **lebar minimum**. Tanpa itu kolom tanggal menyusut sampai nyaris tak
  terbaca agar muat di layar — matriks yang muat tapi tidak terbaca tidak ada gunanya, dan
  justru itu yang membuat kolom sticky jadi perlu.
- [x] **FE-040** Laporan bulanan per siswa: kalender + ringkasan ~~+ kirim rekap ke wali~~
  <br>✅ Kalender, ringkasan (termasuk rata-rata jam datang dan total menit terlambat), dan unduh
  PDF berjalan.
  <br>❌ **Kirim rekap ke wali belum bisa** — backend tidak punya endpoint untuk mengantrekannya.
  Tombolnya ditampilkan **nonaktif dengan alasan tertulis di layar**, bukan disembunyikan atau
  dibuat seolah jalan. Mengirim langsung dari browser akan melewati opt-out, jam tenang, dan
  batas harian yang semuanya hidup di `antrekan()`.
  → **Perlu dari backend:** `POST /wa/rekap` dengan `{ siswaId, bulan }` yang lewat antrean.
- [x] **FE-041** Dashboard: kartu ringkasan, grafik tren, kelas perlu perhatian, aktivitas terakhir
  <br>✅ Ditambahkan bagian **"Perlu dibenahi"** paling atas: siswa tanpa nomor wali, notifikasi
  yang dimatikan, Scanner Agent offline, dan pesan WhatsApp gagal — masing-masing tertaut ke
  halaman perbaikannya. Inilah yang membuat notifikasi diam-diam tidak sampai.
  <br>✅ Grafik tren: satu seri, jadi tanpa legenda (judul kartunya yang menamai seri). Sumbu
  dipatok 0–100% supaya penurunan kecil tidak terlihat dramatis, garis 2px, grid hairline solid,
  dan **hanya titik terakhir yang diberi label** — angka di tiap titik jadi kekacauan yang tak
  terbaca.
  <br>✅ Grafik bukan satu-satunya cara membaca datanya: ada ringkasan `aria-label` dan angka
  lengkapnya bisa dibuka sebagai tabel.

## Fase 6 — Rilis

- [x] **FE-042** Responsif: tablet & HP (terutama Konsol Scan dan Laporan Harian)
  <br>✅ Diperiksa otomatis: **11 halaman × 2 ukuran** (HP 390px dan tablet 820px), tidak ada satu
  pun yang bisa digeser mendatar. Di bawah 768px sidebar berubah jadi laci.
  <br>⚠️ Satu bug nyata ditemukan dan diperbaiki: `/kelas` meluap 8px karena `CardHeader` tidak
  membungkus, sehingga tombol aksinya terdorong keluar layar. Diperbaiki di **komponennya**
  (`flex-wrap`), bukan per halaman — pola judul + tombol itu dipakai hampir di semua kartu.
- [x] **FE-043** Keadaan loading, kosong, dan error di semua halaman
  <br>*Selesai bila:* tidak ada halaman yang menampilkan layar putih kosong saat API mati.
  <br>✅ Diuji dengan memblokir seluruh permintaan ke API: **11 halaman** tetap menampilkan
  penjelasan, tidak ada yang jadi layar putih.
  <br>✅ Diuji juga keadaan yang lebih halus — sesi tetap hidup tapi data halamannya gagal. Tiga
  halaman ternyata diam saja (`/siswa/import`, `/scan`, `/laporan/bulanan`): halamannya terlihat
  "normal tapi kosong", sehingga pengguna mengira datanya memang belum ada. Ditambahkan
  `PeringatanGagal` di ketiganya.
  <br>⚠️ Percobaan ulang untuk error jaringan dikurangi dari 2 jadi 1. Dengan dua percobaan
  berbackoff, pengguna menatap kerangka kosong ~6 detik sebelum tahu servernya tidak terjangkau.
- [x] **FE-044** Mode kiosk Konsol Scan: layar penuh, tanpa sidebar, cegah layar mati
  <br>✅ Kiosk menutupi seluruh area layout termasuk sidebar (`fixed inset-0`), meminta layar
  penuh, dan menahan layar mati lewat **Wake Lock**. Statusnya ditampilkan apa adanya — kalau
  browser tidak mendukung, layar berbunyi "Layar tidak dijaga" alih-alih diam.
  <br>⚠️ Wake Lock dilepas browser saat tab disembunyikan, jadi ia diminta ulang tiap tab kembali
  terlihat. Tanpa itu kuncinya hilang diam-diam setelah operator berpindah tab sekali.
  <br>✅ **Esc keluar dari kiosk**, bukan hanya keluar dari layar penuh — kalau tidak, petugas
  terjebak di layar yang seolah tidak bisa ditutup.
- [x] **FE-045** Dockerfile `web` + build produksi
  <br>✅ `output: 'standalone'` + Dockerfile tiga tahap (deps → build → run), berjalan sebagai
  pengguna non-root, dengan health check. Dibangun dari akar repo:
  `docker build -f apps/web/Dockerfile -t siklon-web .`
  <br>✅ Keluaran standalone diuji sungguhan: dijalankan dengan `node apps/web/server.js`, halaman
  dan aset CSS-nya terlayani dengan benar — itu memastikan path `COPY` dan `CMD` di Dockerfile cocok.
  <br>❌ **Image Docker-nya sendiri belum pernah dibangun** — Docker tidak terpasang di mesin
  pengembangan ini. Yang terverifikasi hanya keluaran build-nya, bukan hasil `docker build`.
  <br>⚠️ `NEXT_PUBLIC_API_URL` ditanam saat **build**, bukan saat container jalan — nilainya ikut
  ke bundel browser. Ganti lewat `--build-arg`, jangan lewat environment container.
- [x] **FE-046** Pratinjau kamera berkedip nyala-mati (dilaporkan pemilik proyek)
  <br>✅ Penyebabnya bukan kamera atau izin, melainkan efek React yang dijalankan ulang tiap
  render: `laporKode` bergantung pada prop `onKode`, dan kedua pemanggilnya mengoper fungsi
  beridentitas baru tiap render (`onKode={() => undefined}` di halaman Scanner, dan
  `catatDariKamera` yang bergantung pada objek `useMutation` di Konsol Scan). Karena `laporKode`
  ikut jadi dependensi efek pembuka kamera, streamnya dimatikan lalu dinyalakan lagi
  terus-menerus.
  <br>✅ Perbaikannya: `onKode` disimpan di ref yang disegarkan tiap render, dan `laporKode`
  jadi `useCallback` berdependensi kosong — identitasnya tetap seumur komponen.
  <br>✅ **Selesai bila:** kamera tidak dibuka ulang. Diukur, bukan dikira-kira —
  `navigator.mediaDevices.getUserMedia` dan `MediaStreamTrack.stop` dibungkus penghitung, lalu
  halaman dibiarkan 8 detik: **0 pembukaan ulang, 0 penghentian, video tetap hidup** di halaman
  Scanner maupun Konsol Scan.
- [x] **FE-047** HP dipakai sebagai webcam pemindai (permintaan pemilik proyek)
  <br>Tujuannya: aplikasi tetap dibuka di laptop, HP jadi kameranya — seperti pemindai sungguhan.
  <br>❌ **Mode webcam UVC bawaan Android tidak bisa dipakai** di HP ini. Paket
  `com.android.DeviceAsWebcam` ada dan aktif, tapi `svc usb setFunctions uvc` tidak bertahan:
  `sys.usb.config` kembali sendiri ke `midi,adb` dan deskriptor USB tidak berubah. Vendor tidak
  mengaktifkan gadget UVC-nya.
  <br>✅ Jalur yang dipakai: **DroidCam (MJPEG di port 4747) → adb forward → ffmpeg →
  v4l2loopback `/dev/video9`**. Dari sisi aplikasi tidak ada perubahan kode sama sekali; pemilih
  kamera memang menampilkan apa pun yang dikenali sebagai `videoinput`.
  <br>✅ Dua skrip di [`tools/`](../tools/): `pasang-webcam-hp.sh` (sekali, butuh sudo) dan
  `hp-webcam.sh` (harian, tanpa sudo).
  <br>✅ **Selesai bila:** QR terbaca lewat kamera virtual dan tercatat sebagai presensi.
  Terverifikasi berurutan: Chrome melihat "HP Scanner (DroidCam)" → pratinjau 1280×720 dari
  kamera HP di halaman Scanner → QR didekode lewat `/dev/video9` → baris presensi masuk dengan
  `device_code = NULL` dan `updated_by = NULL`, yaitu scan sungguhan, bukan koreksi manual.
  <br>✅ Watermark "using droidcam.app" (versi gratis) **tidak** merusak pembacaan: diuji dengan
  qr-scanner 1.4.2 pada QR berukuran 500/360/240/160 px di tengah frame, semuanya tetap terbaca.
  <br>⚠️ `exclusive_caps=1` wajib pada v4l2loopback. Tanpa itu kamera virtualnya ada di `/dev`
  tapi tidak pernah muncul di daftar kamera Chrome, tanpa pesan galat apa pun.
- [x] **FE-048** Beberapa kamera memindai bersamaan (permintaan pemilik proyek)
  <br>Satu gerbang bisa punya tiga pemindai; sebelumnya hanya satu kamera yang bisa dipilih.
  <br>✅ Setelan `siklon-kamera` berubah dari satu `deviceId` jadi daftar JSON. Nilai lama
  (string biasa) tetap terbaca sebagai daftar berisi satu — setelan yang sudah ada tidak hilang.
  <br>✅ Halaman Scanner menampilkan **satu kartu per kamera** dengan saklar dan pratinjaunya
  sendiri, menggantikan dropdown pilih-satu. Menyalakan saklar induk untuk pertama kali langsung
  memakai semua kamera yang terdeteksi; kalau defaultnya kosong, saklarnya menyala tapi tidak ada
  yang memindai — dan itu terlihat seperti kerusakan.
  <br>✅ `ModeKamera` tetap mengurus SATU kamera; banyak kamera = banyak komponen, satu per
  `deviceId`. Menggabungkan banyak stream ke dalam satu komponen akan mencampur penanganan izin
  dan galat tiap kamera jadi satu.
  <br>✅ **Penolak ulangan lintas kamera.** Dua kamera bersebelahan membaca kartu yang sama nyaris
  bersamaan; tiap komponen punya penolaknya sendiri tapi tidak saling tahu. Konsol Scan menahan
  NIS yang sudah tercatat selama 60 detik (disamakan dengan `scan.debounce_detik`) — tapi hanya
  bila hasilnya sukses atau "sudah absen". Penolakan lain dan galat jaringan tidak ditahan, supaya
  kartunya masih bisa dicoba lagi.
  <br>✅ **Selesai bila:** dua kamera memindai bersamaan dan kartunya tetap satu baris. Diuji
  dengan dua kamera **sungguhan** — webcam bawaan dan `/dev/video9` yang diberi umpan QR: kedua
  stream jalan, mematikan satu tidak mengusik yang lain, QR terbaca, dan kartu yang dibiarkan
  12 detik di depan keduanya tetap menghasilkan **1 baris**.
- [x] **FE-049** Konsol Scan tanpa tampilan kamera, tata letak 30/70 (permintaan pemilik proyek)
  <br>✅ Kartu "Perangkat scan" beserta video pratinjaunya dihapus. Kiri **30%** detail siswa yang
  barusan absen, kanan **70%** tabelnya. Terukur di browser: 387,9 px / 905,1 px = tepat 30/70.
  <br>⚠️ `grid-cols-[3fr_7fr]` saja **tidak cukup** — lebar minimum tabel menang atas pembagian
  `fr` dan kolom kiri terjepit jadi 15%. Harus `minmax(0,3fr)_minmax(0,7fr)`.
  <br>✅ Elemen video tetap dirender (1 px, transparan) karena pendekode membaca frame dari situ;
  dengan `display:none` pemindaian berhenti diam-diam.
  <br>✅ Yang hilang bersama video dikembalikan dalam bentuk lain: lencana "N kamera memindai" di
  bilah atas (merah bila ada yang gagal), dan **pesan galat kamera tetap ditampilkan penuh** —
  izin ditolak dan alamat non-HTTPS masing-masing butuh langkah perbaikan yang berbeda.
  <br>✅ Kartu hasil disesuaikan untuk kolom sempit: baris status boleh melipat, dan nama siswa
  **melipat, bukan dipotong** — "Andi Prata…" tidak ada gunanya bagi petugas.
- [x] **FE-050** Tombol "Ganti nomor" di halaman WhatsApp (10 September 2026)
  <br>Pasangan frontend untuk BE-081.
  <br>**Kenapa perlu:** nomor Baileys bisa kena blokir permanen kapan saja, dan sebelum ini
  menggantinya butuh SSH ke server untuk menghapus folder sesi. Sekolah yang kehilangan nomornya
  tidak boleh ikut kehilangan sistem presensinya hanya karena tidak ada yang bisa masuk server.
  <br>✅ Dialog konfirmasinya menyebut akibat yang sebenarnya — wali murid akan menerima pesan
  dari nomor berbeda, jadi nomor barunya harus diumumkan lebih dulu. Ini bukan tombol yang boleh
  ditekan tanpa persiapan.
  <br>✅ Dibedakan tegas dari "Putuskan & scan ulang" yang sudah ada: memutus tetap menyimpan
  sesinya dan menyambung lagi tanpa QR; ini membuang kredensialnya.

- [x] **FE-051** Absen pulang di layar (10 September 2026, permintaan pemilik proyek)
  <br>Pasangan frontend untuk BE-083.
  <br>✅ **Pengaturan → Jadwal**: medan *Jam pulang*, lengkap dengan penimpa per hari di samping
  *Jam masuk* — supaya Jumat yang pulang lebih awal bisa diatur di tempat yang sama.
  <br>✅ **Konsol Scan**: kartu hasil punya nada sendiri untuk pulang — biru dengan ikon keluar,
  bukan hijau seperti hadir. Petugas gerbang sore hari harus langsung tahu ini pulang, bukan
  datang, dan warna itu yang terbaca lebih dulu dari jarak dua meter. Riwayat menandai barisnya
  "Pulang", dan masuk & pulang dihitung dua kejadian terpisah (bukan saling menimpa).
  <br>✅ **Laporan Harian**: kolom *Jam Pulang* di samping *Jam Masuk*, bisa disortir.
  <br>✅ **Selesai bila:** terlihat benar di browser. Diuji 9/9 — medan setelan terisi 13:00,
  scan 13:15 memunculkan kartu PULANG biru (`rgb(224,242,254)`, beda dari hijau hadir), riwayat
  menandai "Pulang", dan kolom Jam Pulang di laporan terisi nilai nyata.

- [x] **FE-052** Hapus nama wali dari layar (10 September 2026, permintaan pemilik proyek)
  <br>Pasangan frontend untuk BE-084.
  <br>✅ Medan "Nama wali" hilang dari formulir siswa; halaman detail siswa kini menerangkan
  bahwa pesan menyapa "Bpk/Ibu" lalu langsung menyebut nama ananda.
  <br>✅ Chip variabel `{wali}` hilang dari editor templat WhatsApp.
  <br>✅ Petunjuk impor diperbaiki: aturan lama "nama wali dan nomornya sepasang" sudah tidak
  berlaku — nomor boleh dikosongkan, dan siswanya tetap tercatat presensinya.
  <br>🐛 **Bug yang ketahuan sambil jalan:** perkiraan volume di Pengaturan Kirim tidak
  menghitung kejadian `PULANG`, padahal justru itu tambahan volume yang perlu dilihat sebelum
  sekolah menyalakannya. Sekarang dihitung sebagai `penerima × (hadir + terlambat)` — setiap
  siswa yang datang juga pulang.

- [x] **FE-053** Jam masuk & pulang di matriks bulanan (10 September 2026, permintaan pemilik proyek)
  <br>Pasangan frontend untuk BE-085. Permintaannya digambar sebagai sketsa: satu sel dibelah dua,
  jam masuk di atas dan jam pulang di bawah — "bukan cuman hadir atau alfa".
  <br>✅ Sel hari yang ada scannya menampilkan dua baris jam; **warna selnya tetap** membawa
  status, jadi pola sebulan masih terbaca sekilas dari jauh. Hari tanpa jam (izin, sakit, alpa,
  libur) tetap huruf. Jam pulang yang kosong ditulis "—", bukan dibiarkan bolong.
  <br>✅ Kolom melebar dari 28px jadi 48px; tabelnya memang sudah bisa digeser mendatar dengan
  kolom nama yang tetap menempel, jadi tidak ada yang rusak — diuji ulang, 680px meluap dan
  kolom nama tetap di tempatnya.
  <br>✅ Kalender per siswa ikut menyebut jam pulang di tooltip-nya.
  <br>🐛 **Regresi yang baru ketahuan setelah ada data:** kartu "Aktivitas Terakhir" di Dashboard
  meluap 426px di layar 390px. Selama datanya kosong, kartunya kosong dan tidak pernah meluap —
  baru terlihat sesudah ada riwayat scan sungguhan. Penyebabnya `min-w-0` dan `shrink-0` yang
  hilang: nama siswa menolak dipotong dan gugus kanan menolak menyempit. Kolom titik scan juga
  disembunyikan di layar sempit (isinya sering "—" untuk scan kamera).

- [x] **FE-054** Hapus wali kelas dari layar (10 September 2026, permintaan pemilik proyek)
  <br>Pasangan frontend untuk BE-087. Kolom "Wali Kelas" hilang dari tabel Kelas, medan isiannya
  hilang dari dialog tambah/ubah kelas, dan baris "Wali Kelas: …" hilang dari kepala laporan.

- [x] **FE-055** Pergantian tahun ajaran bisa dikerjakan dari layar (10 September 2026)
  <br>Pasangan frontend untuk BE-088.
  <br>**Kenapa perlu:** kenaikan kelas yang sesungguhnya terjadi tepat di pergantian tahun —
  VII-A 2026/2027 naik ke VIII-A 2027/2028. Selama dialognya hanya menawarkan kelas tahun aktif,
  pergantian tahun mustahil dikerjakan tanpa menyentuh database langsung.
  <br>✅ Dialog **Kenaikan Kelas** dapat pemilih *"Kelas tujuan diambil dari tahun ajaran"*.
  Bawaannya tahun aktif, jadi perilaku lama tidak berubah. Tebakan kelas tujuan (naik satu
  tingkat) ikut memakai daftar kelas tahun tujuan.
  <br>✅ Dialog baru **Salin ke Tahun Lain** di halaman Kelas, menyalin nama & tingkat kelas ke
  tahun ajaran lain.
  <br>⚠️ **Peringatan yang wajib ada.** Sesudah kenaikan lintas tahun, siswa tercatat di kelas
  tahun berikutnya sementara tahun aktif masih yang lama — kelas tahun berjalan jadi terlihat
  **kosong**. Itu benar, tapi menakutkan kalau tidak dijelaskan, jadi dialognya menyatakannya
  terang-terangan dan mengingatkan untuk mengaktifkan tahun barunya. Kalau tahun tujuan belum
  punya kelas sama sekali, dialognya menyuruh menyalin dulu alih-alih membiarkan daftar kosong.
  <br>✅ **Selesai bila:** pergantian tahun berjalan utuh dari layar. Diuji 11/11: kerangka
  tersalin (6 kelas), siswanya TIDAK ikut tersalin, peringatan muncul, pratinjau menyebut tahun
  tujuan, 32 siswa benar-benar pindah ke VIII-A 2027/2028, dan **224 baris riwayat presensi tetap
  menunjuk kelas tahun lalu** — itu yang membuktikan rancangan "attendance menyimpan class_id
  sendiri" bekerja. Data dikembalikan otomatis di akhir uji.

- [x] **FE-056** Baris tombol di kepala halaman Kelas bisa turun baris (11 September 2026)
  <br>Cacat yang ditemukan uji `08-rilis.mjs`, bukan dilaporkan pengguna.
  <br>**Gejalanya:** di layar HP 390px seluruh halaman Kelas bisa digeser mendatar —
  `documentElement.scrollWidth` 434px melawan layar 390px. Biangnya tiga tombol di kepala kartu
  (*Salin ke Tahun Lain*, *Kenaikan Kelas*, *+ Tambah Kelas*) yang totalnya ±400px dalam satu
  `flex` tanpa `flex-wrap`. `CardHeader` memang sudah `flex-wrap`, tapi itu hanya menurunkan
  barisnya sebagai satu kesatuan — isi barisnya sendiri tetap tidak boleh melar.
  <br>✅ Diperbaiki dengan menambah `flex-wrap` pada barisnya saja. Halaman lain yang punya pola
  serupa sudah benar sejak awal dan ikut terperiksa: sebelas halaman lolos di 390px dan 820px.
  <br>ℹ️ Ini persis jenis cacat yang tidak pernah terlihat saat mengembangkan di laptop, dan
  alasan FE-042 layak dijaga uji otomatis, bukan sekadar dicentang sekali.

- [x] **FE-057** Konten memakai lebar layar penuh (11 September 2026, dilaporkan pemilik proyek)
  <br>**Gejalanya:** di layar 1885px ada pita kosong ±230px di tepi kanan, menumpuk di satu sisi
  sehingga terlihat seperti salah pasang, bukan kolom yang sengaja ditengahkan.
  <br>**Sebabnya:** `<main>` di `app-shell.tsx` dibatasi `max-w-[1420px]` tanpa `mx-auto`.
  236px sidebar + 1420px konten = 1656px, sisanya jatuh semua ke kanan.
  <br>✅ Batasnya dilepas. Isi aplikasi ini tabel dan matriks, bukan paragraf — batas lebar baca
  tidak berlaku di sini. Konsol Scan dan Rekap Bulanan justru makin terbaca dengan lebar penuh,
  dan matriks sebulan yang harus digeser mendatar jadi lebih banyak muat sekali lihat.
  <br>✅ Tata letak 30/70 Konsol Scan tetap utuh sesudahnya: 473px / 1105px di layar 1885px,
  tepat 30%. Uji `08-rilis.mjs` lolos 12/12 — sebelas halaman tetap tidak meluap di 390px
  maupun 820px.

- [x] **FE-058** Tombol unduh PDF di Rekap Bulanan per kelas (13 September 2026)
  <br>Pasangan frontend untuk BE-090.
  <br>**Kenapa perlu:** matriks sebulan satu kelas hanya punya tombol Excel, jadi satu-satunya
  cara mencetaknya adalah membuka Excel dulu lalu mencetak dari sana. Sekarang berdampingan:
  **Excel** untuk diolah, **PDF** untuk langsung dicetak.
  <br>✅ Diverifikasi di browser: kedua tombol muncul, yang PDF menjawab 200 `application/pdf`
  sebesar ±26 KB, dan tidak ada error JavaScript.

- [x] **FE-059** Tombol PDF membuka tab baru, bukan mengunduh (13 September 2026, permintaan pemilik proyek)
  <br>Ketiga tombol PDF (harian, matriks bulanan, rekap per siswa) kehilangan atribut `download`
  dan berganti jadi `target="_blank" rel="noopener noreferrer"`. Labelnya jadi **"Lihat PDF"**
  supaya yang dijanjikan tombol sama dengan yang terjadi.
  <br>⚠️ **Atribut di link saja tidak cukup.** Tanpa `Content-Disposition: inline` dari server
  (BE-090), `target="_blank"` tetap berakhir sebagai unduhan: tabnya terbuka sekejap lalu
  tertutup sendiri dan berkasnya mendarat di folder Unduhan. Keduanya harus berpasangan.
  <br>✅ Tombol **Excel** sengaja tetap mengunduh — browser tidak bisa menampilkannya.
  <br>✅ Diverifikasi dengan mengklik tombolnya sungguhan di browser: tab bertambah dari 2 jadi 3,
  URL tab barunya `harian.pdf?...` dan `kelas.pdf?...`, tidak ada berkas yang terunduh, dan tidak
  ada error JavaScript.

- [x] **FE-060** Rekap per siswa pindah ke baris matriks; tab "Per Siswa" dibuang (13 September 2026, permintaan pemilik proyek)
  <br>**Yang berubah:** halaman Laporan Bulanan tidak lagi bertab. Yang tersisa hanya matriks per
  kelas, dan tiap barisnya mendapat dua tombol di kolom pertama — **cetak** (membuka PDF rekap
  siswa itu di tab baru) dan **Excel** (mengunduh rekapnya).
  <br>**Kenapa lebih baik:** alur lamanya berputar. Orang melihat di matriks bahwa si A banyak
  alpa, lalu harus pindah tab dan mengetik ulang namanya di kotak pencarian untuk mencetak
  rekapnya. Sekarang tombolnya ada tepat di baris yang sedang dilihat.
  <br>✅ **Tidak ada yang hilang.** Tampilan kalender yang dulu ada di tab itu sudah tersedia di
  halaman detail siswa (`/siswa/[id]`), lengkap dengan riwayat presensi dan penggeser bulan —
  tab itu memang duplikatnya.
  <br>✅ Tombolnya ikut di dalam kolom sticky, jadi tetap terjangkau saat matriks digeser ke
  tanggal 25 — di situlah justru orang memutuskan rekap siapa yang perlu dicetak. Terbukti: posisi
  kirinya tetap 443px setelah digeser 500px.
  <br>⚠️ Tombolnya sengaja **tidak** disembunyikan sampai barisnya di-hover. Sejak tab itu dibuang,
  ini satu-satunya jalan ke rekap per siswa; kalau baru muncul saat disentuh, orang yang belum tahu
  tidak akan pernah menemukannya.
  <br>✅ `aria-label`-nya menyebut nama siswanya ("Lihat dan cetak rekap bulanan Ahmad Fauzan"),
  bukan label umum yang berulang 32 kali.
  <br>✅ Diuji di `07-laporan.mjs`: 32 blok aksi untuk 32 baris, tab sudah nol, tautannya benar
  (`siswa.pdf` ke tab baru, `siswa.xlsx` mengunduh), dan tanpa error JavaScript.

- [x] **FE-061** Laporan Harian jadi satu tabel berisi data kelas (13 September 2026, permintaan pemilik proyek)
  <br>**Yang berubah:** halaman Laporan Harian tidak lagi bertab. Tab "Per Siswa" — satu daftar
  panjang seluruh sekolah dengan kolom Kelas — dihapus. Yang tampil sekarang **satu tabel saja**,
  isinya data per kelas (jumlah siswa, hadir, terlambat, izin, sakit, alpa, % hadir) beserta baris
  TOTAL SEKOLAH. Detail per siswa ada di cetakannya, yang memang sudah dipecah satu kelas per
  halaman (BE-093).
  <br>**Kenapa lebih baik:** daftar gabungan seluruh sekolah tidak pernah dipakai utuh — yang
  dicari orang selalu "kelas mana", dan jawabannya harus dicari dengan menyaring atau menyortir
  dulu.
  <br>⚠️ **Daftar siswa tetap bisa dibuka dengan mengklik nama kelas, dan itu wajib.** Mengoreksi
  status presensi (izin/sakit, dengan alasan wajib) hanya bisa dilakukan dari baris siswa, dan
  layar ini **satu-satunya tempatnya di seluruh aplikasi**. Menghapus daftar siswa sepenuhnya akan
  membuat koreksi status mustahil dikerjakan. Tetap satu tabel di layar pada satu waktu.
  <br>🐛 **Cacat yang tertangkap saat verifikasi**, pada versi sebelumnya yang menumpuk kartu per
  kelas: pengelompokan menyatukan baris yang BERURUTAN, dengan anggapan server mengurutkan per
  kelas. Ternyata `/attendance` mengurutkan siswa berdasarkan **nama saja**, jadi barisnya datang
  berselang-seling — hasilnya 90 kelompok berisi satu siswa masing-masing, padahal jumlah baris
  keseluruhannya tetap benar. Pelajarannya sudah dituangkan ke ujinya: cocokkan per kelompok,
  bukan cuma totalnya.
  <br>✅ Diverifikasi di browser dengan 3 kelas: satu tabel, 3 baris (VII-A 32 · VII-B 30 ·
  VIII-A 28), TOTAL SEKOLAH 90 siswa, dan klik "VII-B" membuka 30 siswanya lengkap dengan tombol
  Ubah — masih satu tabel.

- [x] **FE-062** Password tidak lagi bisa bocor ke URL saat login (13 September 2026)
  <br>🐛 **Cacat keamanan nyata**, ditemukan dari log dev saat menelusuri uji yang gagal:
  <br>`GET /login?username=superadmin&password=...`
  <br>**Sebabnya:** sebelum React terpasang, `onSubmit` belum terikat, jadi menekan tombol Masuk
  (atau Enter) menjalankan pengiriman form **bawaan browser**. Form tanpa `action` dikirim sebagai
  **GET ke URL yang sama**, sehingga passwordnya mendarat di query string — tercatat di riwayat
  browser, bilah alamat, dan log server. Jendelanya memang sempit, tapi di laptop sekolah yang
  lambat justru di situlah pengguna yang tidak sabar menekan Enter.
  <br>✅ Dua lapis: `method="post"` pada form (kalaupun ada pengiriman bawaan yang lolos, isinya
  tidak pernah jadi query string), dan tombol Masuk **disabled sampai React terpasang** — tombol
  submit yang mati juga menutup jalur Enter, karena pengiriman implisit butuh tombol submit aktif.
  <br>✅ Diuji dengan JavaScript dimatikan (tiruan keadaan pra-hidrasi), lalu pengirimannya
  **dipaksa** lewat Enter dan klik: URL tetap bersih `http://localhost:3000/login`, dan login
  normal tetap mendarat di /dashboard. Dikunci di `01-autentikasi.mjs` (13/13).

- [x] **FE-063** Konsol Scan menerima scan dari scanner USB mode keyboard (HID/"keyboard-wedge"),
  bukan cuma pemindai serial via Scanner Agent (23 September 2026)
  <br>*Selesai bila:* scanner yang belum/tidak bisa dipindah ke mode serial tetap bisa mencatat
  presensi lewat Konsol Scan, tanpa perlu ubah setelan apa pun di scanner-nya.
  <br>**Kenapa perlu:** scanner client sungguhan (merek Mingma MC26) tidak punya dokumentasi mode
  interface yang bisa ditemukan, dan tetap mengetik sebagai keyboard walau Scanner Agent/NSSM-nya
  sudah beres — dibuktikan lewat tes ketik ke Notepad. Perlu jalan pintas yang tidak bergantung
  pabrikan scanner mau kooperatif atau tidak.
  <br>✅ Listener global di `apps/web/src/app/(app)/scan/page.tsx`: ketikan beruntun <50ms antar
  karakter (khas scanner, beda dari kecepatan mengetik manusia) yang diakhiri Enter dianggap satu
  scan, dikirim lewat jalur yang SAMA dengan scan kamera (`catatKode`, sebelumnya bernama
  `catatDariKamera` — diganti nama karena sekarang dipakai dua sumber). Diam otomatis kalau fokus
  sedang di kolom form (mis. pencarian di dialog Presensi Manual) supaya tidak mengganggu
  pengetikan biasa.
  <br>⚠️ **Trade-off yang disampaikan ke pemilik proyek sebelum dikerjakan:** jalur ini TIDAK
  punya antrean offline seperti Scanner Agent (`antrean.sqlite`) — kalau server tidak terjangkau
  saat scan, presensi itu tidak tersimpan otomatis untuk dikirim ulang. Diterima sebagai solusi
  sementara; begitu scanner berhasil dipindah ke mode serial, jalur Scanner Agent otomatis
  mengambil alih tanpa perlu ubah kode apa pun (scanner berhenti mengetik begitu mode-nya
  berganti).
  <br>⚠️ **Belum diuji dengan scanner fisik sungguhan** — baru diverifikasi lewat `tsc --noEmit`
  bersih dan `next dev` compile ulang tanpa error di 3 kali suntingan.

- [x] **FE-064** Lampiran foto (mis. surat keterangan sakit) di dialog "Ubah status presensi"
  untuk status IZIN/SAKIT (23 September 2026)
  <br>*Selesai bila:* admin bisa melampirkan foto JPG/PNG saat menandai siswa IZIN/SAKIT, melihatnya
  lagi nanti, dan menghapus/menggantinya — beserta indikator di tabel Laporan Harian kalau baris itu
  punya lampiran.
  <br>✅ `apps/web/src/app/(app)/laporan/harian/dialog-ubah-status.tsx`: input berkas muncul kalau
  status IZIN/SAKIT dipilih, pratinjau lokal (object URL) sebelum diunggah, diunggah SETELAH status
  tersimpan (butuh id presensi yang baru terbentuk untuk baris yang sebelumnya belum ada). Lampiran
  yang sudah ada ditampilkan lewat `<img>` langsung ke endpoint API — bukan fetch+blob — karena
  autentikasinya cookie httpOnly (`credentials: include` pada `fetch`, otomatis ikut di request
  gambar biasa juga).
  <br>✅ `isi.tsx` (tabel Laporan Harian): ikon `PaperclipIcon` di kolom Catatan kalau baris itu
  punya lampiran.
  <br>Pasangan backend: BE-108/BE-109 di `TASKS-BACKEND.md`.

- [x] **FE-065** Kolom "Jam masuk" bisa diisi manual di dialog "Presensi manual" (24 September 2026)
  <br>*Selesai bila:* admin bisa mengoreksi jam masuk saat mencatat presensi manual — bukan selalu
  jam saat tombol "Catat presensi" diklik.
  <br>**Kenapa perlu (dilaporkan pemilik proyek):** presensi manual sering baru diinput BELAKANGAN
  (bukan persis saat siswanya datang) — kalau jam selalu diambil dari waktu klik, siswa yang
  datang jam 7 tapi baru dicatat admin jam 10 akan salah tercatat TERLAMBAT.
  <br>✅ Backend (`POST /attendance/manual`) **sudah lama** menerima parameter `waktu` opsional —
  gap-nya murni di frontend, dialognya belum punya kolom untuk mengisi itu. Ditambahkan
  `<input type="time">` di `dialog-manual.tsx`, default ke jam saat dialog dibuka (bisa diubah),
  dikirim sebagai `${hariIni()}T${jam}:00+07:00` — WIB ditulis langsung sebagai `+07:00` tanpa
  lewat `Date`/`Intl` karena Indonesia tidak punya DST, jadi offsetnya tetap sepanjang tahun.

**Penyesuaian FE-049 (10 September 2026, permintaan pemilik proyek).** Kartu penjelasan halangan
kamera di Konsol Scan dipersempit: hanya muncul untuk halangan yang **bisa ditindaklanjuti petugas
saat itu juga** — `izin-ditolak` dan `tidak-aman` (bukan HTTPS). Kamera yang dicabut atau browser
yang tidak mendukung tidak lagi menampilkan kartu apa pun: tidak ada yang bisa dikerjakan petugas
gerbang, dan kartu sebesar itu hanya memakan layar. Keadaannya tetap terlaporkan lewat lencana
"N kamera bermasalah" di bilah atas. Diuji: kartu "Kamera tidak ditemukan" hilang sementara kedua
pesan FE-029 beserta langkah perbaikannya tetap utuh (6/6).

---

## Temuan penting di Fase 0 & 1

1. **Nilai dari modul `'use client'` tidak boleh diimpor ke server component.** `ScriptTema`
   (server component) mengimpor `KUNCI_TEMA` dari `hooks/use-tema.ts` yang bertanda `'use client'`.
   Next menggantinya dengan stub, sehingga skrip tema yang tercetak ke HTML berbunyi
   `localStorage.getItem('function() { throw new Error(...)')` — **gagal diam-diam**: tidak ada
   error saat build maupun typecheck, temanya hanya tidak pernah menyala. Konstanta seperti ini
   sekarang tinggal di `src/lib/tema.ts` yang netral. Pelajaran umumnya: bug seperti ini hanya
   terlihat kalau halamannya benar-benar dibuka di browser.

2. **Cookie tidak peduli nomor port.** `apps/web` di `:3000` dan `apps/api` di `:4000` berbagi
   cookie `siklon_token` karena cookie dikunci ke host, bukan port. Itu sebabnya `sameSite: 'lax'`
   sudah cukup dan middleware Next bisa membaca cookie yang dipasang API. Yang tetap wajib:
   `credentials: 'include'` di sisi fetch dan `CORS_ORIGINS` yang memuat `http://localhost:3000`.

3. **Menu untuk modul yang belum ada ditampilkan, tapi tidak bisa diklik.** Sidebar memuat seluruh
   12 menu dari mockup; yang backend-nya belum selesai dirender redup dengan keterangan "belum
   tersedia". Lebih jujur daripada menu yang mengantar ke halaman 404, dan peta aplikasinya
   tetap terlihat utuh. Ubah `siap: false` → `true` di `src/lib/navigasi.ts` saat halamannya jadi.

4. **Formulir Buat Akun turun ke bawah tabel di layar < 1536px.** Berdampingan dengan tabel di
   layar laptop 1440px membuat kolom Aksi terpotong. Aksi yang jarang dipakai (cabut sesi,
   nonaktifkan) juga dipindah ke menu titik-tiga.

5. **Akun `superadmin` di database pengembangan sempat tidak bisa dipakai** karena passwordnya
   sudah diganti saat pengujian backend. Dikembalikan ke `siklon123`. Kalau nanti terkunci lagi:
   `pnpm --filter @siklon/api hash "<password>"` lalu `UPDATE users SET password_hash=…`.

---

## Temuan penting di Fase 2

1. **Dialog Radix yang sedang menutup masih menelan klik.** Overlay-nya belum lepas dari DOM
   selama animasi keluar, jadi tombol di belakangnya tidak bisa diklik dan tombol dialog lama
   masih terdeteksi. Ini muncul sebagai pengujian yang gagal padahal aplikasinya benar. Kalau
   menulis otomatisasi untuk halaman ini, tunggu `[role="dialog"]` benar-benar hilang dulu.

2. **Menu Radix (`DropdownMenu`, `Select`) tidak terbuka oleh `element.click()`.** Radix
   mendengarkan `pointerdown`, bukan `click`, jadi klik sintetis dari skrip tidak berpengaruh.
   Perlu klik mouse sungguhan.

3. **Pencarian memakai `push`, bukan `replace`, tapi hanya setelah debounce.** Kalau setiap huruf
   ditulis ke riwayat, tombol Back jadi tidak berguna (perlu 4 kali tekan untuk membatalkan
   "Andi"). Kalau semuanya `replace`, Back malah melompat keluar halaman. Debounce dulu, baru
   satu `push` per kata kunci — itu yang membuat kriteria FE-013 terpenuhi.

4. **Nilai `?next=` dan filter dari URL selalu divalidasi.** Filter yang sama dengan nilai bawaan
   tidak ditulis ke URL, supaya alamatnya tidak penuh parameter kosong yang membingungkan saat
   di-bookmark.

5. **Tanggal dihitung dengan UTC, bukan waktu lokal.** API mengirim `YYYY-MM-DD` yang sudah dalam
   zona Asia/Jakarta. `new Date('2026-09-01')` ditafsirkan sebagai tengah malam UTC — dibaca
   dengan `getDate()` lokal, tanggalnya bisa mundur sehari di zona barat. Semua perhitungan
   kalender memakai `Date.UTC` dan `getUTCDay()`.

6. **Perubahan skema backend bisa mendarat tanpa suara.** Tabel `guardians` dihapus dan wali
   pindah jadi kolom di `students` saat frontend-nya sudah jadi. Yang menyelamatkan: tipe di
   `src/lib/tipe.ts` ditulis mengikuti nama kolom database persis, jadi satu `pnpm typecheck`
   langsung menunjuk setiap tempat yang perlu diubah. Kalau tipenya diterjemahkan jadi nama
   sendiri, ketidakcocokan seperti ini baru ketahuan saat halamannya dibuka pengguna.

7. **`pnpm build` merusak `pnpm dev` yang sedang berjalan.** Keduanya memakai direktori `.next`
   yang sama; sesudah build, dev server menjawab 500 dengan error menyesatkan
   (`a[d] is not a function`) yang sama sekali tidak menunjuk ke penyebabnya. Hentikan dev,
   `rm -rf .next`, baru build.

8. **Data presensi contoh sengaja ditinggalkan di database pengembangan.** Sekitar 16 baris untuk
   ketiga siswa seed sepanjang 1–8 September 2026 (campuran hadir, terlambat, izin, sakit, alpa)
   supaya kalender, matriks bulanan, laporan harian, dan grafik tren ada isinya saat dibuka.
   Membersihkannya: `DELETE FROM attendance;`

---

## Temuan penting di Fase 3

1. ~~**Endpoint `/scans` tidak bisa dipanggil browser — ini menahan mode kamera.**~~
   ✅ **SELESAI 9 September 2026.** Ia dijaga `X-Api-Key` milik Scanner Agent, dan kunci itu tidak
   boleh ada di frontend (`NEXT_PUBLIC_*` ikut terkirim ke browser). Sempat diakali lewat
   `POST /attendance/manual`, sehingga scan kamera tercatat `MANUAL` di laporan.
   → Backend menambahkan **BE-078 `POST /attendance/scan`** (JWT, tanpa titik scan), dan konsol
   memakainya. Kamera kini sumber input kelas satu seperti janji PLAN.md — "tiga sumber, satu
   perlakuan".

2. **`api.patch(path, body, { method: 'PUT' })` diam-diam tidak berpengaruh.** Pada helper
   `api`, `method` ditulis **sesudah** `...opsi`, jadi ia menimpa nilai yang dioper pemanggil dan
   permintaannya tetap terkirim sebagai PATCH — dijawab 404 oleh rute yang hanya menerima PUT.
   Ini membuat **simpan Pengaturan tidak pernah benar-benar tersimpan** sejak Fase 2 dan tidak
   ketahuan, karena asersi ujinya ditulis `… || true` sehingga selalu lulus.
   → Ditambahkan `api.put`, dan asersi yang lemah itu diperketat.
   Pelajarannya: asersi yang tidak bisa gagal lebih buruk daripada tidak ada asersi.

3. **Setting di-cache di memori backend, jadi jangan bersihkan lewat SQL.** `DELETE FROM settings`
   tidak membuang cache-nya (BE-031), dan API tetap menyajikan nilai lama. Skrip penyiapan
   pengujian sekarang mengosongkan pemetaan scanner lewat `PUT /scanners`.

4. **Satu kejadian bisa sampai dua kali ke layar.** Presensi manual dan scan kamera menerima
   balasan HTTP **dan** siaran Socket.IO untuk kejadian yang sama. Riwayat di konsol menolak
   entri kembar berdasarkan NIS + jam + titik scan.

5. **AudioContext ditahan browser sampai ada gestur pengguna.** Kalau bunyi pertama dipicu oleh
   scan (bukan oleh klik), ia hilang begitu saja. Tombol "Bunyi" di konsol sekaligus berfungsi
   sebagai gestur pembangun konteks — dan langsung membunyikan contoh supaya petugas tahu
   suaranya hidup.

6. **`DOMException.name` tidak bisa ditimpa `Object.assign`.** Muncul saat menulis pengujian yang
   memalsukan penolakan izin kamera: namanya adalah getter di prototipe, jadi harus dioper lewat
   argumen kedua konstruktor (`new DOMException(pesan, 'NotAllowedError')`). Salah di sini membuat
   kode masuk ke cabang error generik, bukan cabang "izin ditolak".

---

## Temuan penting di Fase 4

1. **Provider `dummy` tidak pernah menerbitkan QR, jadi alur pairing tidak bisa diuji apa adanya.**
   Pengujiannya memalsukan respons `/wa/status` di browser dengan urutan: QR A → QR B →
   tersambung. Yang diuji tetap perilaku layar yang sesungguhnya (mengganti gambar QR sendiri,
   lalu berpindah keadaan tanpa muat ulang), bukan sekadar "halaman terbuka".

2. **Variabel template di mockup sudah tidak berlaku.** Mockup menulis `{nama_wali}`,
   `{nama_siswa}`, `{menit_terlambat}`, `{nama_sekolah}`; backend memakai `{wali}`, `{siswa}`,
   `{menit}`, `{sekolah}`. Karena backend sengaja **membiarkan** placeholder tak dikenal apa
   adanya, template yang menyalin mockup akan mengirim tulisan `{nama_wali}` mentah ke wali
   murid. Editor sekarang memperingatkannya secara aktif.

3. **Angka perkiraan harus jujur tentang asalnya.** Volume pesan dihitung dari data nyata
   (jumlah penerima + proporsi kehadiran hari ini). Kalau data hari ini belum cukup, layar
   menyatakan bahwa proporsinya perkiraan kasar. Angka yang tampak pasti padahal ditebak lebih
   berbahaya daripada angka yang mengaku perkiraan — apalagi kalau dipakai memutuskan batas
   pesan/hari.

4. **Skrip pengujian harus mengembalikan template ke nilai seed.** Run pertama menyimpan template
   baru, dan run berikutnya mengetik teks yang sama sehingga tombol Simpan nonaktif ("tidak ada
   yang berubah") — pengujiannya gagal karena keadaan sisa, bukan karena aplikasinya rusak.

5. **Asersi yang cocok dengan basa-basi UI tidak membuktikan apa pun.** Pemeriksaan "isi pesan
   bisa dilihat" sempat lulus hanya karena mencocokkan kalimat penjelasan di dialog. Sekarang ia
   membaca isi gelembungnya langsung lewat penanda `data-uji`.

---

## Temuan penting di Fase 5

1. **Dua endpoint untuk data yang mirip, dan hanya satu yang bisa dipakai.** `GET /reports/harian`
   lebih kaya (memuat `wa_status`), tapi tidak mengembalikan `siswaId` maupun `presensiId` —
   padahal keduanya wajib untuk mengubah status. Laporan harian karena itu memakai
   `GET /attendance`, dan endpoint laporan disisakan untuk unduhan Excel/PDF.

2. **Baris total tidak boleh jadi baris tabel.** Kalau TOTAL SEKOLAH ikut di dalam `<tbody>`, ia
   akan ikut tersortir saat kolom lain diklik dan berpindah ke tengah daftar. Ia dirender
   terpisah di bawah tabel.

3. **Lebar minimum membuat sticky column jadi bermakna.** Tanpa lebar minimum, kolom tanggal
   menyusut agar matriks muat di layar — tabelnya jadi tidak meluap, sticky-nya tidak pernah
   terpakai, dan angkanya tidak terbaca. Ketiganya masalah yang sama.

4. **`innerText` mengembalikan teks yang sudah diubah `text-transform`.** Label "Hadir" yang
   dirender uppercase terbaca sebagai "HADIR", sehingga pemeriksaan yang peka huruf besar-kecil
   gagal padahal tampilannya benar. Pengujian tampilan harus mencocokkan apa yang dirender,
   bukan apa yang ditulis di kode.

5. **Label grafik terpotong justru pada keadaan yang paling sering muncul.** Angka di titik
   terakhir digambar di atas titiknya; saat kehadiran 100% titiknya menempel di tepi atas dan
   labelnya keluar viewBox. Ketahuan hanya karena grafiknya benar-benar dilihat setelah
   dirender — bukan dari typecheck maupun dari pengujian yang lulus.

6. **Tombol mati tanpa penjelasan adalah bug tersendiri.** "Kirim rekap ke wali" dinonaktifkan
   karena endpointnya belum ada; alasannya ditulis di layar. Sama untuk tombol Simpan pada
   dialog ubah status saat catatannya kosong.

---

## Temuan penting di Fase 6

1. **Bug responsif hampir selalu ada di komponen bersama, bukan di halaman.** `/kelas` meluap 8px
   di layar 390px karena `CardHeader` tidak membungkus — dan pola "judul + tombol aksi" itu
   dipakai di hampir semua kartu. Memperbaikinya di komponen menyelesaikan seluruh halaman
   sekaligus; memperbaikinya di `/kelas` saja hanya menunda kemunculannya di tempat lain.

2. **"Tidak ada layar putih" ternyata dua kriteria, bukan satu.** Saat API mati total, penjaga
   sesi di layout sudah menangkap semuanya. Yang tidak tertangkap adalah keadaan yang lebih
   halus: sesi hidup, tapi data halamannya gagal. Tiga halaman diam saja dan terlihat
   "normal tapi kosong" — pengguna akan mengira datanya memang belum ada, bukan bahwa servernya
   tidak terjangkau. Menguji hanya kasus pertama akan melewatkan ketiganya.

3. **Percobaan ulang yang terlalu rajin terasa seperti aplikasi menggantung.** Dua kali retry
   dengan backoff membuat pengguna menatap kerangka kosong ~6 detik sebelum ada penjelasan.
   Untuk error jaringan cukup satu kali; untuk 5xx dua kali tetap masuk akal.

4. **Wake Lock dilepas browser saat tab disembunyikan.** Ia harus diminta ulang pada
   `visibilitychange`, kalau tidak kuncinya hilang diam-diam setelah operator berpindah tab
   sekali — dan layar gerbang mati di tengah jam masuk.

5. **Esc harus menutup kiosk, bukan hanya keluar dari layar penuh.** Browser menangani Esc untuk
   fullscreen sendiri; kalau overlay-nya tidak ikut ditutup, petugas melihat layar yang seolah
   tidak bisa dikeluarkan.

6. **`innerWidth` memuat lebar scrollbar, `getBoundingClientRect` pada elemen `fixed` tidak.**
   Selisih ~15px itu membuat pemeriksaan "menutupi seluruh layar" gagal padahal tampilannya
   benar. Bandingkan dengan lebar `body`, bukan dengan `innerWidth`.

7. **Dev server perlu dipanaskan sebelum diuji.** Setelah `.next` dihapus, permintaan pertama ke
   tiap rute memicu kompilasi yang bisa memakan puluhan detik — pengujian gagal karena menunggu
   elemen yang halamannya memang belum selesai dibangun, bukan karena aplikasinya rusak.

---

## Temuan sesudah rilis

1. **Pendekode QR kamera tidak pernah benar-benar bekerja, dan pengujiannya tetap hijau.**
   Lihat catatan di FE-030. Pelajaran yang lebih umum: asersi yang memeriksa *konfigurasi*
   ("pustaka mana yang dipilih") tidak membuktikan *hasil* ("QR terbaca"). Untuk fitur yang
   bergantung pada perangkat keras, umpan palsu harus memuat data yang sesungguhnya —
   Chrome bisa diberi berkas video lewat `--use-file-for-fake-video-capture`.

2. **Menelan error membuat kegagalan jadi tak terlihat.** `await pemindai.start().catch(() => undefined)`
   menghilangkan satu-satunya petunjuk yang mungkin ada. Sekarang kegagalan pemindai
   ditampilkan sebagai halangan di layar, bukan didiamkan.

3. **Cookie yang ditolak server harus dibuang, bukan sekadar dialihkan.** Middleware yang menilai
   sesi dari "ada tidaknya cookie" akan memantulkan pengguna kembali ke halaman terproteksi
   selama cookie basi itu masih ada. Gejalanya: layar diam menampilkan kerangka pemuatan, dengan
   satu-satunya petunjuk berupa 401 di konsol. Lihat catatan di FE-008.

4. **Daftar port scanner disimpan di memori server dan bertahan setelah agent mati.** Layar
   sempat terlihat bertentangan: "Scanner Agent belum melapor" tapi 2 port tetap terdaftar
   (sisa simulasi pengujian). Sekarang keterangannya menyebut "dari laporan terakhir, agent
   sedang offline". Membersihkannya tanpa me-restart API: `POST /agent/hello` dengan
   `{"ports":[]}`.

5. **Prop callback yang tidak stabil bisa mematikan perangkat keras, bukan sekadar memperlambat.**
   Di komponen biasa, dependensi efek yang berubah tiap render cuma memboroskan render. Di
   `ModeKamera` akibatnya terlihat pengguna: kamera dimatikan dan dinyalakan ulang tanpa henti.
   Aturan yang dipakai sekarang — callback dari luar disimpan di ref, tidak pernah jadi dependensi
   efek yang mengelola sumber daya. Lihat FE-046.

6. **Uji yang MENGUBAH data harus mengembalikannya sendiri.** Uji Fase 5 mengubah status seorang
   siswa jadi IZIN lewat dialog, lalu membiarkannya. Jalan berikutnya menemukan siswa itu sudah
   IZIN dengan catatan terisi, dialognya mulai dari keadaan lain, dan tiga asersi gagal karena
   sebab yang sama sekali salah. Sekarang tanggal ujinya direset lebih dulu. Asersi yang mematok
   angka data (`barisHarian === 3`) juga diganti jadi menghitung sendiri — kelasnya bisa berisi
   3 siswa atau 32.

7. **Pengujian tidak boleh menumpang sisa pengujian lain.** Uji Fase 3 dulu mengandalkan port
   scanner palsu yang kebetulan masih tersimpan di memori server dari sesi sebelumnya; begitu
   sisa itu dibersihkan, ujinya gagal padahal aplikasinya sehat. Sekarang ujinya melapor sendiri
   lewat `POST /agent/hello` di awal dan mengosongkannya lagi di akhir — dengan satu pemeriksaan
   khusus yang memastikan tidak ada port palsu tertinggal di layar pengguna.

8. **Pemeriksaan kesiapan bisa merusak yang diperiksanya.** Skrip `hp-webcam.sh` semula menunggu
   aliran video siap dengan `curl` ke `/video`. DroidCam hanya melayani satu klien video, jadi
   probe itu merampas jatahnya dan ffmpeg sesudahnya kebagian aliran kosong — gagal dengan
   "No JPEG data found in image", dan di HP terlihat sebagai kamera yang menyala sekejap lalu
   tertutup. Dugaan pertama (`-fflags nobuffer` menolkan `analyzeduration`) **salah**; baru
   ketahuan setelah tiga percobaan terkontrol: ffmpeg sendirian berhasil, didahului probe
   `/video` gagal, didahului probe `/remote` berhasil. Sekarang yang diperiksa `/remote`.

9. **Menyembunyikan tampilan tidak boleh ikut menyembunyikan penjelasan galat.** Saat video
   dihapus dari Konsol Scan (FE-049), pesan "izin kamera ditolak" dan "bukan HTTPS" ikut hilang —
   padahal keduanya justru dibuat karena tidak bisa ditebak sendiri oleh petugas. Ketahuan dari
   uji Fase 3 yang gagal, bukan dari membaca kode. Sekarang halangan kamera dilaporkan ke atas
   lewat `onKeadaan` dan ditampilkan sebagai spanduk.

10. **Pengujian di mesin pengembangan berebut perangkat dengan browser pengguna.** Kamera
   `/dev/video9` hanya bisa dibuka satu proses browser; ketika jendela Chrome milik pemilik
   proyek sedang membuka Konsol Scan, Chrome uji dapat `NotReadableError` dan hasilnya terlihat
   seperti bug aplikasi. Uji multi-kamera sekarang memeriksa `fuser /dev/video9` lebih dulu dan
   **melewati** pemeriksaan yang butuh kamera itu, bukan menyatakannya gagal.

---

## Perubahan atas permintaan pemilik proyek (9 September 2026)

**Kamera dan pemindai serial tidak lagi dibedakan — di data maupun di tampilan.**

Alasannya lugas: sistem ini tidak perlu mencatat siswa absen lewat mana, dan tidak perlu
menghitung jumlah absen per kamera/scanner. Yang penting siswanya tercatat hadir dan walinya
dikabari.

Yang berubah:

| Sebelum | Sesudah |
|---|---|
| Scan kamera dicatat lewat `/attendance/manual` → `device_code = 'MANUAL'`, ditandai koreksi manual | Lewat `POST /attendance/scan` (BE-078) → `device_code = NULL`, `updated_by = NULL` |
| Konsol Scan punya pemilih "Sumber input: Scanner Serial / Kamera" | Pemilihnya dihapus; konsol menerima scan dari mana pun |
| Setelan kamera tersebar di Konsol Scan | Digabung ke halaman Scanner, satu tempat dengan pemindai serial |
| `HasilScan.titikScan: string` | `string \| null` — boleh tidak tercatat |

Yang **tidak** diubah, beserta alasannya:

- **Presensi manual tetap ditandai `MANUAL`.** Itu memang beda: admin mencatatnya tanpa scan, dan
  alasannya wajib ditulis supaya bisa dipertanggungjawabkan.
- **Halaman Scanner tetap ada.** Scanner Agent butuh tahu port mana yang boleh dibuka, jadi
  daftar port dan saklar aktifnya masih berfungsi.
- **Kolom "Titik Scan" di riwayat konsol tetap ada.** Isinya `—` untuk scan kamera, dan kode
  gerbang untuk pemindai serial yang memang mengirimkannya. Tidak ada yang dihitung dari kolom
  ini; ia sekadar keterangan.
