'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusPresensi } from '@siklon/shared';
import { api, URL_API } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Kode sel matriks bulanan: H/T/I/S/A, L = libur, '-' = tidak ada data. */
export type KodeSel = 'H' | 'T' | 'I' | 'S' | 'A' | 'L' | '-';

export type RekapKelas = {
  kelas_id: string;
  kelas: string;
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  belum: number;
  persen_hadir: number | null;
};

export type RekapHarian = {
  tanggal: string;
  kelas: RekapKelas[];
  totalSekolah: {
    total: number;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    belum: number;
    persenHadir: number | null;
  };
};

export type BulananKelas = {
  bulan: string;
  kelas: { id: string; nama: string };
  jumlahHari: number;
  hariEfektif: number[];
  hariLibur: { tanggal: number; nama: string }[];
  legenda: Record<string, string>;
  baris: {
    siswaId: string;
    nis: string;
    nama: string;
    sel: { tanggal: number; kode: KodeSel; jamMasuk?: string | null; jamPulang?: string | null }[];
    hadir?: number;
    terlambat?: number;
    izin?: number;
    sakit?: number;
    alpa?: number;
    persenHadir?: number | null;
  }[];
};

export type BulananSiswa = {
  bulan: string;
  siswa: {
    id: string;
    nis: string;
    nama: string;
    kelas: string | null;
    notifikasiAktif: boolean;
  };
  hariEfektif: number;
  ringkasan: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    belumTercatat: number;
    totalMenitTerlambat: number;
    rataJamDatang: string | null;
    persenHadir: number | null;
  };
  kalender: {
    tanggal: number;
    hariSekolah: boolean;
    libur: string | null;
    status: StatusPresensi | null;
    jamMasuk: string | null;
    jamPulang: string | null;
    terlambat: number;
    catatan: string | null;
  }[];
};

export type PerluPerhatian = {
  nis: string;
  nama: string;
  kelas: string | null;
  alpa: number;
  terlambat: number;
  total_menit_terlambat: number;
  persen_hadir: number | null;
  notifikasi_aktif: boolean;
};

export type Dashboard = {
  tanggal: string;
  jamMasuk: string;
  batasTerlambat: string;
  siswaAktif: number;
  hariIni: {
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    tercatat: number;
    belum: number;
    persenHadir: number | null;
  };
  tren: { tanggal: string; persen: number | null; tercatat: number }[];
  kelasPerluPerhatian: {
    kelas: string;
    total: number;
    alpa: number;
    persen: number | null;
  }[];
  aktivitasTerakhir: {
    nis: string;
    nama: string;
    kelas: string | null;
    status: string;
    jam: string | null;
    titik: string | null;
  }[];
  perluDibenahi: { siswaTanpaWali: number; notifikasiMati: number };
  sistem: {
    scannerAgentOnline: boolean;
    whatsapp: { provider: string; tersambung: boolean };
    antrean: { menunggu: number; gagal: number; terkirimHariIni: number; batasHarian: number };
  };
};

export function useRekapHarian(tanggal: string) {
  return useQuery({
    queryKey: kunci.laporan.rekapHarian(tanggal),
    queryFn: () => api.get<RekapHarian>(`/reports/harian/rekap?tanggal=${tanggal}`),
  });
}

export function useBulananKelas(bulan: string, kelasId: string | undefined) {
  return useQuery({
    queryKey: kunci.laporan.bulananKelas(bulan, kelasId ?? ''),
    queryFn: () =>
      api.get<BulananKelas>(`/reports/bulanan/kelas?bulan=${bulan}&kelasId=${kelasId}`),
    enabled: Boolean(kelasId),
  });
}

export function useBulananSiswa(bulan: string, siswaId: string | undefined) {
  return useQuery({
    queryKey: kunci.laporan.bulananSiswa(bulan, siswaId ?? ''),
    queryFn: () =>
      api.get<BulananSiswa>(`/reports/bulanan/siswa?bulan=${bulan}&siswaId=${siswaId}`),
    enabled: Boolean(siswaId),
  });
}

export function usePerluPerhatian(dari: string, sampai: string) {
  return useQuery({
    queryKey: kunci.laporan.perluPerhatian(dari, sampai),
    queryFn: () => api.get<PerluPerhatian[]>(`/reports/perlu-perhatian?dari=${dari}&sampai=${sampai}`),
  });
}

