# Panduan Patch Update PresenSee (Anti-Spam WhatsApp & Spintax)

Patch ini memperbarui engine WhatsApp PresenSee untuk mencegah pemblokiran / pembatasan akun (logout / spam detection) saat pengiriman massal ratusan siswa.

---

## 🚀 Fitur Baru & Peningkatan Pada Update Ini
1. **Engine WhatsApp Baileys Anti-Spam**:
   - Simulasi jeda mengetik manusiawi (*typing presence composing*) 1.5 - 3.5 detik per pesan.
   - Menggunakan identitas browser Windows Chrome resmi (`Windows, Chrome`).
   - Menghapus pengecekan kontak awal (*onWhatsApp probe*) yang memicu sistem deteksi robot Meta.
   - Penambahan Ref Hash unik otomatis & stempel waktu detik di akhir pesan (`_Ref: #XXXX • HH:MM:SS WIB_`), memastikan *checksum* tiap pesan selalu 100% berbeda di radar Meta.
2. **Format Spintax `{opsi1|opsi2|opsi3}`**:
   - Salam dan kalimat pengantar berganti secara otomatis dan acak per siswa.
3. **Web UI Log & Template WhatsApp**:
   - Tampilan editor `/whatsapp` kini dilengkapi panduan anti-spam dan pratinjau acak Spintax.
   - Tersedia tombol **"Batalkan antrean"** di tab Log Pengiriman untuk membatalkan seluruh pesan pending/antrean dalam 1 klik.
4. **Skrip `BATALKAN-ANTREAN.bat`**:
   - Skrip mandiri untuk membatalkan semua pesan antrean (pending) sebelum WhatsApp dinyalakan kembali, agar nomor WA tidak mengirim ratusan pesan basi/lama sekaligus.

---

## 🛠️ Langkah-Langkah Pemasangan Update di Client (Windows)

1. **Salin berkas `presensee_patch.zip`** ke PC client.
2. **Ekstrak seluruh isi `presensee_patch.zip`** langsung ke folder instalasi PresenSee (misalnya `D:\presensee_native`).
   - Jika muncul konfirmasi *“Replace the files in the destination”*, pilih **Replace all / Yes to all**.
3. **Jalankan Update Otomatis**:
   - Cari file **`update.bat`**.
   - **Klik kanan** pada file `update.bat`, lalu pilih **"Run as administrator"**.
4. Tunggu beberapa detik hingga muncul keterangan **`[SUKSES] PresenSee Berhasil Diperbarui!`**.
5. Buka kembali aplikasi di browser melalui **`http://localhost:3050`** atau jalankan `BUKA-APLIKASI.bat`.

---

## ❓ Catatan & Troubleshooting
- Jika WhatsApp sebelumnya terputus/logout, buka menu **WhatsApp** di aplikasi web (`http://localhost:3050/whatsapp`) lalu scan ulang QR code.
- Seluruh data siswa, kelas, guru, dan riwayat presensi **100% aman** dan tidak ada yang terhapus saat proses update.

