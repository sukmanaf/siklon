# 📖 BUKU PANDUAN PENGGUNAAN PRESENSEE

Selamat datang di aplikasi **PresenSee**. Buku panduan ini disusun secara berurutan (*step-by-step*) berdasarkan alur kerja nyata. Ikuti panduan ini dari Langkah 1 hingga selesai agar sistem presensi sekolah Anda dapat berjalan dengan lancar.

---

## 1️⃣ LANGKAH 1: Login ke Aplikasi

Langkah pertama yang harus dilakukan adalah masuk ke dalam sistem menggunakan akun administrator atau tata usaha.

1. Buka browser (disarankan Google Chrome atau Microsoft Edge).
2. Ketikkan alamat aplikasi (contoh: `http://localhost:3000` atau alamat IP server).
3. Anda akan melihat halaman Login.
4. Masukkan **Username** dan **Password** yang telah diberikan (Bawaan: `superadmin` / `siklon123`).
5. Klik tombol **Masuk**.

> *[📸 SCREENSHOT: Tampilan Halaman Login]*

---

## 2️⃣ LANGKAH 2: Pengaturan Aturan & Jadwal (WAJIB)

Sebelum memasukkan data siswa, pastikan aturan jam sekolah sudah diatur dengan benar agar status kehadiran (Hadir, Terlambat, Alpa) tidak salah hitung.

1. Di menu sebelah kiri, klik **Pengaturan**.
2. Pilih tab **Sekolah** untuk mengisi Nama, Alamat, dan Nama Kepala Sekolah (ini akan muncul di kop surat/laporan).
3. Pilih tab **Jadwal & Aturan**. Di sini, atur jam operasional standar:
   - **Jam Masuk:** Batas waktu siswa dinyatakan hadir tepat waktu (misal: `07:00`).
   - **Toleransi Keterlambatan:** Waktu tambahan sebelum siswa dianggap terlambat (misal: `10` menit).
   - **Batas Alpa:** Jika siswa tidak scan sampai jam ini, sistem otomatis menganggapnya Alpa (misal: `09:00`).
   - **Batas Akhir Masuk:** Jam terakhir sistem menerima absen masuk (misal: `08:00`). Lewat dari sini, scan masuk ditolak.
   - **Jam Pulang:** Scan yang dilakukan pada atau setelah jam ini akan dicatat sebagai absen pulang (misal: `13:00`).
   - **Batas Akhir Pulang:** Jam terakhir sistem menerima absen pulang (misal: `17:00`).
4. **Pengecualian Hari Khusus:** Jika hari Jumat pulang lebih awal, Anda bisa menambahkannya di bagian bawah halaman ini.
5. Jangan lupa klik tombol **Simpan** di pojok kanan bawah.

> *[📸 SCREENSHOT: Halaman Pengaturan -> Tab Jadwal]*

---

## 3️⃣ LANGKAH 3: Memasukkan Data Master (Kelas & Siswa)

Setelah aturan jam dibuat, Anda perlu memasukkan data kelas dan siswa.

### A. Membuat Kelas
1. Klik menu **Data Master** > **Kelas**.
2. Klik tombol **Tambah Kelas**.
3. Masukkan nama kelas (Contoh: `X MIPA 1`) dan simpan. Ulangi untuk semua kelas yang ada.

### B. Memasukkan Data Siswa
1. Klik menu **Data Master** > **Siswa**.
2. Anda bisa menambahkan siswa satu per satu dengan klik **Tambah Siswa**, atau menggunakan fitur **Import Excel** jika siswanya banyak.
3. Pastikan setiap siswa memiliki **NIS / NISN** yang benar, karena ini yang akan dijadikan kode barcode pada kartu pelajar.
4. Pastikan nomor WhatsApp Orang Tua diisi dengan benar (awali dengan `08` atau `62`) agar notifikasi bisa terkirim.

> *[📸 SCREENSHOT: Halaman Data Siswa]*

---

## 4️⃣ LANGKAH 4: Pelaksanaan Presensi (Mulai Scan)

Jika data sudah siap, aplikasi siap digunakan untuk absensi harian oleh siswa.

### A. Menjalankan Agen Scanner (Di PC Gerbang)
1. Buka aplikasi **AgenScannerRaw.exe** (layar hitam) di komputer yang tersambung dengan alat Scanner Barcode.
2. Pastikan muncul tulisan *"Siap menerima scan dari berbagai port"*.
3. Biarkan layar hitam ini tetap terbuka (boleh di-minimize).

> *[📸 SCREENSHOT: Jendela Hitam AgenScannerRaw]*

### B. Membuka Layar Pantauan (Di Layar Monitor / TV)
1. Buka browser dan login ke aplikasi PresenSee.
2. Klik menu **Scan Presensi** di panel sebelah kiri.
3. Tekan **F11** di keyboard untuk membuat layarnya menjadi penuh (*Fullscreen*).
4. Sekarang, siswa tinggal menempelkan kartunya ke alat scanner.
5. Layar akan langsung menampilkan Foto, Nama, Kelas, dan Status (Sukses Hijau, Terlambat Kuning) beserta suara *Beep*.

> *[📸 SCREENSHOT: Layar Penuh (Fullscreen) Saat Siswa Berhasil Scan]*

---

## 5️⃣ LANGKAH 5: Memantau Notifikasi WhatsApp

Saat siswa melakukan scan, sistem akan otomatis mengirimkan pesan WhatsApp ke orang tua mereka secara bergiliran (antre).

1. Klik menu **WhatsApp** di panel kiri.
2. Pastikan status koneksi di bagian atas berwarna **Hijau (Terhubung)**.
3. Di halaman ini, Anda bisa melihat daftar pesan yang sedang antre, berhasil terkirim, atau gagal.
4. Anda tidak perlu melakukan apa-apa di sini selain memantau. Sistem akan bekerja sendiri di latar belakang.

> *[📸 SCREENSHOT: Halaman Status Pengiriman WhatsApp]*

---

## 6️⃣ LANGKAH 6: Melihat & Mencetak Laporan

Di penghujung hari atau akhir bulan, Anda bisa mencetak rekap kehadiran siswa.

### A. Memantau Kehadiran Hari Ini
1. Klik menu **Dashboard**.
2. Anda bisa melihat grafik jumlah siswa yang Hadir, Terlambat, Izin, Sakit, dan Alpa pada hari tersebut secara *real-time*.

> *[📸 SCREENSHOT: Halaman Dashboard Hari Ini]*

### B. Mencetak Laporan (Rekap Bulanan)
1. Klik menu **Laporan**.
2. Pilih filter yang diinginkan:
   - Pilih **Kelas** (Misal: Semua Kelas atau spesifik X MIPA 1).
   - Pilih **Rentang Tanggal** (Misal: 1 Oktober - 31 Oktober).
3. Klik tombol **Tampilkan**.
4. Setelah tabel rekapitulasi muncul, Anda bisa mengklik tombol **Cetak (Print)** untuk mencetaknya ke kertas, atau **Export Excel** untuk menyimpannya dalam bentuk file `.xlsx`.

> *[📸 SCREENSHOT: Halaman Laporan Beserta Tombol Print]*

---
*Manual Book ini dapat dicetak dan dibagikan kepada petugas piket / tata usaha sekolah sebagai referensi penggunaan sehari-hari.*
