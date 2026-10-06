-- =====================================================================
-- SIKLON — Sistem Presensi Siswa
-- Skema Database PostgreSQL 16  (versi ringkas — 8 tabel)
-- =====================================================================
-- Jalankan:  psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f schema.sql
--
-- Fokus sistem: absen via scan QR (isi QR = NIS) -> kirim WhatsApp ke wali
--               -> laporan per siswa & per kelas (harian + bulanan).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- pencarian nama siswa

SET timezone = 'Asia/Jakarta';

-- =====================================================================
-- ENUM
-- =====================================================================
CREATE TYPE user_role         AS ENUM ('SUPER_ADMIN','ADMIN');
CREATE TYPE attendance_status AS ENUM ('HADIR','TERLAMBAT','IZIN','SAKIT','ALPA');
-- CANCELLED dipakai saat wali murid meminta berhenti: itu bukan kegagalan
-- pengiriman, dan tidak boleh ikut terhitung di laporan nomor bermasalah.
CREATE TYPE message_status    AS ENUM ('QUEUED','SENT','FAILED','CANCELLED');

-- =====================================================================
-- 1. USERS — login & hak akses
-- =====================================================================
-- Hanya dua peran, jadi cukup satu kolom enum (tanpa tabel roles/permissions).
--   SUPER_ADMIN : semua fitur + kelola akun admin
--   ADMIN       : semua fitur operasional, tanpa halaman Pengguna
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash  TEXT         NOT NULL,            -- Argon2id
  full_name      VARCHAR(120) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'ADMIN',
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Akun baru dan akun yang passwordnya di-reset admin wajib mengganti
  -- password dulu sebelum bisa memakai halaman lain.
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  -- Dinaikkan saat ganti password / "keluar dari semua perangkat".
  -- JWT membawa nilai ini; token dengan versi lama otomatis ditolak.
  -- Cara ini menggantikan tabel refresh_tokens.
  token_version  INTEGER      NOT NULL DEFAULT 1,
  last_login_at  TIMESTAMPTZ,
  last_login_ip  INET,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. TAHUN AJARAN
-- =====================================================================
CREATE TABLE academic_years (
  id          SMALLSERIAL PRIMARY KEY,
  name        VARCHAR(20) NOT NULL UNIQUE,        -- '2026/2027'
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT FALSE,
  CHECK (end_date > start_date)
);
-- Hanya boleh ada satu tahun ajaran aktif
CREATE UNIQUE INDEX uq_academic_year_active ON academic_years(is_active) WHERE is_active;

-- =====================================================================
-- 3. KELAS
-- =====================================================================
-- Wali kelas cukup disimpan sebagai nama (tidak perlu tabel guru tersendiri,
-- karena guru tidak punya akun login di sistem ini).
CREATE TABLE classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  SMALLINT     NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  name              VARCHAR(30)  NOT NULL,          -- 'VII-A'
  grade_level       SMALLINT,                       -- 7, 8, 9
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, name)
);

-- =====================================================================
-- 4. SISWA
-- =====================================================================
-- nis = isi QR code pada kartu siswa.
-- class_id langsung menunjuk kelas saat ini; saat kenaikan kelas nilainya
-- diperbarui. Riwayat presensi tetap benar karena tabel attendance menyimpan
-- class_id-nya sendiri pada saat absensi terjadi.
CREATE TABLE students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis          VARCHAR(20)  NOT NULL UNIQUE,       -- dicetak sebagai QR code
  full_name    VARCHAR(120) NOT NULL,
  class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,

  -- Wali murid disimpan langsung di sini, tanpa tabel terpisah.
  -- Kakak-adik menyimpan nomor yang sama di dua baris; nomor ganda BUKAN tanda
  -- data dobel. Konsekuensinya: opt-out "BERHENTI" harus mematikan notify untuk
  -- SEMUA siswa dengan nomor itu, bukan satu baris saja.
  guardian_phone VARCHAR(20),               -- E.164 tanpa '+': 6281234567890
  notify         BOOLEAN NOT NULL DEFAULT TRUE,

  photo_path   TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT students_guardian_phone_check
    CHECK (guardian_phone IS NULL OR guardian_phone ~ '^[1-9][0-9]{7,14}$')
);
CREATE INDEX idx_students_class ON students(class_id) WHERE is_active;
CREATE INDEX idx_students_name  ON students USING gin (full_name gin_trgm_ops);
-- Dipakai opt-out: mencari semua siswa dengan nomor wali yang sama.
CREATE INDEX idx_students_guardian_phone ON students(guardian_phone);

