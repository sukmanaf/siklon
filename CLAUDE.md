# PresenSee — Catatan untuk Claude

## Apa ini

Sistem presensi siswa. **Tujuan intinya: memberi tahu orang tua lewat WhatsApp bahwa anaknya
sudah sampai di sekolah.** Semua keputusan desain tunduk pada tujuan itu — kalau ada usulan
yang mengorbankan notifikasi kedatangan demi hal lain (hemat pesan, misalnya), usulan itu salah.

Mencatat absen **masuk dan pulang**. Isi QR kartu siswa = **NIS**.
Keduanya ada di satu baris presensi — pulang itu stempel waktu kedua (`check_out_at`),
bukan status atau tabel baru, jadi satu siswa tetap satu baris per hari.
Skala: ± 600 siswa. Stack: Next.js + Express + PostgreSQL + Prisma.

## Aturan kerja yang WAJIB diikuti

**Setiap kali menyelesaikan tugas pengembangan, perbarui checklist-nya:**

- Backend & Scanner Agent → [`docs/TASKS-BACKEND.md`](docs/TASKS-BACKEND.md)
- Frontend → [`docs/TASKS-FRONTEND.md`](docs/TASKS-FRONTEND.md)

Yang diperbarui:

1. Centang `- [ ]` → `- [x]` **hanya bila tugasnya benar-benar jalan**, bukan saat kodenya baru ditulis.
   Tugas yang punya baris *Selesai bila:* harus memenuhi kriteria itu dulu.
2. Perbarui baris `**Progres: X / N selesai**` di bagian atas.
3. Perbarui kolom **Selesai** pada tabel ringkasan fase.
4. Perbarui `**Terakhir diperbarui:**` dengan tanggal.

Kalau sebuah tugas ternyata tidak diperlukan, jangan dihapus — beri tanda `~~coret~~` dan tulis alasannya.
Kalau muncul pekerjaan baru, tambahkan dengan nomor berikutnya, jangan menyisipkan di tengah.

## Database

PostgreSQL dipasang **langsung di mesin, bukan Docker**.

```
host=localhost  port=5432  db=absen  user=postgres  password=123123
DATABASE_URL="postgresql://postgres:123123@localhost:5432/absen"
```

Skema dan seed sudah dijalankan di sana dan terverifikasi. Memuat ulang dari nol:

```bash
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/schema.sql
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/seed.sql
```

Selalu pakai `-v ON_ERROR_STOP=1` — tanpa itu psql lanjut setelah error dan menghasilkan
skema setengah jadi tanpa terlihat.

## Dokumen acuan

| Berkas | Isi |
|---|---|
| `docs/PLAN.md` | Rencana teknis lengkap — arsitektur, sumber input scan, WhatsApp, API |
| `docs/DATABASE.md` | ERD, penjelasan 9 tabel, query inti |
| `database/schema.sql` | **Sumber kebenaran skema.** `schema.prisma` diturunkan dari sini |
| `mockup/index.html` | Acuan tampilan 13 layar |

## Keputusan yang sudah final — jangan diubah tanpa diminta

- **8 tabel saja.** Pemilik proyek sudah tiga kali meminta penyederhanaan. Jangan menambah tabel
  untuk hal yang bisa ditampung `settings` (JSONB) atau kolom biasa.
- **Tidak ada tabel wali murid, dan nama wali tidak disimpan sama sekali.** Yang ada hanya
  `students.guardian_phone` / `notify`. Nama wali dihapus 10 September 2026 atas permintaan
  pemilik proyek: pesan menyapa "Bpk/Ibu" lalu langsung menyebut nama anaknya, jadi namanya
  tidak pernah dibaca — menyimpannya cuma menambah kolom yang harus diisi saat impor dan bisa
  salah. Konsekuensinya: nomor ganda itu NORMAL (kakak-adik), dan opt-out "BERHENTI" harus
  mematikan `notify` untuk SEMUA siswa dengan nomor itu.
- **Dua peran saja:** `SUPER_ADMIN` dan `ADMIN`. Bedanya cuma satu — Super Admin bisa membuat akun admin.
- **Tanpa tabel kartu, tanpa tabel izin, tanpa tabel jadwal, tanpa tabel perangkat scan, tanpa tabel wali.**
- **Absen masuk DAN pulang.** Dibalik pada 10 September 2026 atas permintaan pemilik proyek;
  sebelumnya absen masuk saja. Pulang tersimpan di `attendance.check_out_at`, dibedakan dari
  scan dobel lewat `presensi.jam_pulang`. Notifikasi WhatsApp untuk pulang **mati secara
  bawaan** — lihat catatan volume di `docs/PLAN.md`.
- **Baileys** untuk WhatsApp, di balik antarmuka `WaProvider` supaya bisa ditukar.

## Hal teknis yang mudah terlewat

- `scanned_at::date` **tidak immutable** — ekspresi indeks harus ditulis
  `(scanned_at AT TIME ZONE 'Asia/Jakarta')::date`.
- Prisma tidak bisa memodelkan partial index, view, dan index GIN — semuanya lewat migrasi SQL manual.
- Laporan **selalu** raw SQL (`COUNT(*) FILTER`, `generate_series`), bukan lewat ORM.
- Kamera hanya jalan di `localhost` atau HTTPS. `http://192.168.x.x` gagal tanpa pesan jelas.
- `BarcodeDetector` **tidak ada di Chrome Linux** — jalur yang dipakai saat development adalah fallback.
- Pemetaan scanner dikunci ke nomor seri USB, bukan nomor COM (nomor COM bisa berubah sendiri).

## Bahasa

Semua dokumen, komentar kode, pesan UI, dan komunikasi dengan pemilik proyek memakai **Bahasa Indonesia**.
Nama tabel, kolom, dan kode program tetap Bahasa Inggris.
