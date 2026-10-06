# SIKLON — Struktur Database

PostgreSQL 16 • **8 tabel** • 2 view
DDL: [`database/schema.sql`](../database/schema.sql) • Data awal: [`database/seed.sql`](../database/seed.sql)

---

## 1. Diagram Relasi

```mermaid
erDiagram
    academic_years ||--o{ classes    : "punya"
    classes        ||--o{ students   : "berisi"
    students       ||--o{ attendance : "presensi"
    classes        ||--o{ attendance : "kelas saat absen"
    students       ||--o{ wa_messages: "memicu"
    users          ||--o{ attendance : "koreksi manual"

    users {
        uuid id PK
        varchar username UK
        text password_hash
        enum role "SUPER_ADMIN | ADMIN"
        int token_version
    }
    academic_years {
        smallint id PK
        varchar name UK "2026/2027"
        bool is_active
    }
    classes {
        uuid id PK
        smallint academic_year_id FK
        varchar name "VII-A"
        varchar homeroom_teacher
    }
    students {
        uuid id PK
        varchar nis UK "isi QR code"
        varchar full_name
        uuid class_id FK
        varchar guardian_phone
        bool notify
        bool is_active
    }
    attendance {
        bigint id PK
        uuid student_id FK
        uuid class_id FK
        date attendance_date
        enum status
        timestamptz check_in_at
        smallint late_minutes
    }
    wa_messages {
        bigint id PK
        uuid student_id FK
        varchar phone
        text body
        enum status
    }
    holidays {
        date holiday_date PK
        varchar name
    }
    settings {
        varchar key PK
        jsonb value
    }
```

---

## 2. Daftar Tabel

| # | Tabel | Baris per | Peran |
|---|---|---|---|
| 1 | `users` | Pengguna | Login. Kolom `role` cukup dua nilai, tanpa tabel roles/permissions |
| 2 | `academic_years` | Tahun ajaran | Satu yang aktif pada satu waktu |
| 3 | `classes` | Kelas / rombel | Wali kelas disimpan sebagai nama, bukan relasi |
| 4 | `students` | Siswa | `nis` = isi QR code. Nama & nomor wali langsung di sini |
| 5 | `attendance` | **Siswa × tanggal** | Inti sistem — sumber semua laporan. Absen masuk (`check_in_at`) dan pulang (`check_out_at`) pada satu baris |
| 6 | `wa_messages` | Pesan WA | Antrean + log pengiriman |
| 7 | `holidays` | Tanggal libur | Supaya hari libur tidak dihitung alpa |
| 8 | `settings` | Pengaturan | JSONB: aturan jam masuk, pemetaan scanner, template WA |

---

## 3. Empat Keputusan Penyederhanaan

### 3.1 NIS jadi isi QR code — tanpa tabel kartu

QR pada kartu siswa berisi NIS apa adanya, jadi tidak perlu tabel `student_cards`, tidak perlu generate kode, dan kartu bisa dicetak ulang kapan saja tanpa mengubah data.

Konsekuensinya: **NIS bisa ditebak**, sehingga secara teknis seseorang bisa mencetak QR siswa lain untuk titip absen. Dua penangkal murah yang sudah masuk rancangan:

- **Foto siswa tampil besar di layar operator** setiap kali scan — petugas gerbang langsung melihat kalau wajahnya tidak cocok.
- **Deteksi anomali** di laporan: dua scan siswa berbeda dalam < 2 detik dari gerbang yang sama ditandai untuk ditinjau.

Kalau nanti titip absen ternyata jadi masalah nyata, menambahkan kolom `qr_token` pada `students` cukup untuk menutupnya tanpa mengubah struktur tabel.

### 3.2 Satu tabel presensi, bukan dua

Versi awal memisahkan log scan mentah dan rekap harian. Untuk kebutuhan ini cukup **satu tabel `attendance`** dengan kunci unik `(student_id, attendance_date)`:

- Sistem mencatat **absen masuk dan absen pulang** pada baris yang sama: `check_in_at` dan
  `check_out_at`. Pulang sengaja BUKAN status dan BUKAN tabel baru, jadi kunci unik
  `(student_id, attendance_date)` tetap berlaku dan seluruh laporan yang menghitung per baris
  tidak perlu diubah. Scan kedua dihitung pulang hanya bila terjadi pada/sesudah
  `settings.presensi.jam_pulang`; sebelum itu dianggap kartu tertempel dua kali.
  Ditambahkan 10 September 2026 (migrasi `005_absen_pulang.sql`).
