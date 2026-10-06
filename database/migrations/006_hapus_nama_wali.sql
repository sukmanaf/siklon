-- 006: Hapus nama wali murid (10 September 2026)
--
-- Atas permintaan pemilik proyek: pesan WhatsApp menyapa "Bpk/Ibu" lalu langsung
-- menyebut nama anaknya, jadi nama wali tidak dipakai di mana pun lagi.
--
-- Yang TETAP ada: guardian_phone (tujuan notifikasi) dan notify (saklar opt-out).
-- Menyimpan nama yang tidak pernah dibaca cuma menambah kolom yang harus diisi
-- saat impor dan bisa salah.
BEGIN;

ALTER TABLE students DROP COLUMN IF EXISTS guardian_name;

COMMIT;

-- ---------------------------------------------------------------------
-- Variabel {wali} ikut dibuang dari template yang sudah tersimpan.
-- Tanpa ini, pesan yang terkirim berbunyi "Bpk/Ibu {wali}." apa adanya —
-- render() memang sengaja membiarkan variabel tak dikenal tetap terlihat.
-- Aman diulang.
-- ---------------------------------------------------------------------
UPDATE settings
   SET value = (
         SELECT jsonb_object_agg(
                  k,
                  to_jsonb(replace(replace(v #>> '{}', 'Bpk/Ibu {wali},', 'Bpk/Ibu,'),
                                   'Bpk/Ibu {wali}.', 'Bpk/Ibu.'))
                )
           FROM jsonb_each(value) AS t(k, v)
       )
 WHERE key = 'template_wa' AND value::text LIKE '%{wali}%';
