-- 001 — Tambah kolom yang dibutuhkan fitur "wajib ganti password saat login pertama"
-- dan pencatatan IP login terakhir (ditampilkan di halaman Pengguna).
--
-- Ditemukan saat mengerjakan BE-009: seeder gagal karena kolomnya belum ada,
-- padahal PLAN.md dan tugas FE-009 sudah menjanjikan fiturnya.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_ip INET;

COMMENT ON COLUMN users.must_change_password IS
  'Akun baru & yang di-reset admin wajib ganti password sebelum bisa memakai halaman lain';