- Scan pertama hari itu → baris baru, isi `check_in_at` dan status.
- Scan berikutnya pada hari yang sama → diabaikan, baris tidak berubah.
- Scan ganda dalam 60 detik → sudah ditolak Scanner Agent sebelum sampai ke server.

Yang hilang: jejak scan yang ditolak (kartu tidak dikenal, hari libur). Itu tetap tercatat di **log aplikasi**, bukan di database — cukup untuk menelusuri masalah, tanpa menambah jutaan baris per tahun.

### 3.3 Kelas menempel di siswa, riwayat tetap aman

`students.class_id` menunjuk kelas saat ini. Saat kenaikan kelas, nilainya diperbarui — tidak perlu tabel `student_enrollments`.

Laporan tahun lalu tetap benar karena **`attendance` menyimpan `class_id` sendiri** pada saat absensi terjadi. Jadi presensi Andi bulan September tetap tercatat atas nama VII-A meskipun sekarang dia sudah di VIII-A.

### 3.4 Wali murid langsung di tabel siswa, tanpa tabel terpisah

Nomor wali disimpan sebagai kolom `students.guardian_phone` beserta saklar `notify`.
**Nama wali tidak disimpan** (dihapus 10 September 2026, migrasi `006_hapus_nama_wali.sql`):
pesan WhatsApp menyapa "Bpk/Ibu" lalu langsung menyebut nama anaknya, jadi nama wali tidak
pernah dibaca — menyimpannya hanya menambah kolom yang harus diisi saat impor dan bisa salah.

Tiga konsekuensi yang harus diingat saat menulis kode:

| Hal | Akibatnya |
|---|---|
| **Nomor ganda itu normal** | Kakak-adik menyimpan nomor yang sama di dua baris. Nomor ganda **bukan** tanda data dobel dan tidak boleh ditolak sebagai duplikat |
| **Opt-out harus menyapu semua anak** | Balasan `BERHENTI` mematikan `notify` untuk **semua** siswa dengan nomor itu. Kalau hanya satu baris, wali yang sudah minta berhenti tetap dikirimi pesan tentang anaknya yang lain |
| **Ganti nomor dilakukan per siswa** | Wali yang ganti nomor harus diperbarui di tiap anaknya |

Index `idx_students_guardian_phone` ada khusus untuk yang kedua: mencari semua anak dari
satu nomor harus cepat, karena dijalankan setiap kali ada pesan masuk.

Nomor selalu disimpan **ternormalkan** ke E.164 tanpa `+` (`6281234567890`). Tanpa itu,
`0812-3456-7890` dan `+62 812 3456 7890` akan dianggap dua nomor berbeda dan opt-out gagal
menemukan sebagian anaknya.

### 3.5 Aturan jam masuk ada di `settings`, bukan di tabel jadwal

Satu baris `settings` dengan key `presensi` menentukan kapan siswa dihitung terlambat:

```json
{
  "jam_masuk": "07:00",          // scan setelah jam ini dihitung TERLAMBAT
  "toleransi_menit": 10,         // kelonggaran; 0 berarti tanpa kelonggaran
  "batas_alpa": "09:00",         // belum scan sampai jam ini -> ALPA
  "hari_sekolah": [1, 2, 3, 4, 5],
  "khusus": { "1": { "jam_masuk": "06:45" } }   // Senin upacara, masuk lebih pagi
}
```

Batas terlambat = `jam_masuk + toleransi_menit`. Dengan nilai di atas batasnya **07:10**:

| Jam scan | Status | Keterangan |
|---|---|---|
| 06:55 | `HADIR` | sebelum jam masuk |
| 07:08 | `HADIR` | masih dalam toleransi |
| 07:11 | `TERLAMBAT` | lewat 1 menit dari batas |
| 07:22 | `TERLAMBAT` | `late_minutes = 12` |
| belum scan s/d 09:00 | `ALPA` | ditandai job otomatis, WA dikirim |
| 07:25, sudah scan tadi | — | diabaikan, baris tidak berubah |

Karena berbentuk JSONB, mengubah jam masuk cukup lewat halaman Pengaturan — tanpa migrasi database. `khusus` menampung pengecualian seperti hari Jumat yang pulang lebih awal.

### 3.6 Pemetaan scanner juga di `settings`, bukan tabel perangkat

Key `scanners` menyimpan daftar scanner beserta gerbangnya:

```json
[
  { "id": "SN:A1B2C3D4", "tipe": "SERIAL", "kode": "GATE-A",  "label": "Gerbang Utama", "aktif": true },
  { "id": "CAM:9c1f…",   "tipe": "KAMERA", "kode": "CAM-DEV", "label": "Webcam Laptop", "aktif": true }
]
```

