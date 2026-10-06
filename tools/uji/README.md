# Uji ujung-ke-ujung SIKLON

Rangkaian uji yang menjalankan **browser sungguhan** melawan **server dan database yang
benar-benar hidup**. Tidak ada tiruan (*mock*) sama sekali.

Itu disengaja. Cacat yang paling sering lolos di proyek ini justru yang hanya muncul saat
browser, server, dan PostgreSQL bertemu: kamera yang berhenti memindai karena videonya
disembunyikan, siaran socket yang dobel, cache setelan di server yang tidak tahu database
sudah diubah, dan laporan yang baru kelihatan salah setelah dicetak. Uji satuan tidak
pernah menangkap satu pun dari itu.

## Menjalankan

```bash
# dua server harus hidup dulu
pnpm --filter @siklon/api dev
pnpm --filter @siklon/web dev

# lalu, dari akar repo
node tools/uji/jalankan.mjs            # semua suite
node tools/uji/jalankan.mjs kelas scan # hanya suite yang namanya cocok
node tools/uji/suite/07-laporan.mjs    # satu suite langsung
```

Sekali di awal: `cd tools/uji && pnpm install`.

Kalau memakai nvm, pastikan node ada di PATH:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
```

Pelari keluar dengan kode 1 kalau ada satu saja suite yang gagal, jadi bisa dipakai di CI.

## Yang diuji

| Suite | Isi |
|---|---|
| `01-autentikasi.mjs` | Login, sesi habis, halaman terproteksi, menu keluar, password tidak bocor ke URL |
| `02-siswa.mjs` | CRUD siswa, cari & saring, import Excel (berkas bersih dan rusak) |
| `03-kelas.mjs` | CRUD kelas, kenaikan kelas, salin kelas ke tahun ajaran lain |
| `04-konsol-scan.mjs` | Siaran socket, kartu hasil, riwayat, presensi manual, **absen pulang** |
| `05-kamera-scanner.mjs` | Pendekodean QR sungguhan lewat kamera palsu, izin ditolak, non-HTTPS, port dari agent |
| `06-whatsapp.mjs` | Koneksi, template & pratinjau, log pengiriman, perkiraan volume |
| `07-laporan.mjs` | Laporan harian per kelas & bulanan, matriks jam masuk/pulang, ekspor Excel & PDF siap cetak |
| `08-rilis.mjs` | Responsif di 390px & 820px, perilaku saat API mati, mode kiosk |

## Aturan yang dipegang semua suite

Ketiganya lahir dari kegagalan nyata, bukan dari teori.

1. **Uji menyiapkan datanya sendiri, dan mengembalikannya.** Pernah ada suite yang
   bersandar pada sisa data suite lain, lalu gagal begitu sisa itu dibersihkan — gagal
   karena sebab yang salah, dan lama baru disadari. `pulihkanNanti()` memastikan
   pengembalian tetap jalan meski suitenya melempar di tengah.

2. **Asersi tidak mematok angka data.** `barisHarian === 3` benar saat kelasnya berisi 3
   siswa dan salah begitu berisi 32. Hitung dari datanya.

3. **Yang diperiksa hasilnya, bukan perantaranya.** Pernah terjadi pendekode QR TIDAK
   pernah bekerja sementara ujinya tetap hijau, karena asersinya cuma memeriksa *pustaka
   mana yang terpilih*. Sekarang Chrome diberi berkas video berisi QR sungguhan
   (`--use-file-for-fake-video-capture`) dan yang diperiksa adalah baris presensi yang
   muncul di database.

## WhatsApp tidak pernah dikirim

Suite yang menyentuh presensi **mematikan `students.notify`** lebih dulu dan
menyalakannya kembali di akhir. Tanpa itu tiap scan uji mengirim pesan sungguhan ke nomor
wali — dan puluhan pesan beruntun ke satu nomor adalah pola yang paling cepat membuat
nomor Baileys diblokir.

Log pengiriman diuji dengan baris yang dimasukkan langsung lewat SQL, bukan dengan
memicu scan.

## Berkas dan hasil

| Berkas | Isi |
|---|---|
| `bersama.mjs` | Pustaka bersama: pencatat hasil, `sql()`, `masuk()`, `klik()`, `scanAgent()`, tangkap layar |
| `siapkan-berkas.mjs` | Membuat `qr.png` / `qr.y4m` (QR berisi NIS uji) dan berkas import Excel bersih & rusak |
| `jalankan.mjs` | Pelari — tiap suite jadi proses terpisah supaya tidak saling menjatuhkan |
| `berkas/` | Berkas bantu yang dihasilkan otomatis (tidak diikutkan git) |
| `hasil/` | Tangkap layar dan unduhan hasil uji (tidak diikutkan git) |

## Setelan lewat environment

| Variabel | Bawaan |
|---|---|
| `SIKLON_WEB` | `http://localhost:3000` |
| `SIKLON_API` | `http://localhost:4000/api/v1` |
| `SCANNER_API_KEY` | `dev-scanner-key-1234567890` |
| `CHROME_PATH` | `/usr/bin/google-chrome-stable` |

Kredensial database dan akun uji (`superadmin` / `siklon123`) mengikuti `database/seed.sql`.

## Hal yang mudah salah dibaca

- **Kamera hanya jalan di `localhost` atau HTTPS.** Mengarahkan `SIKLON_WEB` ke
  `http://192.168.x.x` membuat suite kamera gagal — itu batasan browser, bukan cacat aplikasi.
- **`BarcodeDetector` tidak ada di Chrome Linux**, jadi jalur yang teruji di sini adalah
  cadangannya (`qr-scanner`). Suite 05 memang menegaskan hal itu.
- **Cache setelan di server hanya dibuang lewat jalur aplikasi.** Mengembalikan setelan
  lewat SQL saja tidak cukup — harus disusul `PUT /settings/:kunci` supaya server ikut tahu.
  Suite 06 melakukannya.
- **Suite 08 menyempitkan layar ke 1280px** sebelum menguji tabel yang bisa digeser. Di layar
  lebar, matriks sebulan kebetulan masih muat dan pemeriksaannya jadi tidak menguji apa pun.
- **Tab latar membekukan `waitForFunction`.** Puppeteer memakai `requestAnimationFrame`, dan rAF
  berhenti di tab yang bukan paling depan — penantiannya tidak pernah dievaluasi walau halamannya
  sudah berpindah. Panggil `await p.bringToFront()` dulu.
- **Hari Sabtu & Minggu.** Suite yang memindai kartu memanggil `pastikanHariSekolah()`: tanpa itu
  seluruhnya gagal di akhir pekan, bukan karena produknya rusak melainkan karena produknya BENAR
  menolak presensi di hari bukan sekolah. Setelannya dikembalikan otomatis.
- **`Content-Disposition` tidak terbaca lewat `fetch` di dalam halaman** — bukan header yang
  di-expose CORS, jadi selalu kosong dari JS. Bacanya dari sisi Node.
