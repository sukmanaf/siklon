-- Update template WA ke format Spintax (Anti-Spam Meta)
-- Dijalankan saat patch update PresenSee diaplikasikan ke client

UPDATE settings 
SET value = '{
  "MASUK": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {telah HADIR|sudah sampai|tercatat hadir} di sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga ananda belajar dengan semangat.|Hormat kami.}\\n— {sekolah}",
  "PULANG": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {sudah PULANG|telah selesai KBM dan pulang|tercatat scan pulang} dari sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga selamat sampai di rumah.|Hormat kami.}\\n— {sekolah}",
  "TERLAMBAT": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) hadir *TERLAMBAT {menit} menit* pada {tanggal} pukul *{jam}*.\\n\\n{Mohon perhatiannya. Terima kasih.|Mohon bantuannya untuk mengingatkan ananda.|Terima kasih.}\\n— {sekolah}",
  "ALPA": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nHingga pukul {jam} hari {tanggal}, ananda *{siswa}* ({kelas}) *BELUM TERCATAT HADIR* dan tidak ada keterangan izin.\\n\\n{Mohon konfirmasinya. Terima kasih.|Mohon hubungi pihak sekolah bila ananda berhalangan.|Terima kasih.}\\n— {sekolah}",
  "REKAP": "Bpk/Ibu, rekap kehadiran ananda *{siswa}* ({kelas}) bulan {bulan}:\\n\\nHadir: {hadir} hari\\nTerlambat: {terlambat} hari\\nIzin: {izin} hari\\nSakit: {sakit} hari\\nAlpa: {alpa} hari\\n\\n*Kehadiran: {persen}%*\\n\\n— {sekolah}"
}'::jsonb 
WHERE key = 'template_wa';

