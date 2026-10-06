-- 002 — Tambah status CANCELLED pada message_status
--
-- Pesan yang dibatalkan karena wali murid meminta berhenti BUKAN kegagalan
-- pengiriman. Kalau disamakan dengan FAILED, laporan "berapa pesan gagal"
-- jadi menyesatkan dan nomor yang sehat ikut masuk daftar nomor bermasalah.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'message_status' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE message_status ADD VALUE 'CANCELLED';
  END IF;
END $$;
