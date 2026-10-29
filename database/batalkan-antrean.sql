-- Batalkan semua pesan antrean (QUEUED) agar tidak terkirim saat WA terhubung kembali
UPDATE wa_messages
SET status = 'CANCELLED',
    last_error = 'Dibatalkan oleh admin'
WHERE status = 'QUEUED';

