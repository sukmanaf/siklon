-- =====================================================================
-- SIKLON — Data Esensial (TANPA data contoh)
--
-- Dipakai paket deploy native saat admin menjawab TIDAK untuk data contoh
-- saat instalasi — cuma akun login dan setelan bawaan, TANPA kelas atau
-- siswa contoh sama sekali. Sekolah menambahkan kelas & siswa asli sendiri
-- dari halaman aplikasi setelah masuk.
--
-- Kalau JAWABANNYA YA, jangan pakai berkas ini — pakai seed.sql (berisi
-- semuanya, termasuk isi berkas ini juga) digabung dengan
-- contoh-multi-kelas.sql.
--
--   psql -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f seed-esensial.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PENGGUNA
-- ---------------------------------------------------------------------
-- password_hash di bawah adalah hash Argon2id ASLI untuk password "siklon123"
-- (parameter argon2id sama persis dengan apps/api/src/lib/password.ts:
-- memoryCost=19456, timeCost=2, parallelism=1 — dibuat & diverifikasi lewat
-- @node-rs/argon2 yang sama, bukan ditulis tangan). `must_change_password`
-- default TRUE dari schema.sql, jadi wajib ganti password saat login pertama.
INSERT INTO users (username, password_hash, full_name, role) VALUES
  ('superadmin', '$argon2id$v=19$m=19456,t=2,p=1$ugPzpG8yS4Z99O1AtRbfXw$IkuhbZ1DvZ6OxBHriyV/P1Iw2JezYoSSh8/2Mlg1lxA',
   'Super Administrator', 'SUPER_ADMIN'),
  ('admin',      '$argon2id$v=19$m=19456,t=2,p=1$ugPzpG8yS4Z99O1AtRbfXw$IkuhbZ1DvZ6OxBHriyV/P1Iw2JezYoSSh8/2Mlg1lxA',
   'Admin Tata Usaha',    'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. PENGATURAN
-- ---------------------------------------------------------------------
INSERT INTO settings (key, value) VALUES

-- Identitas sekolah — PLACEHOLDER, wajib diganti admin lewat halaman
-- Pengaturan setelah masuk pertama kali.
('sekolah', '{
  "nama": "Nama Sekolah Anda",
  "alamat": "Alamat Sekolah",
  "kepala_sekolah": "Nama Kepala Sekolah"
}'),

-- ATURAN JAM & PENENTUAN STATUS — lihat komentar lengkap di seed.sql untuk
-- penjelasan tiap aturan. Nilai di bawah cuma titik awal yang wajar.
('presensi', '{
  "jam_masuk": "07:00",
  "toleransi_menit": 10,
  "batas_alpa": "09:00",
  "jam_pulang": "13:00",
  "hari_sekolah": [1, 2, 3, 4, 5],
  "khusus": {}
}'),

-- Pemetaan sumber scan. Sengaja kosong: diisi dari halaman Scanner.
('scanners', '[]'),

-- Perilaku scan
('scan', '{
  "debounce_detik": 60,
  "tampilkan_foto": true,
  "bunyi": true
}'),

-- WhatsApp — DEFAULT SENGAJA MATI (aktif=false, provider=dummy). Instalasi
-- baru TIDAK BOLEH langsung bisa mengirim pesan sungguhan. Nyalakan hanya
-- setelah: (1) nomor wali murid asli sudah dimasukkan, (2) nomor pengirim
-- khusus sekolah sudah disiapkan (BUKAN nomor pribadi), (3) WA_ALLOWLIST
-- diisi saat masih uji coba. Lihat docs/PLAN.md untuk catatan volume kirim.
('whatsapp', '{
  "aktif": false,
  "provider": "dummy",
  "jeda_min_ms": 3000,
  "jeda_max_ms": 8000,
  "maks_per_hari": 200,
  "maks_percobaan": 3,
  "jam_tenang": {"mulai": "18:30", "selesai": "06:00"},
  "kirim_saat": ["MASUK", "PULANG", "TERLAMBAT", "ALPA"],
  "rekap_mingguan": true
}'),

-- Template pesan (Mendukung Spintax {opsi1|opsi2} untuk anti-spam Meta). Variabel: {siswa} {kelas} {tanggal} {jam} {menit} {sekolah}
('template_wa', '{
  "MASUK": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {telah HADIR|sudah sampai|tercatat hadir} di sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga ananda belajar dengan semangat.|Hormat kami.}\\n— {sekolah}",
  "PULANG": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) {sudah PULANG|telah selesai KBM dan pulang|tercatat scan pulang} dari sekolah pada {tanggal} pukul *{jam}*.\\n\\n{Terima kasih.|Semoga selamat sampai di rumah.|Hormat kami.}\\n— {sekolah}",
  "TERLAMBAT": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) hadir *TERLAMBAT {menit} menit* pada {tanggal} pukul *{jam}*.\\n\\n{Mohon perhatiannya. Terima kasih.|Mohon bantuannya untuk mengingatkan ananda.|Terima kasih.}\\n— {sekolah}",
  "ALPA": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nHingga pukul {jam} hari {tanggal}, ananda *{siswa}* ({kelas}) *BELUM TERCATAT HADIR* dan tidak ada keterangan izin.\\n\\n{Mohon konfirmasinya. Terima kasih.|Mohon hubungi pihak sekolah bila ananda berhalangan.|Terima kasih.}\\n— {sekolah}",
  "REKAP": "Bpk/Ibu, rekap kehadiran ananda *{siswa}* ({kelas}) bulan {bulan}:\\n\\nHadir: {hadir} hari\\nTerlambat: {terlambat} hari\\nIzin: {izin} hari\\nSakit: {sakit} hari\\nAlpa: {alpa} hari\\n\\n*Kehadiran: {persen}%*\\n\\n— {sekolah}"
}')

ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- SELESAI — tidak ada tahun ajaran, kelas, siswa, atau hari libur contoh.
-- Sekolah menambahkannya sendiri lewat halaman aplikasi.
-- =====================================================================