export function useDashboard(tanggal?: string) {
  return useQuery({
    queryKey: kunci.dashboard.ringkasan(tanggal),
    queryFn: () => api.get<Dashboard>(`/dashboard${tanggal ? `?tanggal=${tanggal}` : ''}`),
    refetchInterval: 60_000,
  });
}

/**
 * Ubah status presensi yang sudah ada (mis. koreksi TERLAMBAT jadi IZIN).
 * Catatan wajib — server menolak tanpa itu.
 */
export function useUbahStatusPresensi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { presensiId: string; status: StatusPresensi; catatan: string; jamMasuk?: string; jamPulang?: string; kirimWa?: boolean }) => api.post<{ id: string }>(`/attendance/${data.presensiId}/update`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
      void qc.invalidateQueries({ queryKey: kunci.laporan.akar });
      void qc.invalidateQueries({ queryKey: kunci.dashboard.akar });
    },
  });
}

/** Tandai siswa yang BELUM punya baris presensi hari itu (izin/sakit/alpa). */
export function useTandaiTanpaScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { siswaId: string; tanggal: string; status: 'IZIN' | 'SAKIT' | 'ALPA' | 'HADIR' | 'TERLAMBAT'; catatan: string; jamMasuk?: string; jamPulang?: string; kirimWa?: boolean }) => api.post<{ id: string }>('/attendance/tandai', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
      void qc.invalidateQueries({ queryKey: kunci.laporan.akar });
      void qc.invalidateQueries({ queryKey: kunci.dashboard.akar });
    },
  });
}

/** Jalankan penandaan ALPA otomatis (untuk siswa yang belum absen). */
export function useJalankanAutoAlpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { tanggal?: string; paksa?: boolean }) =>
      api.post<{
        ok: boolean;
        totalBelum: number;
        ditandaiAlpa: number;
        waDiantrekan: number;
        alasan?: string;
        pesan?: string;
      }>('/attendance/auto-alpa', data ?? {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
      void qc.invalidateQueries({ queryKey: kunci.laporan.akar });
      void qc.invalidateQueries({ queryKey: kunci.dashboard.akar });
    },
  });
}

/** URL lampiran presensi (mis. foto surat sakit) — perlu sesi masuk, dipakai langsung sebagai src. */
export function lampiranUrl(presensiId: string): string {
  return `${URL_API}/attendance/${presensiId}/lampiran`;
}

/** Unggah/ganti lampiran presensi. Baris presensinya harus sudah ada dulu. */
export function useUnggahLampiranPresensi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ presensiId, berkas }: { presensiId: string; berkas: File }) => {
      const form = new FormData();
      form.append('lampiran', berkas);
      return api.post<{ pesan: string; url: string }>(`/attendance/${presensiId}/lampiran`, form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
      void qc.invalidateQueries({ queryKey: kunci.laporan.akar });
    },
  });
}

export function useHapusLampiranPresensi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presensiId: string) => api.hapus<{ pesan: string }>(`/attendance/${presensiId}/lampiran`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
      void qc.invalidateQueries({ queryKey: kunci.laporan.akar });
    },
  });
}

/** Tautan unduhan berkas laporan; biarkan browser yang menanganinya. */
export const unduhan = {
  harianExcel: (tanggal: string, kelasId?: string) =>
    `${URL_API}/reports/harian.xlsx?tanggal=${tanggal}${kelasId ? `&kelasId=${kelasId}` : ''}`,
  harianPdf: (tanggal: string, kelasId?: string) =>
    `${URL_API}/reports/harian.pdf?tanggal=${tanggal}${kelasId ? `&kelasId=${kelasId}` : ''}`,
  bulananKelasExcel: (bulan: string, kelasId: string) =>
    `${URL_API}/reports/bulanan/kelas.xlsx?bulan=${bulan}&kelasId=${kelasId}`,
  bulananKelasPdf: (bulan: string, kelasId: string) =>
    `${URL_API}/reports/bulanan/kelas.pdf?bulan=${bulan}&kelasId=${kelasId}`,
  bulananSiswaPdf: (bulan: string, siswaId: string) =>
    `${URL_API}/reports/bulanan/siswa.pdf?bulan=${bulan}&siswaId=${siswaId}`,
  bulananSiswaExcel: (bulan: string, siswaId: string) =>
    `${URL_API}/reports/bulanan/siswa.xlsx?bulan=${bulan}&siswaId=${siswaId}`,
};


export function useHapusPresensi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presensiId: string) => api.hapus<{ pesan: string }>(`/attendance/${presensiId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
    },
  });
}
