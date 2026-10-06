'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';
import type { Libur, TahunAjaran } from '@/lib/tipe';

export function useDaftarTahunAjaran() {
  return useQuery({
    queryKey: kunci.tahunAjaran.daftar(),
    queryFn: () => api.get<TahunAjaran[]>('/academic-years'),
    staleTime: 5 * 60_000,
  });
}

export function useTahunAjaranAktif() {
  return useQuery({
    queryKey: kunci.tahunAjaran.aktif(),
    queryFn: () => api.get<TahunAjaran>('/academic-years/aktif'),
    staleTime: 5 * 60_000,
  });
}

function useSegarkanTahun() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: kunci.tahunAjaran.akar });
    // Ganti tahun ajaran mengubah kelas mana yang ditampilkan.
    void qc.invalidateQueries({ queryKey: kunci.kelas.akar });
  };
}

export function useBuatTahunAjaran() {
  const segarkan = useSegarkanTahun();
  return useMutation({
    mutationFn: (data: { name: string; start_date: string; end_date: string }) =>
      api.post<TahunAjaran>('/academic-years', data),
    onSuccess: segarkan,
  });
}

export function useAktifkanTahunAjaran() {
  const segarkan = useSegarkanTahun();
  return useMutation({
    mutationFn: (id: number) => api.post<TahunAjaran>(`/academic-years/${id}/aktifkan`),
    onSuccess: segarkan,
  });
}

export function useHapusTahunAjaran() {
  const segarkan = useSegarkanTahun();
  return useMutation({
    mutationFn: (id: number) => api.hapus<{ pesan: string }>(`/academic-years/${id}`),
    onSuccess: segarkan,
  });
}

// ---------------- Hari libur ----------------

export function useDaftarLibur(tahun?: number) {
  return useQuery({
    queryKey: kunci.libur.daftar(tahun),
    queryFn: () => api.get<Libur[]>(`/holidays${tahun ? `?tahun=${tahun}` : ''}`),
  });
}

function useSegarkanLibur() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: kunci.libur.akar });
}

export function useTambahLibur() {
  const segarkan = useSegarkanLibur();
  return useMutation({
    mutationFn: (data: { holiday_date: string; name: string }) =>
      api.post<Libur>('/holidays', data),
    onSuccess: segarkan,
  });
}

export function useHapusLibur() {
  const segarkan = useSegarkanLibur();
  return useMutation({
    mutationFn: (tanggal: string) => api.hapus<{ pesan: string }>(`/holidays/${tanggal}`),
    onSuccess: segarkan,
  });
}
