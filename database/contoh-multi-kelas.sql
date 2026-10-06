-- =============================================================================
-- Data contoh: dua kelas tambahan (VII-B dan VIII-A) beserta presensinya.
--
-- Dibuat karena seluruh data contoh sebelumnya hanya berisi satu kelas (VII-A),
-- sehingga laporan yang dikelompokkan per kelas mustahil diperiksa — dengan
-- satu kelas, "dikelompokkan per kelas" terlihat sama persis dengan "tidak
-- dikelompokkan".
--
-- Aman dijalankan berulang: siswa dikunci NIS yang unik, presensi dikunci
-- (student_id, attendance_date).
--
--   psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 \
--        -f database/contoh-multi-kelas.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Siswa
--
-- notify sengaja DIMATIKAN untuk seluruh siswa contoh. Nomornya sama semua
-- (permintaan pemilik proyek, supaya uji WhatsApp terarah ke satu nomor), dan
-- puluhan pesan beruntun ke satu nomor adalah pola tercepat membuat nomor
-- Baileys diblokir. Nyalakan sendiri kalau memang sedang menguji notifikasi.
-- -----------------------------------------------------------------------------
INSERT INTO students (nis, full_name, class_id, guardian_phone, notify)
SELECT d.nis, d.nama, c.id, '6281217293134', false
  FROM (VALUES
    -- VII-B
    ('2026111', 'Adit Nugroho',        'VII-B'),
    ('2026112', 'Anisa Rahmawati',     'VII-B'),
    ('2026113', 'Bayu Setiadi',        'VII-B'),
    ('2026114', 'Cindy Oktaviani',     'VII-B'),
    ('2026115', 'Daffa Ramadhan',      'VII-B'),
    ('2026116', 'Dina Maharani',       'VII-B'),
    ('2026117', 'Erik Saputra',        'VII-B'),
    ('2026118', 'Fadhila Zahra',       'VII-B'),
    ('2026119', 'Galih Prasetya',      'VII-B'),
    ('2026120', 'Hesti Wulandari',     'VII-B'),
    ('2026121', 'Irfan Maulana',       'VII-B'),
    ('2026122', 'Jihan Safitri',       'VII-B'),
    ('2026123', 'Krisna Aditama',      'VII-B'),
    ('2026124', 'Laras Ayu Ningrum',   'VII-B'),
    ('2026125', 'Miftah Hidayat',      'VII-B'),
    ('2026126', 'Nadia Puspita',       'VII-B'),
    ('2026127', 'Oki Firmansyah',      'VII-B'),
    ('2026128', 'Prita Anggraeni',     'VII-B'),
    ('2026129', 'Rangga Wijaya',       'VII-B'),
    ('2026130', 'Salsabila Kirana',    'VII-B'),
    ('2026131', 'Teguh Santoso',       'VII-B'),
    ('2026132', 'Vina Andriani',       'VII-B'),
    ('2026133', 'Wahyu Kurniawan',     'VII-B'),
    ('2026134', 'Yasmin Alifia',       'VII-B'),
    ('2026135', 'Zaki Abdurrahman',    'VII-B'),
    ('2026136', 'Alika Permata',       'VII-B'),
    ('2026137', 'Bagas Pratomo',       'VII-B'),
    ('2026138', 'Cahya Melati',        'VII-B'),
    ('2026139', 'Dimas Arifin',        'VII-B'),
    ('2026140', 'Elsa Nuraini',        'VII-B'),
    -- VIII-A
    ('2025041', 'Agung Baskoro',       'VIII-A'),
    ('2025042', 'Ayu Lestari Dewi',    'VIII-A'),
    ('2025043', 'Bima Sakti Nugraha',  'VIII-A'),
    ('2025044', 'Clara Widiastuti',    'VIII-A'),
    ('2025045', 'Dandi Pranata',       'VIII-A'),
    ('2025046', 'Devi Anggita',        'VIII-A'),
    ('2025047', 'Egi Kurnia',          'VIII-A'),
    ('2025048', 'Fitria Handayani',    'VIII-A'),
    ('2025049', 'Gilang Permana',      'VIII-A'),
    ('2025050', 'Hanum Salsabil',      'VIII-A'),
    ('2025051', 'Ilham Syahputra',     'VIII-A'),
    ('2025052', 'Jasmine Aulia',       'VIII-A'),
    ('2025053', 'Kevin Ardiansyah',    'VIII-A'),
    ('2025054', 'Lidya Kusuma',        'VIII-A'),
    ('2025055', 'Maulana Yusuf',       'VIII-A'),
    ('2025056', 'Nabila Sari',         'VIII-A'),
    ('2025057', 'Okta Ferdian',        'VIII-A'),
    ('2025058', 'Putri Ramadhani',     'VIII-A'),
    ('2025059', 'Rizky Hermawan',      'VIII-A'),
    ('2025060', 'Sinta Ayu Lestari',   'VIII-A'),
    ('2025061', 'Taufan Nugraha',      'VIII-A'),
    ('2025062', 'Ulfa Nadhira',        'VIII-A'),
    ('2025063', 'Vito Ardiyanto',      'VIII-A'),
    ('2025064', 'Wulan Puspitasari',   'VIII-A'),
    ('2025065', 'Yoga Pratama',        'VIII-A'),
    ('2025066', 'Zahwa Amelia',        'VIII-A'),
    ('2025067', 'Arif Setiawan',       'VIII-A'),
    ('2025068', 'Berliana Citra',      'VIII-A')
  ) AS d(nis, nama, kelas)
  JOIN classes c ON c.name = d.kelas
 WHERE c.academic_year_id = (SELECT id FROM academic_years WHERE is_active)
