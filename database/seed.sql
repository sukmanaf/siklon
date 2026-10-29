-- =====================================================================
-- SIKLON — Data Awal
-- Jalankan setelah schema.sql:
--   psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f seed.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PENGGUNA
-- ---------------------------------------------------------------------
-- password_hash di bawah adalah hash Argon2id ASLI untuk password "siklon123"
-- (parameter argon2id sama persis dengan apps/api/src/lib/password.ts:
-- memoryCost=19456, timeCost=2, parallelism=1 — dibuat & diverifikasi lewat
-- @node-rs/argon2 yang sama, bukan ditulis tangan). `must_change_password`
-- default TRUE dari schema.sql, jadi wajib ganti password saat login pertama.
--
-- INI BUKAN SEKADAR CATATAN GAYA PENULISAN: sampai 21 September 2026 baris
-- ini berisi placeholder literal "GANTI_DENGAN_HASH_ASLI", yang membuat
-- SETIAP deployment Docker client (yang hanya menjalankan schema.sql +
-- seed.sql ini lewat docker-entrypoint-initdb.d, TANPA seeder aplikasi)
-- terpasang dengan login yang mustahil berhasil untuk password apa pun —
-- Argon2id menolak memverifikasi hash yang bukan hash sungguhan. Kalau mau
-- ganti password default, generate ulang hash-nya, jangan tulis manual:
--   node -e "require('@node-rs/argon2').hash('password-baru',{memoryCost:19456,timeCost:2,parallelism:1}).then(console.log)"
-- (dijalankan dari dalam apps/api, supaya memakai versi paket yang sama).
INSERT INTO users (username, password_hash, full_name, role) VALUES
  ('superadmin', '$argon2id$v=19$m=19456,t=2,p=1$ugPzpG8yS4Z99O1AtRbfXw$IkuhbZ1DvZ6OxBHriyV/P1Iw2JezYoSSh8/2Mlg1lxA',
   'Super Administrator', 'SUPER_ADMIN'),
  ('admin',      '$argon2id$v=19$m=19456,t=2,p=1$ugPzpG8yS4Z99O1AtRbfXw$IkuhbZ1DvZ6OxBHriyV/P1Iw2JezYoSSh8/2Mlg1lxA',
   'Admin Tata Usaha',    'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. TAHUN AJARAN & KELAS
-- ---------------------------------------------------------------------
INSERT INTO academic_years (name, start_date, end_date, is_active)
VALUES ('2026/2027', '2026-07-13', '2027-06-19', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO classes (academic_year_id, name, grade_level)
SELECT ay.id, k.nama, k.tingkat
FROM academic_years ay,
  (VALUES
    ('VII-A',  7), ('VII-B',  7),
    ('VIII-A', 8), ('VIII-B', 8),
    ('IX-A',   9), ('IX-B',   9)
  ) AS k(nama, tingkat)
WHERE ay.is_active
ON CONFLICT (academic_year_id, name) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. CONTOH SISWA (nomor wali langsung di tabel students)
-- ---------------------------------------------------------------------
-- PERHATIAN: nomor di bawah adalah KARANGAN, tapi formatnya valid dan
-- prefiksnya nyata — besar kemungkinan nomor itu milik orang lain.
-- Karena itu notify = FALSE. Jangan pernah menyalakannya untuk data contoh:
-- pesan "Ananda ... telah HADIR" akan terkirim ke orang asing.
INSERT INTO students (nis, full_name, class_id, guardian_phone, notify)
SELECT s.nis, s.nama, c.id, s.nomor, FALSE
FROM (VALUES
    ('2026071', 'Andi Pratama',  'VII-A', '628123456789'),
    ('2026072', 'Bunga Lestari', 'VII-A', '628134567890'),
    ('2026073', 'Citra Dewi',    'VII-A', '628561234567')
  ) AS s(nis, nama, kelas, nomor)
JOIN classes c ON c.name = s.kelas
ON CONFLICT (nis) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. HARI LIBUR (contoh — sesuaikan tiap tahun)
-- ---------------------------------------------------------------------
INSERT INTO holidays (holiday_date, name) VALUES
  ('2026-08-17', 'Hari Kemerdekaan RI'),
  ('2026-12-25', 'Hari Raya Natal'),
  ('2027-01-01', 'Tahun Baru Masehi')
ON CONFLICT (holiday_date) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. PENGATURAN
-- ---------------------------------------------------------------------
INSERT INTO settings (key, value) VALUES

-- Identitas sekolah (dipakai kop laporan & isi pesan WA)
('sekolah', '{
  "nama": "SMP Negeri 1 Contoh",
  "alamat": "Jl. Pendidikan No. 1",
  "kepala_sekolah": "Drs. Contoh Nama, M.Pd."
}'),

-- ATURAN JAM & PENENTUAN STATUS
--
-- Sistem mencatat absen MASUK dan absen PULANG pada satu baris yang sama.
-- Pulang adalah stempel waktu kedua, BUKAN status baru — jadi satu siswa
-- tetap satu baris per hari.
--
--   scan <= jam_masuk + toleransi_menit   -> HADIR
--   scan >  jam_masuk + toleransi_menit   -> TERLAMBAT (selisih menit dicatat)
--   belum scan sampai batas_alpa          -> ALPA (job otomatis) + kirim WA
--   scan berikutnya >= jam_pulang         -> dicatat sebagai jam pulang
--   scan berikutnya <  jam_pulang         -> diabaikan (dianggap scan dobel)
--
-- Contoh dengan nilai di bawah: jam_masuk 07:00, toleransi 10 menit, pulang 13:00
--   06:55 -> HADIR    07:08 -> HADIR    07:11 -> TERLAMBAT 1 menit
--   07:22 -> TERLAMBAT 12 menit         belum scan jam 09:00 -> ALPA
--   09:30 -> diabaikan (belum jam pulang)
--   13:05 -> jam pulang tercatat        13:40 -> diabaikan (sudah pulang)
--
-- hari_sekolah : 1=Senin ... 5=Jumat (0=Minggu, 6=Sabtu). Di luar ini scan ditolak.
-- khusus       : override per hari, hanya kunci yang ditulis yang berubah.
--                Contoh di bawah: Senin upacara masuk lebih pagi, Jumat pulang lebih awal.
('presensi', '{
  "jam_masuk": "07:00",
  "toleransi_menit": 10,
  "batas_alpa": "09:00",
  "jam_pulang": "13:00",
  "hari_sekolah": [1, 2, 3, 4, 5],
  "khusus": {
    "1": { "jam_masuk": "06:45" },
    "5": { "jam_pulang": "11:30" }
  }
}'),

-- Pemetaan sumber scan. Sengaja dibiarkan kosong: diisi dari halaman Scanner.
--   tipe SERIAL -> scanner USB Virtual COM, dibuka Scanner Agent.
--                  "id" memakai nomor seri USB bila tersedia, karena nomor COM
--                  di Windows bisa berubah sendiri saat colokan USB dipindah.
--   tipe KAMERA -> webcam laptop atau kamera HP, dibaca langsung di browser.
--                  "id" memakai deviceId dari navigator.mediaDevices.
-- Untuk development cukup pakai KAMERA — tidak perlu perangkat keras apa pun.
('scanners', '[]'),

-- Perilaku scan
('scan', '{
  "debounce_detik": 60,
  "tampilkan_foto": true,
  "bunyi": true
}'),

-- WhatsApp
-- CATATAN VOLUME (perhitungan untuk 600 siswa, lihat PLAN.md bagian 4):
-- TUJUAN UTAMA SISTEM INI: memberi tahu orang tua bahwa anaknya sampai di
-- sekolah. Karena itu "MASUK" WAJIB aktif -- itu inti layanannya, bukan
-- pelengkap yang boleh dimatikan untuk menghemat pesan.
--
-- Volume untuk 600 siswa: MASUK + TERLAMBAT + ALPA = ± 600 pesan/hari.
-- Kapasitas kirim ± 11 pesan/menit, siswa menumpuk di 20 menit terakhir
-- sebelum bel, jadi pesan terakhir tiba ± 13 menit setelah siswa terakhir
-- scan. Masih wajar untuk kabar "ananda sudah sampai".
--
-- maks_per_hari dinaikkan bertahap SELAMA MASA PEMANASAN NOMOR BARU:
--   minggu 1: 200 (satu tingkat kelas dulu)
--   minggu 2: 400 (dua tingkat)
--   minggu 3+: 800 (semua siswa -- nilai tetapnya)
-- Setel ke 800 setelah nomor terbukti aman.
--
-- DEFAULT SENGAJA MATI (aktif=false, provider=dummy).
-- Instalasi baru TIDAK BOLEH langsung bisa mengirim pesan sungguhan: data
-- contoh berisi nomor karangan, dan pengirimnya adalah nomor siapa pun yang
-- men-scan QR. Nyalakan hanya setelah:
--   1. nomor wali murid yang sebenarnya sudah dimasukkan,
--   2. nomor pengirim khusus sekolah sudah disiapkan (BUKAN nomor pribadi),
--   3. WA_ALLOWLIST diisi saat masih uji coba.
--
-- PULANG diaktifkan atas permintaan pemilik proyek (10 September 2026).
--
-- Sadari biayanya: absen pulang menghasilkan ~600 pesan yang tercipta
-- serentak saat bel pulang, dan dengan jeda anti-blokir 3-8 detik antreannya
-- baru habis ±55 menit kemudian — wali yang anaknya pulang pukul 15.00 baru
-- dikabari sekitar 15.55. Volume WhatsApp harian juga jadi dua kali lipat,
-- yang menaikkan risiko nomor diblokir. Buang "PULANG" dari daftar ini kalau
-- ternyata terlalu berat; presensinya tetap tercatat penuh. Lihat docs/PLAN.md.
--
-- (Catatan ini SEMPAT tertulis di dalam literal JSON di bawah, bukan sebagai
-- komentar SQL sungguhan — bukan sekadar salah rapi. `--` di dalam string
-- yang di-cast ke `json` dibaca sebagai ISI JSON, bukan komentar, dan
-- merusak parsing-nya. Karena `INSERT ... VALUES` ini satu pernyataan
-- dengan banyak baris, satu baris gagal berarti SEMUA baris settings gagal
-- masuk sekaligus — ditemukan 21 September 2026 saat menguji paket deploy
-- client: tabel `settings` kosong total, bukan cuma kunci 'whatsapp'.)
('whatsapp', '{
  "aktif": false,
  "provider": "dummy",
  "jeda_min_ms": 3000,
  "jeda_max_ms": 8000,
  "maks_per_hari": 200,
  "maks_percobaan": 3,
  "jam_tenang": {"mulai": "18:30", "selesai": "06:00"},
  "kirim_saat": ["MASUK", "PULANG", "TERLAMBAT", "ALPA"],
  "rekap_mingguan": true
}'),

-- Template pesan (Mendukung Spintax {opsi1|opsi2} untuk anti-spam Meta). Variabel: {siswa} {kelas} {tanggal} {jam} {menit} {sekolah}
('template_wa', '{
  "MASUK": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {telah HADIR|sudah sampai|tercatat hadir} di sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga ananda belajar dengan semangat.|Hormat kami.}\\n— {sekolah}",
  "PULANG": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {sudah PULANG|telah selesai KBM dan pulang|tercatat scan pulang} dari sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga selamat sampai di rumah.|Hormat kami.}\\n— {sekolah}",
  "TERLAMBAT": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) hadir *TERLAMBAT {menit} menit* pada {tanggal} pukul *{jam}*.\\n\\n{Mohon perhatiannya. Terima kasih.|Mohon bantuannya untuk mengingatkan ananda.|Terima kasih.}\\n— {sekolah}",
  "ALPA": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nHingga pukul {jam} hari {tanggal}, ananda *{siswa}* ({kelas}) *BELUM TERCATAT HADIR* dan tidak ada keterangan izin.\\n\\n{Mohon konfirmasinya. Terima kasih.|Mohon hubungi pihak sekolah bila ananda berhalangan.|Terima kasih.}\\n— {sekolah}",
  "REKAP": "Bpk/Ibu, rekap kehadiran ananda *{siswa}* ({kelas}) bulan {bulan}:\\n\\nHadir: {hadir} hari\\nTerlambat: {terlambat} hari\\nIzin: {izin} hari\\nSakit: {sakit} hari\\nAlpa: {alpa} hari\\n\\n*Kehadiran: {persen}%*\\n\\n— {sekolah}\"
}')

ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- SELESAI
-- =====================================================================
