/** Status presensi. Nilainya harus sama persis dengan enum attendance_status di database. */
export const STATUS_PRESENSI = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'] as const;
export type StatusPresensi = (typeof STATUS_PRESENSI)[number];

/** Status yang dikunci admin — scan tidak boleh menimpanya. */
export const STATUS_TERKUNCI: readonly StatusPresensi[] = ['IZIN', 'SAKIT'];

/** Peran pengguna. Hanya dua: Super Admin bisa mengelola akun, Admin tidak. */
export const PERAN = ['SUPER_ADMIN', 'ADMIN'] as const;
export type Peran = (typeof PERAN)[number];

/** Kejadian yang bisa memicu notifikasi WhatsApp. */
export const KEJADIAN_WA = ['MASUK', 'PULANG', 'TERLAMBAT', 'ALPA', 'IZIN', 'SAKIT', 'REKAP'] as const;
export type KejadianWa = (typeof KEJADIAN_WA)[number];

export const STATUS_PESAN = ['QUEUED', 'SENT', 'FAILED', 'CANCELLED'] as const;
export type StatusPesan = (typeof STATUS_PESAN)[number];

export const DEFAULT_TEMPLATE_WA: Record<KejadianWa, string> = {
  MASUK: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) {telah HADIR|sudah sampai|tercatat hadir} di sekolah pada {tanggal} pukul *{jam}*.\n\n{Terima kasih.|Semoga ananda belajar dengan semangat.|Hormat kami.}\n— {sekolah}",
  PULANG: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) {sudah PULANG|telah selesai KBM dan pulang|tercatat scan pulang} dari sekolah pada {tanggal} pukul *{jam}*.\n\n{Terima kasih.|Semoga selamat sampai di rumah.|Hormat kami.}\n— {sekolah}",
  TERLAMBAT: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) hadir *TERLAMBAT {menit} menit* pada {tanggal} pukul *{jam}*.\n\n{Mohon perhatiannya. Terima kasih.|Mohon bantuannya untuk mengingatkan ananda.|Terima kasih.}\n— {sekolah}",
  ALPA: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nHingga pukul {jam} hari {tanggal}, ananda *{siswa}* ({kelas}) *BELUM TERCATAT HADIR* dan tidak ada keterangan izin.\n\n{Mohon konfirmasinya. Terima kasih.|Mohon hubungi pihak sekolah bila ananda berhalangan.|Terima kasih.}\n— {sekolah}",
  IZIN: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) tercatat *IZIN* pada {tanggal}.\nKeterangan: {catatan}\n\n{Terima kasih atas informasinya.|Terima kasih.|Hormat kami.}\n— {sekolah}",
  SAKIT: "{Assalamu'alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) tercatat *SAKIT* pada {tanggal}.\nKeterangan: {catatan}\n\n{Semoga ananda lekas sembuh.|Semoga lekas pulih. Terima kasih.|Hormat kami.}\n— {sekolah}",
  REKAP: "Bpk/Ibu, rekap kehadiran ananda *{siswa}* ({kelas}) bulan {bulan}:\n\nHadir: {hadir} hari\nTerlambat: {terlambat} hari\nIzin: {izin} hari\nSakit: {sakit} hari\nAlpa: {alpa} hari\n\n*Kehadiran: {persen}%*\n\n— {sekolah}",
};

/** Kode error yang dikembalikan endpoint scan ke layar operator. */
export const KODE_ERROR_SCAN = {
  NIS_TIDAK_DITEMUKAN: 'NIS tidak terdaftar',
  SISWA_NONAKTIF: 'Siswa tidak aktif',
  SUDAH_ABSEN: 'Sudah absen hari ini',
  SUDAH_IZIN: 'Tercatat izin/sakit hari ini',
  HARI_LIBUR: 'Hari ini bukan hari sekolah',
  DI_LUAR_JAM: 'Di luar jam operasional scan',
} as const;
export type KodeErrorScan = keyof typeof KODE_ERROR_SCAN;

/** Label hari untuk tampilan dan pesan. Indeks 0 = Minggu, sesuai EXTRACT(DOW). */
export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const ZONA_WAKTU = 'Asia/Jakarta';