ON CONFLICT (nis) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Presensi
--
-- Tanggalnya dihitung otomatis dari generate_series(1 September, HARI INI),
-- disaring memakai hari_sekolah dan tabel holidays yang SUNGGUHAN — jadi
-- skrip ini aman dijalankan ulang kapan pun untuk mengisi hari-hari yang
-- masih kosong sampai tanggal berjalan, tidak perlu diedit manual lagi.
-- Berlaku untuk SEMUA kelas (bukan cuma VII-B/VIII-A) — ON CONFLICT DO
-- NOTHING di bawah memastikan hari yang SUDAH ada datanya (asli atau dummy)
-- tidak pernah tertimpa, cuma mengisi yang benar-benar kosong.
--
-- Sebarannya memakai hashtext(nis || tanggal), BUKAN random(). random() di
-- dalam LATERAL non-korelasi dievaluasi SEKALI oleh PostgreSQL, sehingga
-- seluruh siswa berakhir dengan status yang sama persis — pernah terjadi, dan
-- hasilnya data contoh yang isinya HADIR semua. hashtext juga membuat berkas
-- ini menghasilkan data yang sama tiap dijalankan.
-- -----------------------------------------------------------------------------
INSERT INTO attendance (student_id, class_id, attendance_date, status,
                        check_in_at, check_out_at, late_minutes)
SELECT s.id,
       s.class_id,
       d.tanggal,
       x.status::attendance_status,
       -- Izin, sakit, dan alpa tidak punya jam: mereka memang tidak scan.
       CASE WHEN x.status IN ('HADIR', 'TERLAMBAT')
            THEN (d.tanggal + x.jam_masuk) AT TIME ZONE 'Asia/Jakarta' END,
       CASE WHEN x.status IN ('HADIR', 'TERLAMBAT')
            THEN (d.tanggal + x.jam_pulang) AT TIME ZONE 'Asia/Jakarta' END,
       CASE WHEN x.status = 'TERLAMBAT'
            THEN EXTRACT(EPOCH FROM (x.jam_masuk - TIME '07:10'))::int / 60
            ELSE 0 END
  FROM students s
  JOIN classes c ON c.id = s.class_id
 CROSS JOIN (
   SELECT gs::date AS tanggal
     FROM generate_series(DATE '2026-09-01', CURRENT_DATE, INTERVAL '1 day') AS gs
    WHERE EXTRACT(ISODOW FROM gs) = ANY (
            SELECT (CASE WHEN (v.hari)::int = 0 THEN 7 ELSE (v.hari)::int END)
              FROM jsonb_array_elements_text(
                     (SELECT value -> 'hari_sekolah' FROM settings WHERE key = 'presensi')
                   ) AS v(hari)
          )
      AND gs::date NOT IN (SELECT holiday_date FROM holidays)
 ) AS d(tanggal)
 CROSS JOIN LATERAL (
   SELECT
     CASE
       WHEN undi < 78 THEN 'HADIR'
       WHEN undi < 90 THEN 'TERLAMBAT'
       WHEN undi < 94 THEN 'IZIN'
       WHEN undi < 98 THEN 'SAKIT'
       ELSE 'ALPA'
     END AS status,
     CASE
       WHEN undi < 78 THEN TIME '06:45' + (undi % 24) * INTERVAL '1 minute'
       ELSE TIME '07:11' + (undi % 25) * INTERVAL '1 minute'
     END AS jam_masuk,
     TIME '13:00' + (undi % 28) * INTERVAL '1 minute' AS jam_pulang
   FROM (SELECT abs(hashtext(s.nis || d.tanggal::text)) % 100 AS undi) u
 ) AS x
 WHERE s.is_active
   AND c.academic_year_id = (SELECT id FROM academic_years WHERE is_active)
ON CONFLICT (student_id, attendance_date) DO NOTHING;

COMMIT;

-- Ringkasan hasilnya.
SELECT c.name AS kelas,
       count(DISTINCT s.id)                                    AS siswa,
       count(a.id)                                             AS baris_presensi,
       count(a.id) FILTER (WHERE a.status = 'HADIR')           AS hadir,
       count(a.id) FILTER (WHERE a.status = 'TERLAMBAT')       AS terlambat,
       count(a.id) FILTER (WHERE a.status = 'IZIN')            AS izin,
       count(a.id) FILTER (WHERE a.status = 'SAKIT')           AS sakit,
       count(a.id) FILTER (WHERE a.status = 'ALPA')            AS alpa
  FROM classes c
  JOIN students s ON s.class_id = c.id AND s.is_active
  LEFT JOIN attendance a ON a.student_id = s.id
 GROUP BY c.name
 ORDER BY c.name;
