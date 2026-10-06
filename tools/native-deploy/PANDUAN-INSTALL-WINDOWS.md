# 📖 PANDUAN INSTALASI PRESENSEE — NATIVE (TANPA DOCKER)

Panduan ini untuk **Petugas / Teknisi Sekolah** memasang PresenSee versi native
(Node.js + PostgreSQL langsung di Windows, tanpa Docker) di PC gerbang sekolah.

Ada **dua skenario** — pilih sesuai kebutuhan sekolah Anda:

| Skenario | Kapan dipakai | Panduan |
|---|---|---|
| **A. All-in-One** | Cuma 1 PC — server (aplikasi + database) dan pembaca scanner USB jadi satu | Langkah 1–6 |
| **B. Client Saja** | PC tambahan yang HANYA membaca scanner USB, server-nya sudah jalan di PC lain | Langkah 7 |

Kebanyakan sekolah cukup **Skenario A**. Skenario B dipakai kalau sekolah punya
lebih dari satu gerbang dan tiap gerbang punya PC sendiri.

---

## SKENARIO A — ALL-IN-ONE (Server + Scanner di 1 PC)

### 🚀 LANGKAH 1: Persiapan

1. Ekstrak seluruh folder ini ke lokasi yang mudah diingat (disarankan:
   `C:\PresenSee` atau `D:\PresenSee`). Pastikan berkas berikut ada:
   - `install.bat`, `jalankan.bat`, `hentikan.bat`, `uninstall.bat`
   - `apps\`, `database\`, `installer\`, `shared\`
2. **Ini beda dari versi Docker** — tidak perlu pasang Docker Desktop sama
   sekali. Node.js, PostgreSQL, dan NSSM dipasang otomatis oleh `install.bat`
   dari installer yang sudah dibundel di folder `installer\`.

### 🟢 LANGKAH 2: Pasang (Sekali Saja)

1. Klik kanan **`install.bat`**, pilih **Run as administrator**.
2. Skrip berjalan beberapa menit — jangan tutup jendelanya. Yang terjadi
   otomatis: pasang Node.js, pasang PostgreSQL, buat database, pasang NSSM,
   pasang dependensi aplikasi (butuh internet di langkah ini), daftarkan
   layanan Windows untuk API dan Web.
3. **Akan ada pertanyaan Y/N** di tengah proses:
   - *"Masukkan data contoh?"* — jawab **Y** kalau mau coba-coba dulu (dapat
     beberapa kelas & siswa contoh, aman dihapus/diedit nanti). Jawab **N**
     kalau ini pemasangan sungguhan di sekolah — mulai dari kosong, kelas &
     siswa asli ditambahkan sendiri lewat aplikasi.
   - *"Pasang Scanner Agent di PC ini?"* — jawab **Y** kalau PC ini JUGA
     dipakai membaca scanner USB gerbang (biasanya iya, untuk All-in-One).
4. Kalau PostgreSQL memang baru dipasang di langkah ini, skrip membuatkan
   password acak sendiri (tidak perlu diketik) — **tidak perlu diingat**,
   sudah tersimpan otomatis untuk dipakai aplikasi.
5. Di akhir, browser akan diarahkan ke `http://localhost:3000`.
6. **Akun Login Bawaan**:
   - **Username**: `superadmin` (atau `admin` untuk peran Admin Tata Usaha)
   - **Password**: `siklon123`
   - Sistem meminta ganti password ini di percobaan masuk pertama — itu
     disengaja, bukan kesalahan.

### 📷 LANGKAH 3: Pemasangan USB Barcode / QR Scanner

Kalau tadi menjawab **Y** untuk Scanner Agent, `install.bat` sudah otomatis
memasangnya. Kalau belum atau mau ditambah scanner lagi:

1. Colokkan kabel USB scanner 2D ke PC.
2. Pindai QR setup **"USB Virtual COM Port"** atau **"RS232 Emulation"** dari
   buku manual bawaan scanner fisik (kalau tersedia — sebagian scanner
   defaultnya sudah mode keyboard dan tidak perlu diubah, lihat catatan di
   `apps\scanner-agent\README.md`).
3. Buka folder `apps\scanner-agent`, pastikan `config.json` ada (dibuat
   otomatis oleh `install.bat`).
4. Klik kanan `install-service.bat`, pilih **Run as administrator**.
5. Buka `http://localhost:3000`, masuk ke menu **Scanner**, klik
   **Kenali Scanner**, lalu scan salah satu QR siswa untuk memberi nama
   gerbang (contoh: `"Gerbang Utama"`).

