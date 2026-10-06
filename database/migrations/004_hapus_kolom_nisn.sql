-- 004 — Kolom NISN dihapus dari tabel students
--
-- Penyederhanaan atas keputusan pemilik proyek: sekolah hanya memakai NIS.
-- NIS sudah menjadi isi QR kartu dan satu-satunya identitas yang dipakai
-- saat scan, jadi NISN hanya menambah kolom yang tidak pernah dibaca.

ALTER TABLE students DROP COLUMN IF EXISTS nisn;
