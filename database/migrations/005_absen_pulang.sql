-- 005: Absen pulang (10 September 2026)
--
-- Membalik keputusan "absen masuk saja" atas permintaan pemilik proyek.
-- Sengaja BUKAN tabel baru dan BUKAN status baru: pulang adalah stempel waktu
-- kedua pada baris presensi yang sama. Satu siswa tetap satu baris per hari,
-- jadi kunci unik (student_id, attendance_date) dan seluruh laporan yang
-- menghitung per baris tidak perlu diubah sama sekali.
BEGIN;

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;

COMMENT ON COLUMN attendance.check_out_at IS 'Jam scan pulang; NULL bila siswa belum scan pulang';

-- Laporan harian menyaring siswa yang belum pulang; indeks parsial ini kecil
-- karena hanya memuat baris yang check_out_at-nya masih kosong.
CREATE INDEX IF NOT EXISTS idx_att_belum_pulang
  ON attendance (attendance_date)
  WHERE check_out_at IS NULL;

COMMIT;

-- ---------------------------------------------------------------------
-- Setelan ikut dibawa migrasi, bukan hanya schema-nya.
--
-- `ambil()` memvalidasi nilai setting dengan skema Zod dan MELEMPAR bila tidak
-- cocok. Pemasangan lama yang belum punya `jam_pulang` atau template `PULANG`
-- akan mematikan seluruh notifikasi WhatsApp begitu kode baru dijalankan.
-- Semua UPDATE di bawah aman diulang.
-- ---------------------------------------------------------------------
UPDATE settings
   SET value = value || '{"jam_pulang":"13:00"}'::jsonb
 WHERE key = 'presensi' AND NOT value ? 'jam_pulang';

UPDATE settings
   SET value = value || jsonb_build_object(
         'PULANG',
         'Assalamu''alaikum Bpk/Ibu.' || chr(10) || chr(10) ||
         'Ananda *{siswa}* ({kelas}) sudah *PULANG* dari sekolah pada {tanggal} pukul *{jam}*.' ||
         chr(10) || chr(10) || 'Terima kasih.' || chr(10) || '— {sekolah}')
 WHERE key = 'template_wa' AND NOT value ? 'PULANG';

-- Notifikasi pulang dinyalakan atas permintaan pemilik proyek. Buang 'PULANG'
-- dari kirim_saat kalau volumenya ternyata terlalu berat — lihat docs/PLAN.md.
UPDATE settings
   SET value = jsonb_set(value, '{kirim_saat}', (value->'kirim_saat') || '["PULANG"]'::jsonb)
 WHERE key = 'whatsapp' AND NOT (value->'kirim_saat') @> '["PULANG"]'::jsonb;
