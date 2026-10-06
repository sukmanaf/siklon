/**
 * Konvensi query key TanStack Query.
 *
 * Aturannya: setiap sumber daya punya satu akar (`['siswa']`), dan seluruh
 * key turunannya diawali akar itu. Dengan begitu satu panggilan
 * `invalidateQueries({ queryKey: kunci.siswa.akar })` cukup menyegarkan
 * semua daftar, detail, dan varian filter sumber daya tersebut.
 *
 * Jangan pernah menulis array key mentah di komponen — selalu lewat berkas ini,
 * supaya salah ketik tidak berubah jadi cache yang diam-diam tidak pernah
 * ter-invalidate.
 */
export type FilterSiswa = {
  cari?: string;
  kelasId?: string;
  aktif?: boolean;
  tanpaWali?: boolean;
  page?: number;
  perPage?: number;
};

export const kunci = {
  /** Profil pengguna yang sedang masuk. */
  saya: ['saya'] as const,

  pengguna: {
    akar: ['pengguna'] as const,
    daftar: () => [...kunci.pengguna.akar, 'daftar'] as const,
    detail: (id: string) => [...kunci.pengguna.akar, 'detail', id] as const,
  },

  siswa: {
    akar: ['siswa'] as const,
    daftar: (f: FilterSiswa) => [...kunci.siswa.akar, 'daftar', f] as const,
    detail: (id: string) => [...kunci.siswa.akar, 'detail', id] as const,
    ringkasan: () => [...kunci.siswa.akar, 'ringkasan'] as const,
  },

  kelas: {
    akar: ['kelas'] as const,
    daftar: (tahunId?: number) => [...kunci.kelas.akar, 'daftar', tahunId ?? 'aktif'] as const,
    anggota: (id: string) => [...kunci.kelas.akar, 'anggota', id] as const,
  },


  tahunAjaran: {
    akar: ['tahun-ajaran'] as const,
    daftar: () => [...kunci.tahunAjaran.akar, 'daftar'] as const,
    aktif: () => [...kunci.tahunAjaran.akar, 'aktif'] as const,
  },

  libur: {
    akar: ['libur'] as const,
    daftar: (tahun?: number) => [...kunci.libur.akar, 'daftar', tahun ?? 'semua'] as const,
  },

  pengaturan: {
    akar: ['pengaturan'] as const,
    semua: () => [...kunci.pengaturan.akar, 'semua'] as const,
    satu: (k: string) => [...kunci.pengaturan.akar, k] as const,
  },

  presensi: {
    akar: ['presensi'] as const,
    harian: (tanggal: string, kelasId?: string) =>
      [...kunci.presensi.akar, 'harian', tanggal, kelasId ?? 'semua'] as const,
    riwayatSiswa: (id: string, dari: string, sampai: string) =>
      [...kunci.presensi.akar, 'siswa', id, dari, sampai] as const,
  },

  scanner: {
    akar: ['scanner'] as const,
    daftar: () => [...kunci.scanner.akar, 'daftar'] as const,
  },

  laporan: {
    akar: ['laporan'] as const,
    harian: (tanggal: string, kelasId?: string) =>
      [...kunci.laporan.akar, 'harian', tanggal, kelasId ?? 'semua'] as const,
    rekapHarian: (tanggal: string) => [...kunci.laporan.akar, 'rekap-harian', tanggal] as const,
    bulananKelas: (bulan: string, kelasId: string) =>
      [...kunci.laporan.akar, 'bulanan-kelas', bulan, kelasId] as const,
    bulananSiswa: (bulan: string, siswaId: string) =>
      [...kunci.laporan.akar, 'bulanan-siswa', bulan, siswaId] as const,
    perluPerhatian: (dari: string, sampai: string) =>
      [...kunci.laporan.akar, 'perlu-perhatian', dari, sampai] as const,
  },

  dashboard: {
    akar: ['dashboard'] as const,
    ringkasan: (tanggal?: string) => [...kunci.dashboard.akar, tanggal ?? 'hari-ini'] as const,
  },

  wa: {
    akar: ['wa'] as const,
    status: () => [...kunci.wa.akar, 'status'] as const,
    pesan: (f: { status?: string; page?: number }) => [...kunci.wa.akar, 'pesan', f] as const,
    detailPesan: (id: string) => [...kunci.wa.akar, 'pesan', 'detail', id] as const,
    pratinjau: (kejadian: string) => [...kunci.wa.akar, 'pratinjau', kejadian] as const,
    nomorBermasalah: () => [...kunci.wa.akar, 'nomor-bermasalah'] as const,
  },
} as const;
