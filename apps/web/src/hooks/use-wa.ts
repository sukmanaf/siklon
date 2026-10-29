'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Halaman, KejadianWa, StatusPesan } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

export type StatusProvider = {
  nama: string;
  tersambung: boolean;
  nomor: string | null;
  /** Teks mentah QR pairing; frontend yang merendernya jadi gambar. */
  qr: string | null;
  tersambungSejak: string | null;
  errorTerakhir: string | null;
};

export type StatusAntrean = {
  menunggu: number;
  terkirim: number;
  gagal: number;
  terkirimHariIni: number;
  batasHarian: number;
  sisaKuota: number;
  dalamJamTenang: boolean;
  jamTenang: { mulai: string; selesai: string };
};

export type RingkasanPengaman = {
  providerEnv: 'dummy' | 'baileys';
  production: boolean;
  allowlistAktif: boolean;
  jumlahAllowlist: number;
  catatan: string;
};

export type StatusWa = {
  provider: StatusProvider;
  antrean: StatusAntrean;
  pengaman: RingkasanPengaman;
};

/**
 * Status koneksi WhatsApp.
 *
 * Di-poll cepat selama belum tersambung — QR pairing Baileys hanya berlaku
 * sekitar 20 detik, jadi layar harus mengambil QR baru sebelum yang lama
 * kedaluwarsa, dan berpindah sendiri ke keadaan "tersambung" begitu wali
 * memindainya (FE-033). Setelah tersambung, polling dijarangkan.
 */
export function useStatusWa(cepat = false) {
  return useQuery({
    queryKey: kunci.wa.status(),
    queryFn: () => api.get<StatusWa>('/wa/status'),
    refetchInterval: cepat ? 5_000 : 20_000,
    staleTime: 0,
  });
}

export function useSambungkanWa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<StatusProvider & { pesan: string }>('/wa/connect'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.wa.akar }),
  });
}

export function usePutuskanWa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ pesan: string }>('/wa/disconnect'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.wa.akar }),
  });
}

/**
 * Buang sesi supaya bisa ditautkan ke nomor LAIN.
 *
 * Beda tegas dari usePutuskanWa: memutus tetap menyimpan sesinya dan
 * menyambung lagi tanpa QR, sedangkan ini membuang kredensialnya sehingga
 * nomor berikutnya boleh nomor yang sama sekali berbeda.
 */
export function useHapusSesiWa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.hapus<{ pesan: string }>('/wa/session'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.wa.akar }),
  });
}

/** Jalankan satu putaran pengiriman sekarang, tanpa menunggu interval worker. */
export function useDispatchSekarang() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Record<string, unknown>>('/wa/dispatch'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.wa.akar }),
  });
}

export function useKirimPesanUji() {
  return useMutation({
    mutationFn: (data: { nomor: string; isi?: string }) =>
      api.post<{ ke: string; hasil: unknown }>('/wa/test', data),
  });
}

// ---------------- Template ----------------

export function usePratinjauTemplate(kejadian: KejadianWa) {
  return useQuery({
    queryKey: kunci.wa.pratinjau(kejadian),
    queryFn: () => api.get<{ kejadian: KejadianWa; isi: string }>(`/wa/preview/${kejadian}`),
  });
}

// ---------------- Log pengiriman ----------------

export type PesanWa = {
  id: string;
  /** Sudah disamarkan server: 0812****7890. */
  nomor: string;
  siswa: { nis: string; nama: string } | null;
  kejadian: string;
  status: StatusPesan | 'CANCELLED';
  percobaan: number;
  errorTerakhir: string | null;
  dibuatPada: string;
  terkirimPada: string | null;
  cuplikan: string;
};

export type DetailPesanWa = {
  id: string;
  nomor: string;
  body: string;
  event: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export function useDaftarPesanWa(filter: { status?: string; page?: number; perPage?: number }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) if (v) q.set(k, String(v));
  const qs = q.toString();
  return useQuery({
    queryKey: kunci.wa.pesan(filter),
    queryFn: () => api.get<Halaman<PesanWa>>(`/wa/messages${qs ? `?${qs}` : ''}`),
    placeholderData: (sebelumnya) => sebelumnya,
    refetchInterval: 15_000,
  });
}

export function useDetailPesanWa(id: string | null) {
  return useQuery({
    queryKey: kunci.wa.detailPesan(id ?? ''),
    queryFn: () => api.get<DetailPesanWa>(`/wa/messages/${id}`),
    enabled: Boolean(id),
  });
}

function useSegarkanWa() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: kunci.wa.akar });
}

export function useKirimUlangPesan() {
  const segarkan = useSegarkanWa();
  return useMutation({
    mutationFn: (id: string) => api.post<{ pesan: string }>(`/wa/messages/${id}/retry`),
    onSuccess: segarkan,
  });
}

export function useKirimUlangSemuaGagal() {
  const segarkan = useSegarkanWa();
  return useMutation({
    mutationFn: () => api.post<{ pesan: string; jumlah: number }>('/wa/messages/retry-failed'),
    onSuccess: segarkan,
  });
}

export function useBatalkanSemuaAntrean() {
  const segarkan = useSegarkanWa();
  return useMutation({
    mutationFn: () => api.post<{ pesan: string; jumlah: number }>('/wa/messages/cancel-queued'),
    onSuccess: segarkan,
  });
}

export type NomorBermasalah = {
  nomor?: string;
  [k: string]: unknown;
};

export function useNomorBermasalah() {
  return useQuery({
    queryKey: kunci.wa.nomorBermasalah(),
    queryFn: () => api.get<NomorBermasalah[]>('/wa/nomor-bermasalah'),
  });
}

export const KEJADIAN_LABEL: Record<KejadianWa, { judul: string; jelas: string }> = {
  MASUK: { judul: 'Siswa hadir', jelas: 'Dikirim tiap kali kartu dipindai dan statusnya HADIR.' },
  PULANG: {
    judul: 'Siswa pulang',
    jelas:
      'Dikirim saat siswa scan lagi pada/sesudah jam pulang. Mati secara bawaan: ratusan pesan tercipta serentak saat bel pulang, dan antreannya bisa baru habis ±55 menit kemudian.',
  },
  TERLAMBAT: { judul: 'Siswa terlambat', jelas: 'Dikirim saat scan melewati batas terlambat.' },
  ALPA: { judul: 'Siswa tidak hadir', jelas: 'Dikirim sekali setelah batas alpa terlewat.' },
  IZIN: { judul: 'Siswa izin', jelas: 'Dikirim saat presensi ditandai sebagai IZIN.' },
  SAKIT: { judul: 'Siswa sakit', jelas: 'Dikirim saat presensi ditandai sebagai SAKIT.' },
  REKAP: { judul: 'Rekap berkala', jelas: 'Ringkasan kehadiran yang dikirim berkala.' },
};