Isinya diatur lewat halaman **Scanner** di aplikasi, bukan diketik manual di file config PC gerbang. `attendance.device_code` menyimpan nilai `kode` inilah saat presensi dicatat.

`tipe` membedakan sumber scan: `SERIAL` dibuka Scanner Agent lewat port serial, `KAMERA` dibaca langsung di browser lewat `deviceId` webcam atau kamera HP. Bagi tabel `attendance` keduanya tidak berbeda — hanya `device_code` yang tercatat.

`id` memakai nomor seri USB (`SN:`) bila scanner melaporkannya, karena **nomor COM di Windows bisa berubah sendiri** ketika colokan USB dipindah — kalau pemetaan dikunci ke `COM3`, presensi bisa tercatat dari gerbang yang salah tanpa ada yang sadar. Urutan cadangannya: lokasi port fisik (`USB:`), lalu nomor COM (`PORT:`) sebagai pilihan terakhir.

Status online tiap scanner **tidak disimpan di database** — itu data sesaat, cukup ditahan di memori server dan dikirim ke browser lewat WebSocket.

### 3.7 Izin & sakit tanpa tabel pengajuan

Admin membuka laporan harian, mengubah status siswa jadi `IZIN` atau `SAKIT`, dan mengisi `note`. Kolom `updated_by` mencatat siapa yang mengubah. Tidak ada alur pengajuan–persetujuan, karena yang memakai sistem ini hanya admin.

---

## 4. Constraint yang Menjaga Data

| Constraint | Melindungi dari |
|---|---|
| `UNIQUE (student_id, attendance_date)` | Dua baris presensi untuk siswa & hari yang sama |
| `UNIQUE (nis)` | Dua siswa dengan NIS sama (dan QR yang bertabrakan) |
| `UNIQUE (academic_year_id, name)` pada `classes` | Kelas kembar dalam satu tahun ajaran |
| `UNIQUE INDEX ... WHERE is_active` pada `academic_years` | Dua tahun ajaran aktif bersamaan |
| `CHECK (guardian_phone ~ '^[1-9][0-9]{7,14}$')` | Nomor WA salah format masuk antrean kirim |

Semua kolom waktu memakai `TIMESTAMPTZ`, server & container di-set `TZ=Asia/Jakarta`. `attendance_date` dan `holiday_date` memakai `DATE` agar laporan bulanan bebas masalah zona waktu.

---

## 5. Query Inti

### 5.1 UPSERT saat scan — jantung sistem

```sql
-- $1 student_id, $2 class_id, $3 tanggal, $4 status, $5 waktu scan,
-- $6 menit terlambat, $7 kode titik scan
INSERT INTO attendance (student_id, class_id, attendance_date, status,
                        check_in_at, late_minutes, device_code)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (student_id, attendance_date) DO NOTHING
RETURNING *;
```

Karena hanya ada absen masuk, aturannya jadi sesederhana ini: **scan pertama hari itu yang menang, sisanya diabaikan**. Tidak ada `DO UPDATE`, jadi tidak ada risiko status `HADIR` berubah jadi `TERLAMBAT` gara-gara siswa iseng scan dua kali, dan status `IZIN`/`SAKIT` yang sudah diisi admin otomatis aman.

`RETURNING` yang kosong berarti siswa sudah punya baris hari itu. API tinggal membaca barisnya untuk tahu penyebabnya:

| Baris yang sudah ada | Jawaban API ke layar operator | Kirim WA? |
|---|---|:--:|
| `HADIR` / `TERLAMBAT` | "Sudah absen pukul 06:58" | tidak |
| `IZIN` / `SAKIT` | "Ananda tercatat IZIN hari ini" | tidak |
| `ALPA` (scan susulan setelah job jam 09:00) | status diperbarui jadi `TERLAMBAT` lewat query terpisah | ya |

### 5.2 Laporan harian per kelas

```sql
SELECT s.nis, s.full_name,
       to_char(a.check_in_at, 'HH24:MI') AS masuk,
       COALESCE(a.status::text, 'BELUM') AS status,
       a.late_minutes, a.note
FROM students s
LEFT JOIN attendance a
       ON a.student_id = s.id AND a.attendance_date = $1
WHERE s.class_id = $2 AND s.is_active
ORDER BY s.full_name;
```

`LEFT JOIN` penting: siswa yang belum scan tetap muncul dengan status `BELUM`.

### 5.3 Laporan bulanan per kelas (matriks siswa × tanggal)