-- =====================================================================
-- 5. PRESENSI  — satu baris per siswa per tanggal
-- =====================================================================
-- Inti sistem. Sistem ini HANYA mencatat absen masuk, tidak ada absen pulang.
-- Scan kedua dan seterusnya pada hari yang sama diabaikan (lihat UPSERT
-- di DATABASE.md) sehingga tetap satu baris per siswa per hari.
CREATE TABLE attendance (
  id               BIGSERIAL PRIMARY KEY,
  student_id       UUID              NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES classes(id) ON DELETE SET NULL,  -- disalin saat absen
  attendance_date  DATE              NOT NULL,
  status           attendance_status NOT NULL,
  check_in_at      TIMESTAMPTZ,      -- jam scan masuk
  check_out_at     TIMESTAMPTZ,      -- jam scan pulang; NULL bila belum pulang
  late_minutes     SMALLINT          NOT NULL DEFAULT 0,
  device_code      VARCHAR(20),      -- titik scan: GATE-A / GATE-B / CAM-DEV / MANUAL
  note             TEXT,             -- alasan izin/sakit, atau catatan koreksi
  attachment_path  TEXT,             -- nama berkas lampiran (mis. surat sakit) di storage/presensi/
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,  -- diisi bila diubah manual
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX idx_att_date_class   ON attendance(attendance_date, class_id);
CREATE INDEX idx_att_student_date ON attendance(student_id, attendance_date DESC);
-- Laporan harian menyaring siswa yang belum pulang; parsial supaya indeksnya
-- tetap kecil (hanya baris yang belum ada jam pulangnya).
CREATE INDEX idx_att_belum_pulang ON attendance(attendance_date) WHERE check_out_at IS NULL;

-- =====================================================================
-- 6. ANTREAN & LOG WHATSAPP
-- =====================================================================
CREATE TABLE wa_messages (
  id          BIGSERIAL PRIMARY KEY,
  student_id  UUID REFERENCES students(id) ON DELETE SET NULL,
  phone       VARCHAR(20)    NOT NULL,
  body        TEXT           NOT NULL,       -- isi final setelah variabel diganti
  event       VARCHAR(20)    NOT NULL,       -- MASUK / TERLAMBAT / PULANG / ALPA / REKAP
  status      message_status NOT NULL DEFAULT 'QUEUED',
  attempts    SMALLINT       NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);
-- Index parsial: worker hanya memindai pesan yang masih perlu dikirim
CREATE INDEX idx_wa_queue  ON wa_messages(created_at) WHERE status = 'QUEUED';
CREATE INDEX idx_wa_recent ON wa_messages(created_at DESC);

-- =====================================================================
-- 7. HARI LIBUR
-- =====================================================================
-- Dipakai job penanda ALPA agar hari libur tidak dihitung tidak hadir.
CREATE TABLE holidays (
  holiday_date  DATE         PRIMARY KEY,
  name          VARCHAR(120) NOT NULL
);

-- =====================================================================
-- 8. PENGATURAN
-- =====================================================================
-- Menggantikan tabel schedules, message_templates, dan scan_devices.
-- Semua nilai berbentuk JSONB sehingga menambah pengaturan baru tidak
-- memerlukan migrasi database.
CREATE TABLE settings (
  key         VARCHAR(64) PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kunci pengaturan yang dipakai aplikasi:
--
--   'presensi'    -> aturan jam masuk & penentuan status (lihat seed.sql)
--                    {
--                      "jam_masuk": "07:00",       <- scan setelah jam ini = TERLAMBAT
--                      "toleransi_menit": 10,      <- kelonggaran, 0 = tanpa kelonggaran
--                      "batas_alpa": "09:00",      <- belum scan sampai jam ini = ALPA
--                      "hari_sekolah": [1,2,3,4,5],
--                      "khusus": { "1": { "jam_masuk": "06:45" } }
--                    }
--   'scanners'    -> pemetaan sumber scan ke gerbang, diisi lewat halaman Scanner:
--                    [ { "id": "SN:A1B2C3D4",   <- SERIAL: nomor seri USB,
--                                                  atau "USB:<lokasi>", atau "PORT:COM3"
--                                                  KAMERA: "CAM:<deviceId>"
--                        "tipe": "SERIAL",      <- SERIAL (scanner) | KAMERA (webcam/HP)
--                        "kode": "GATE-A",
--                        "label": "Gerbang Utama",
--                        "aktif": true } ]
--   'sekolah'     -> nama, alamat, kepala sekolah (kop laporan & isi pesan WA)
--   'scan'        -> debounce_detik, tampilkan_foto, bunyi
--   'whatsapp'    -> provider, jeda kirim, jam tenang, kejadian yang dinotifikasi
--   'template_wa' -> isi pesan per kejadian

-- =====================================================================
-- TRIGGER updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','classes','students','attendance'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();', t);
  END LOOP;
END $$;

-- =====================================================================
-- VIEW LAPORAN
-- =====================================================================

-- Rekap harian per kelas -> dipakai dashboard & laporan harian
CREATE OR REPLACE VIEW v_rekap_harian_kelas AS
SELECT
  a.attendance_date,
  a.class_id,
  c.name AS class_name,
  COUNT(*)                                        AS total,
  COUNT(*) FILTER (WHERE a.status = 'HADIR')      AS hadir,
  COUNT(*) FILTER (WHERE a.status = 'TERLAMBAT')  AS terlambat,
  COUNT(*) FILTER (WHERE a.status = 'IZIN')       AS izin,
  COUNT(*) FILTER (WHERE a.status = 'SAKIT')      AS sakit,
  COUNT(*) FILTER (WHERE a.status = 'ALPA')       AS alpa,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('HADIR','TERLAMBAT'))
        / NULLIF(COUNT(*), 0), 1)                 AS persen_hadir
