-- 008: Lampiran presensi manual (23 September 2026)
--
-- Supaya koreksi status IZIN/SAKIT bisa dilampiri bukti (mis. foto surat
-- keterangan sakit dari dokter/orang tua). Sengaja BUKAN tabel baru dan
-- BUKAN tabel izin — cuma satu kolom nullable di baris presensi yang sudah
-- ada, menyimpan nama berkas saja (bukan path lengkap), sama persis polanya
-- dengan students.photo_path.
BEGIN;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS attachment_path TEXT;

COMMENT ON COLUMN attendance.attachment_path IS
  'Nama berkas lampiran (mis. surat sakit) di storage/presensi/; NULL bila tidak ada';

COMMIT;