```sql
WITH hari AS (
  SELECT generate_series($1::date,
                         ($1::date + INTERVAL '1 month - 1 day')::date,
                         '1 day')::date AS tgl
)
SELECT s.full_name,
       jsonb_object_agg(
         to_char(h.tgl, 'DD'),
         CASE WHEN hol.holiday_date IS NOT NULL      THEN 'L'
              WHEN EXTRACT(DOW FROM h.tgl) IN (0, 6) THEN 'L'
              ELSE COALESCE(LEFT(a.status::text, 1), '-')
         END ORDER BY h.tgl
       ) AS kalender,
       COUNT(*) FILTER (WHERE a.status = 'HADIR')     AS h,
       COUNT(*) FILTER (WHERE a.status = 'TERLAMBAT') AS t,
       COUNT(*) FILTER (WHERE a.status = 'IZIN')      AS i,
       COUNT(*) FILTER (WHERE a.status = 'SAKIT')     AS sk,
       COUNT(*) FILTER (WHERE a.status = 'ALPA')      AS al
FROM hari h
CROSS JOIN students s
LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = h.tgl
LEFT JOIN holidays  hol ON hol.holiday_date = h.tgl
WHERE s.class_id = $2 AND s.is_active
GROUP BY s.id, s.full_name
ORDER BY s.full_name;
```

Kode status = huruf pertama enum: **H**adir, **T**erlambat, **I**zin, **S**akit, **A**lpa. `L` = libur, `-` = tidak ada data.

### 5.4 Rekap bulanan per siswa

Sudah tersedia lewat view, tinggal difilter:

```sql
SELECT * FROM v_rekap_bulanan_siswa
WHERE student_id = $1 AND bulan = date_trunc('month', $2::date);
```

### 5.5 Job penanda ALPA (dijalankan pukul 09:00)

```sql
INSERT INTO attendance (student_id, class_id, attendance_date, status)
SELECT s.id, s.class_id, CURRENT_DATE, 'ALPA'
FROM students s
WHERE s.is_active
  AND NOT EXISTS (SELECT 1 FROM attendance a
                  WHERE a.student_id = s.id AND a.attendance_date = CURRENT_DATE)
  AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = CURRENT_DATE)
  -- $1 = settings->'presensi'->'hari_sekolah', mis. '{1,2,3,4,5}'
  AND EXTRACT(DOW FROM CURRENT_DATE)::int = ANY ($1::int[])
ON CONFLICT (student_id, attendance_date) DO NOTHING
RETURNING student_id;
```

Baris yang dikembalikan langsung dipakai untuk mengantrekan pesan WA "belum tercatat hadir".

---

## 6. Perkiraan Ukuran Data

1.500 siswa × 250 hari efektif:

| Tabel | Baris/tahun | Perkiraan |
|---|---|---|
| `attendance` | ± 375.000 | ± 55 MB |
| `wa_messages` | ± 750.000 | ± 300 MB |
| **Total** | | **± 355 MB/tahun** |

Ringan untuk PostgreSQL. Satu-satunya yang perlu dirawat adalah `wa_messages` — hapus isi `body` untuk pesan berumur > 6 bulan (statusnya tetap disimpan untuk statistik):

```sql
UPDATE wa_messages SET body = ''
WHERE created_at < now() - INTERVAL '6 months' AND body <> '';
```

---

## 7. Cara Menjalankan

PostgreSQL dipasang langsung di mesin (bukan Docker):

```bash
# Database: absen  ·  host: localhost:5432  ·  user: postgres
createdb -h localhost -U postgres absen          # lewati bila sudah ada
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/schema.sql
psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f database/seed.sql
```

```
DATABASE_URL="postgresql://postgres:123123@localhost:5432/absen"
```

> `-v ON_ERROR_STOP=1` penting: tanpa itu psql melanjutkan setelah error dan Anda
> berakhir dengan skema yang setengah jadi tanpa sadar.

**Status: sudah dijalankan dan terverifikasi.** Skema dan seed berhasil dieksekusi di
PostgreSQL 16.14, seluruh constraint terbukti menolak data yang salah (dua tahun ajaran
aktif, nomor WA salah format, NIS ganda, nama kelas ganda), UPSERT scan ganda terbukti
diabaikan, trigger `updated_at` berfungsi, dan kedua view laporan mengembalikan angka
yang benar.

ORM aplikasi memakai **Prisma**; `schema.prisma` diturunkan dari DDL ini dengan `prisma db pull`, lalu perubahan berikutnya dikelola lewat `prisma migrate`.