FROM attendance a
LEFT JOIN classes c ON c.id = a.class_id
GROUP BY a.attendance_date, a.class_id, c.name;

-- Rekap bulanan per siswa -> dipakai laporan bulanan & rekap WA ke wali
CREATE OR REPLACE VIEW v_rekap_bulanan_siswa AS
SELECT
  a.student_id,
  a.class_id,
  date_trunc('month', a.attendance_date)::date    AS bulan,
  COUNT(*) FILTER (WHERE a.status = 'HADIR')      AS hadir,
  COUNT(*) FILTER (WHERE a.status = 'TERLAMBAT')  AS terlambat,
  COUNT(*) FILTER (WHERE a.status = 'IZIN')       AS izin,
  COUNT(*) FILTER (WHERE a.status = 'SAKIT')      AS sakit,
  COUNT(*) FILTER (WHERE a.status = 'ALPA')       AS alpa,
  COALESCE(SUM(a.late_minutes), 0)                AS total_menit_terlambat,
  COUNT(*)                                        AS hari_efektif,
  ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('HADIR','TERLAMBAT'))
        / NULLIF(COUNT(*), 0), 1)                 AS persen_hadir
FROM attendance a
GROUP BY a.student_id, a.class_id, date_trunc('month', a.attendance_date);

-- =====================================================================
-- SELESAI — 8 tabel, 2 view
-- =====================================================================
