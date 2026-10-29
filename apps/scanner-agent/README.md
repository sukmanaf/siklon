# Agen Scanner Presensi All-in-One (C# Native)

Aplikasi desktop tunggal dan ringan untuk menghubungkan scanner barcode/kartu fisik (pos satpam / gerbang sekolah) ke server PresenSee (Siklon).

## Keunggulan Utama:
1. **Berjalan di Latar Belakang (Silent Mode)**:
   - Secara default, aplikasi berjalan senyap di background tanpa menampilkan jendela hitam CMD terus-menerus.
   - Layar PC satpam tetap bersih dan leluasa digunakan untuk aktivitas lain.
2. **Mode Debugging Live Kapan Saja**:
   - Jika ingin memantau scanner atau mencari penyebab error, cukup ubah `"showConsole": true` di `config.json`. Jendela terminal hitam akan muncul lengkap dengan log warna-warni secara langsung.
3. **Pencatatan Log Otomatis**:
   - Meskipun jendela terminal tertutup, riwayat scan dan pesan kendala tetap dicatat di berkas `scanner.log`.
4. **Satu Aplikasi untuk Semua Scanner**:
   - Mendukung **USB Keyboard Wedge / Barcode Scanner biasa** (Raw Input background listener).
   - Mendukung **Serial / USB Virtual COM Port** dengan auto-detect & hotplug.
5. **Zero Runtime / Zero Dependency**:
   - Tidak memerlukan instalasi Node.js, Python, ataupun runtime tambahan.
   - Menggunakan compiler .NET bawaan Windows (`%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe`).
   - Berjalan langsung di Windows 7 / 8 / 10 / 11.
6. **Anti-Dobel Agen**:
   - Dilengkapi proteksi System Mutex agar agen tidak bisa dibuka dua kali secara bersamaan.

---

## Konfigurasi (`config.json`)

```json
{
  "apiUrl": "http://localhost:5050/api/v1",
  "apiKey": "presensee-scanner-api-key-2026",
  "gate": "GERBANG_UTAMA",
  "mode": "AUTO",
  "showConsole": false,
  "port": "AUTO",
  "baudRate": 9600,
  "debounceSeconds": 3
}
```

### Keterangan Opsi:
* `showConsole`:
  * `false` *(Default)*: Agen berjalan di **latar belakang** (CMD hanya muncul 2 detik lalu otomatis tertutup).
  * `true`: Agen berjalan dengan **jendela konsol hitam terbuka terus** (untuk melihat log scan & debug kendala/error).
* `apiUrl`: URL backend server.
  * Localhost: `http://localhost:5050/api/v1`
  * Cloud Render: `https://api-presensi-anda.onrender.com/api/v1`
* `apiKey`: Kunci otentikasi scanner (disamakan dengan `SCANNER_API_KEY` di server).
* `gate`: Label kode gerbang (misal `"GERBANG_UTAMA"` atau dikosongkan `""`).
* `mode`: Mode pembacaan scanner:
  * `"AUTO"` *(Direkomendasikan)*: Membaca scanner USB Keyboard **dan** Serial COM sekaligus.
  * `"KEYBOARD"`: Hanya membaca scanner USB Keyboard / HID.
  * `"COM"`: Hanya membaca scanner port Serial / Virtual COM.
* `port`: Port serial (`"AUTO"` untuk deteksi otomatis seluruh port yang dicolokkan, atau sebutkan spesifik misal `"COM3"`).
* `baudRate`: Kecepatan komunikasi serial (default: `9600`).
* `debounceSeconds`: Jeda waktu (detik) untuk mengabaikan scan kartu yang sama berturut-turut.

---

## Cara Menjalankan

1. Salin folder `apps/scanner-agent` ini ke PC/laptop di pos satpam / gerbang.
2. Jika berkas `AgenScanner.exe` belum ada, klik ganda `RakitAplikasi.bat` sekali (proses kompilasi hanya butuh 2 detik).
3. Buka `config.json` dengan Notepad dan sesuaikan `apiUrl`.
4. Klik ganda **`AgenScanner.exe`** untuk menjalankan scanner.
   * Secara default (`"showConsole": false`), aplikasi langsung aktif di latar belakang tanpa memunculkan jendela hitam.
5. Jika ingin mematikan agen: Klik ganda **`HentikanAgen.bat`**.
6. Jika ada kendala pembacaan kartu: Buka `config.json`, ubah `"showConsole": true`, matikan agen lama via `HentikanAgen.bat`, lalu klik ganda `AgenScanner.exe` lagi untuk melihat log secara live.
