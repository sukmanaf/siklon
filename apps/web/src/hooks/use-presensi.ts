'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HasilScan, StatusPresensi } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Satu baris presensi harian — satu baris per SISWA, termasuk yang belum scan. */
export type BarisHarian = {
  siswaId: string;
  nis: string;
  nama: string;
  kelas: string | null;
  notifikasiAktif: boolean;
  presensiId: string | null;
  status: StatusPresensi | 'BELUM';
  jamMasuk: string | null;
  jamPulang: string | null;
  terlambatMenit: number;
  titikScan: string | null;
  catatan: string | null;
  diubahManual: boolean;
  punyaLampiran: boolean;
};

export type PresensiHarian = {
  tanggal: string;
  ringkasan: {
    total: number;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    belum: number;
    persenHadir: number | null;
  };
  baris: BarisHarian[];
};

export function usePresensiHarian(tanggal: string, kelasId?: string) {
  return useQuery({
    queryKey: kunci.presensi.harian(tanggal, kelasId),
    queryFn: () =>
      api.get<PresensiHarian>(
        `/attendance?tanggal=${tanggal}${kelasId ? `&kelasId=${kelasId}` : ''}`,
      ),
  });
}

/**
 * Scan dari kamera di browser.
 *
 * Ini scan sungguhan, setara dengan pemindai serial di gerbang: lewat resolver
 * status yang sama dan memicu notifikasi WhatsApp yang sama. Tidak ditandai
 * sebagai koreksi manual, dan tidak mencatat titik scan — sistem ini memang
 * tidak perlu tahu siswa absen lewat mana.
 */
export function useScanKamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nis: string }) => api.post<HasilScan>('/attendance/scan', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
    },
  });
}

/**
 * Presensi manual: kartu tertinggal, kartu rusak, atau siswa yang datang
 * lewat pintu tanpa scanner. Catatan wajib — tanpa alasan tertulis, koreksi
 * jadi tidak bisa dipertanggungjawabkan saat orang tua bertanya.
 */
export function usePresensiManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nis: string; catatan: string; waktu?: string }) =>
      api.post<HasilScan>('/attendance/manual', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunci.presensi.akar });
    },
  });
}
