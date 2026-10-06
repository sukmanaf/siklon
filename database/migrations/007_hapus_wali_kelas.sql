-- 007: Hapus wali kelas (10 September 2026)
--
-- Atas permintaan pemilik proyek. Kolomnya tidak dipakai untuk menghitung apa
-- pun — hanya dicetak sebagai keterangan di kepala laporan — dan menjadi satu
-- lagi kolom yang harus diisi dan dijaga tetap mutakhir tiap ganti tahun ajaran.
--
-- Baris tanda tangan "Wali Kelas" di PDF SENGAJA dipertahankan: itu tempat
-- tanda tangan basah, bukan data yang disimpan.
BEGIN;

ALTER TABLE classes DROP COLUMN IF EXISTS homeroom_teacher;

COMMIT;
