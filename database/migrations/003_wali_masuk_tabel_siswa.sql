-- 003 — Nomor wali murid dipindah langsung ke tabel students, tabel guardians dibuang
--
-- Alasannya penyederhanaan: satu siswa punya satu wali penerima notifikasi, dan
-- tabel terpisah menambah satu relasi tanpa memberi manfaat yang sepadan.
--
-- Konsekuensi yang perlu diingat saat menulis kode:
--   1. Kakak-adik kini menyimpan nomor yang sama di dua baris. Nomor ganda BUKAN
--      lagi tanda data dobel, jadi jangan ditolak sebagai duplikat.
--   2. Opt-out ("BERHENTI") harus mematikan notify untuk SEMUA siswa dengan nomor
--      itu, bukan satu baris saja — kalau tidak, wali yang minta berhenti tetap
--      menerima pesan tentang anaknya yang lain.
--   3. Mengubah nomor wali harus dilakukan per siswa.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS guardian_name  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notify         BOOLEAN NOT NULL DEFAULT TRUE;

-- Pindahkan data yang sudah ada sebelum tabelnya dibuang.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'guardians')
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'students' AND column_name = 'guardian_id')
  THEN
    UPDATE students s
    SET guardian_name  = g.full_name,
        guardian_phone = g.phone_wa,
        notify         = g.notify
    FROM guardians g
    WHERE g.id = s.guardian_id;
  END IF;
END $$;

ALTER TABLE students DROP COLUMN IF EXISTS guardian_id;
DROP TABLE IF EXISTS guardians;

-- Format E.164 tanpa '+', sama seperti aturan di tabel guardians sebelumnya.
-- Nomor boleh NULL (siswa yang walinya belum didata), tapi kalau diisi harus benar.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_guardian_phone_check;
ALTER TABLE students
  ADD CONSTRAINT students_guardian_phone_check
  CHECK (guardian_phone IS NULL OR guardian_phone ~ '^[1-9][0-9]{7,14}$');

-- Dipakai opt-out: mencari semua siswa dengan nomor wali yang sama.
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON students(guardian_phone);

COMMENT ON COLUMN students.guardian_phone IS
  'Nomor WhatsApp wali, E.164 tanpa +. Kakak-adik boleh punya nomor sama.';
COMMENT ON COLUMN students.notify IS
  'FALSE bila wali meminta berhenti. Opt-out harus mematikan ini untuk SEMUA siswa dengan nomor yang sama.';
