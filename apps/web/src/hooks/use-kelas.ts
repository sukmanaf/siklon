'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';
import type { AnggotaKelas, HasilPromote, HasilSalinKelas, Kelas } from '@/lib/tipe';

export function useDaftarKelas(tahunId?: number) {
  return useQuery({
    queryKey: kunci.kelas.daftar(tahunId),
    queryFn: () => api.get<Kelas[]>(`/classes${tahunId ? `?tahunId=${tahunId}` : ''}`),
    // Daftar kelas jarang berubah dan dipakai di banyak filter.
    staleTime: 5 * 60_000,
  });
}

export function useAnggotaKelas(id: string | undefined) {
  return useQuery({
    queryKey: kunci.kelas.anggota(id ?? ''),
    queryFn: () => api.get<AnggotaKelas[]>(`/classes/${id}/anggota`),
    enabled: Boolean(id),
  });
}

function useSegarkanKelas() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: kunci.kelas.akar });
    void qc.invalidateQueries({ queryKey: kunci.siswa.akar });
  };
}

type DataKelas = {
  name: string;
  grade_level?: number;
  academic_year_id?: number;
};

export function useBuatKelas() {
  const segarkan = useSegarkanKelas();
  return useMutation({
    mutationFn: (data: DataKelas) => api.post<Kelas>('/classes', data),
    onSuccess: segarkan,
  });
}

export function useUbahKelas() {
  const segarkan = useSegarkanKelas();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<DataKelas> & { id: string; is_active?: boolean }) =>
      api.patch<Kelas>(`/classes/${id}`, data),
    onSuccess: segarkan,
  });
}

export function useHapusKelas() {
  const segarkan = useSegarkanKelas();
  return useMutation({
    mutationFn: (id: string) => api.hapus<{ pesan: string }>(`/classes/${id}`),
    onSuccess: segarkan,
  });
}

/**
 * Menyalin kerangka kelas ke tahun ajaran lain.
 *
 * Yang disalin cuma nama dan tingkatnya — siswanya tidak ikut, karena
 * memindahkan siswa adalah keputusan terpisah (kenaikan kelas).
 */
export function useSalinKelas() {
  const segarkan = useSegarkanKelas();
  return useMutation({
    mutationFn: (data: { dariTahunId?: number; keTahunId: number }) =>
      api.post<HasilSalinKelas>('/classes/salin', data),
    onSuccess: segarkan,
  });
}

export function useNaikkanKelas() {
  const segarkan = useSegarkanKelas();
  return useMutation({
    mutationFn: (pasangan: { dariKelasId: string; keKelasId: string }[]) =>
      api.post<HasilPromote>('/classes/promote', { pasangan }),
    onSuccess: segarkan,
  });
}
