# PresenSee Scanner Agent

Berjalan di **PC gerbang sekolah**. Membaca scanner barcode lewat port serial dan
mengirim hasilnya ke server PresenSee.

## Yang perlu disiapkan lebih dulu

1. **Scanner harus dalam mode USB Virtual COM Port**, bukan mode keyboard.
   Ubah dengan memindai barcode setup dari buku manual scanner. Kalau masih mode
   keyboard, ia hanya "mengetik" ke jendela yang sedang aktif dan agent ini tidak
   bisa membacanya sama sekali.
2. **Node.js 22 atau lebih baru** (antrean offline memakai `node:sqlite` bawaan Node).
3. **Kunci API** dari halaman Scanner pada aplikasi.

## Pemasangan

```bash
# 1. Salin folder ini ke PC gerbang, lalu:
npm install --omit=dev
npm run build

# 2. Buat config.json
cp config.example.json config.json
#    isi apiUrl dan apiKey

# 3. Periksa scanner terbaca
npm run ports
```

`npm run ports` adalah langkah diagnosa terpenting. Kalau hasilnya kosong,
scanner masih dalam mode keyboard — perbaiki itu dulu sebelum lanjut.

### Windows

```
install-service.bat        (klik kanan > Run as administrator)
```

Membutuhkan [nssm](https://nssm.cc/download). Layanan hidup otomatis setiap PC
dinyalakan dan dijalankan ulang sendiri bila mati.

### Linux

```bash
sudo cp -r . /opt/presensee-agent
sudo useradd -r -s /bin/false presensee
sudo usermod -aG dialout presensee        # WAJIB: tanpa ini port serial tidak bisa dibuka
sudo cp presensee-scanner-agent.service /etc/systemd/system/
sudo systemctl enable --now presensee-scanner-agent
```

## Isi config.json

```jsonc
{
  "apiUrl": "https://presensi.sekolahku.sch.id",
  "apiKey": "dari halaman Scanner",

  // opsional
  "antreanPath": "./antrean.sqlite",
  "portTambahan": [],        // path port yang tidak terdeteksi otomatis
  "laporDetik": 60,
  "kirimUlangDetik": 15,
  "logLevel": "info"         // debug | info | warn | error
}
```

**Daftar scanner tidak ada di sini.** Nomor COM di Windows bisa berubah sendiri
saat colokan USB dipindah, dan tidak ada yang tahu scanner fisik mana yang jadi
COM3 tanpa mencoba. Karena itu penamaan scanner dilakukan dari halaman **Scanner**
di aplikasi: tekan **Kenali Scanner**, tempelkan barcode di scanner yang ingin
dinamai, lalu beri kode gerbangnya. Agent menerapkannya **tanpa perlu restart**.

## Kalau internet mati

Scan tetap tercatat. Agent menyimpannya di `antrean.sqlite` (tahan mati listrik)
dan mengirimkannya begitu server bisa dihubungi. **Jam scan aslinya yang
tersimpan**, bukan jam pengiriman — jadi siswa yang datang 06:50 tetap tercatat
06:50 meski baru terkirim pukul 09:00.

## Membaca log

| | |
|---|---|
| Windows | `type log\agent.log` |
| Linux | `journalctl -u presensee-scanner-agent -f` |

Yang perlu diperhatikan di log:

- `OFFLINE — scan ditampung di antrean lokal` — server tidak terjangkau. Wajar
  sesaat; kalau berjam-jam, periksa jaringan.
- `Belum ada scanner yang dipetakan` — agent jalan tapi belum diberi nama di aplikasi.
- `X-Api-Key ditolak server` — `apiKey` di config.json salah.
- `gagal membuka /dev/ttyACM0` di Linux — pengguna belum masuk grup `dialout`.

## Masalah yang sering terjadi

**`npm run ports` kosong.** Scanner masih mode keyboard. Ubah lewat barcode setup
di buku manualnya.

**Di Linux semua port gagal dibuka.** Pengguna belum di grup `dialout`:
`sudo usermod -aG dialout $USER`, lalu logout-login.

**Scanner tidak punya nomor seri.** Agent tetap jalan, tapi pemetaannya ikut
lokasi colokan USB — **jangan pindahkan colokannya**, karena pemetaannya akan
tertukar. Halaman Scanner menandai kondisi ini dengan peringatan.
