/** Status presensi. Nilainya harus sama persis dengan enum attendance_status di database. */
export const STATUS_PRESENSI = ['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'] as const;
export type StatusPresensi = (typeof STATUS_PRESENSI)[number];

/** Status yang dikunci admin — scan tidak boleh menimpanya. */
export const STATUS_TERKUNCI: readonly StatusPresensi[] = ['IZIN', 'SAKIT'];

/** Peran pengguna. Hanya dua: Super Admin bisa mengelola akun, Admin tidak. */
export const PERAN = ['SUPER_ADMIN', 'ADMIN'] as const;
export type Peran = (typeof PERAN)[number];

/** Kejadian yang bisa memicu notifikasi WhatsApp. */
export const KEJADIAN_WA = ['MASUK', 'PULANG', 'TERLAMBAT', 'ALPA', 'REKAP'] as const;
export type KejadianWa = (typeof KEJADIAN_WA)[number];

export const STATUS_PESAN = ['QUEUED', 'SENT', 'FAILED', 'CANCELLED'] as const;
export type StatusPesan = (typeof STATUS_PESAN)[number];

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