### 🖥️ LANGKAH 4: Mode Layar Penuh (Kiosk) di Gerbang

1. Buka browser ke `http://localhost:3000/scan`.
2. Tekan **`F11`** untuk masuk mode Layar Penuh.

### ⚙️ LANGKAH 5: Otomatis Menyala Saat PC Dinyalakan

Layanan API dan Web (dan Scanner Agent kalau dipasang) **sudah otomatis
menyala sendiri** tiap PC dinyalakan — ini bawaan cara `install.bat`
mendaftarkannya sebagai layanan Windows (NSSM), tidak perlu langkah
tambahan seperti folder Startup.

Kalau ingin browser juga otomatis terbuka: taruh pintasan `jalankan.bat` di
folder Startup (`Win+R` → ketik `shell:startup` → Enter → taruh pintasan
di situ).

### 🔴 LANGKAH 6: Menghentikan / Mencopot

- **Hentikan sementara** (mis. sebelum matikan PC sore hari — sebenarnya
  tidak wajib, layanan aman dibiarkan menyala): klik 2x `hentikan.bat`.
- **Copot total** (hapus layanan Windows-nya, database TIDAK ikut terhapus):
  klik kanan `uninstall.bat` → Run as administrator.

---

## SKENARIO B — CLIENT SAJA (PC Gerbang Tambahan)

Dipakai kalau sekolah sudah punya PC server (Skenario A) yang jalan di PC
lain, dan sekarang mau tambah gerbang ke-2 (atau ke-3, dst.) dengan PC
terpisah yang HANYA membaca scanner USB — **tidak perlu install.bat sama
sekali** di PC ini.

### Di PC Server (yang sudah jalan Skenario A):

1. Buka Command Prompt, ketik `ipconfig`, catat IP lokalnya (contoh:
   `192.168.1.100`).
2. Pastikan Port `5000` diizinkan di Windows Firewall PC server.

### Di PC Client (PC gerbang tambahan):

1. **TIDAK PERLU** pasang PostgreSQL atau menjalankan `install.bat` di PC
   ini sama sekali.
2. Salin folder `apps\scanner-agent` saja (dari paket ini) ke PC client.
3. Pasang Node.js 22 ke atas di PC ini — boleh pakai `installer\node-*.msi`
   yang ada di paket ini, atau unduh sendiri dari nodejs.org.
4. Buka `apps\scanner-agent\config.json`, ganti `apiUrl` mengarah ke IP PC
   server:
   ```json
   {
     "apiUrl": "http://192.168.1.100:5000",
     "apiKey": "presensee-scanner-api-key-2026"
   }
   ```
5. Colokkan USB scanner, pindai QR setup mode serial dari manualnya (kalau
   ada).
6. Klik kanan `install-service.bat` di PC client ini → **Run as
   administrator**.
7. Buka browser di PC client ke `http://192.168.1.100:3000/scanner`, klik
   **Kenali Scanner**, scan QR siswa di PC ini, beri nama `"Gerbang 2"`.
8. Untuk layar presensi di PC client ini, buka
   `http://192.168.1.100:3000/scan`.

---

## ⚠️ Kalau Ada yang Gagal Saat `install.bat`

Skrip berhenti dengan pesan `[GAGAL]` di tiap langkah yang bisa gagal
(Node.js, PostgreSQL, NSSM, database) — pesannya menjelaskan apa yang
terjadi dan langkah manual sebagai cadangan. Kalau errornya tidak jelas,
kirimkan **tangkapan layar lengkap** dari jendela `install.bat` (dari atas,
bukan cuma baris terakhir) untuk didiagnosis.

---

> 💡 *Catatan Keamanan*: Paket ini **100% bebas dari kode sumber mentah
> (`.ts`, `.tsx`, `src/`)**. Seluruh kode yang berjalan adalah hasil
> kompilasi (`dist/`, `.next/standalone`) yang sama seperti yang dipakai
> versi Docker.

### (Baru) Mode Scanner C# Raw Input
Pada pembaruan terbaru ini, kami telah menyertakan **Agen Scanner berbasis C#**.
Agen ini berjalan di latar belakang (background) dan mendengarkan input langsung dari mesin (Raw Input API).
Keunggulannya:
- **Tidak perlu lagi meng-klik kotak pencarian**. 
- Bisa membaca **banyak scanner USB sekaligus** secara paralel.
- Aplikasi C# ini terkompilasi secara otomatis memanfaatkan `.NET Framework` bawaan OS Windows 10/11, sehingga Anda tidak perlu menginstall aplikasi tambahan apapun!
Agen ini akan otomatis diinstal dan dijalankan oleh script `install.bat`.
