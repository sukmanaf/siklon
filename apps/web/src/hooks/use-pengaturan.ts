'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KunciSetting, Presensi, Scan, Sekolah } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Bentuk isi seluruh setting; hanya kunci yang dipakai frontend Fase 2. */
export type SemuaSetting = {
  presensi: Presensi;
  sekolah: Sekolah;
  scan: Scan;
} & Record<string, unknown>;

export function useSemuaSetting() {
  return useQuery({
    queryKey: kunci.pengaturan.semua(),
    queryFn: () => api.get<SemuaSetting>('/settings'),
    staleTime: 60_000,
  });
}

export function useSimpanSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kunci: k, nilai }: { kunci: KunciSetting; nilai: unknown }) =>
      api.put<unknown>(`/settings/${k}`, nilai),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.pengaturan.akar }),
  });
}
