'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Scanner } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Port yang sedang terdeteksi Scanner Agent, digabung dengan pemetaannya. */
export type PortScanner = {
  kunci: string;
  path: string;
  merek: string | null;
  vidPid: string | null;
  /** Tanpa nomor seri, pemetaan ikut lokasi colokan USB — rapuh. */
  tanpaNomorSeri: boolean;
  sudahDinamai: boolean;
  kode: string | null;
  label: string | null;
  tipe: 'SERIAL' | 'KAMERA';
  aktif: boolean;
};

export type DaftarScanner = {
  agent: {
    online: boolean;
    lewatSocket: boolean;
    terlihatPada: string | null;
    versi: string | null;
  };
  modeIdentifikasi: boolean;
  terdeteksi: PortScanner[];
  /** Pemetaan tersimpan yang perangkatnya sedang tidak terdeteksi. */
  tidakTerdeteksi: (Scanner & { terdeteksi: false })[];
};

export function useDaftarScanner() {
  return useQuery({
    queryKey: kunci.scanner.daftar(),
    queryFn: () => api.get<DaftarScanner>('/scanners'),
    // Status agent basi dalam hitungan detik; segarkan berkala.
    refetchInterval: 15_000,
  });
}

export function useSimpanPemetaan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scanners: Scanner[]) => api.put<unknown>('/scanners', { scanners }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.scanner.akar }),
  });
}

export function useModeIdentifikasi() {
  const qc = useQueryClient();
  const segarkan = () => void qc.invalidateQueries({ queryKey: kunci.scanner.akar });

  const mulai = useMutation({
    mutationFn: () =>
      api.post<{ aktifSampai: string; detik: number; pesan: string }>('/scanners/identify'),
    onSuccess: segarkan,
  });
  const hentikan = useMutation({
    mutationFn: () => api.hapus<{ pesan: string }>('/scanners/identify'),
    onSuccess: segarkan,
  });

  return { mulai, hentikan };
}
