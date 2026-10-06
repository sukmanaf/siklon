'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Halaman } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci, type FilterSiswa } from '@/lib/query-keys';
import type { HasilImport, RingkasanSiswa, RiwayatSiswa, Siswa } from '@/lib/tipe';

/** Membuang kunci kosong supaya query key tidak berbeda hanya karena `undefined`. */
function bersihkan(f: FilterSiswa) {
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && v !== ''),
  ) as FilterSiswa;
}

function keQuery(f: FilterSiswa) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(bersihkan(f))) p.set(k, String(v));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export function useDaftarSiswa(filter: FilterSiswa) {
  const bersih = bersihkan(filter);
  return useQuery({
    queryKey: kunci.siswa.daftar(bersih),
    queryFn: () => api.get<Halaman<Siswa>>(`/students${keQuery(bersih)}`),
    // Data halaman sebelumnya ditahan saat pindah halaman/filter supaya tabel
    // tidak berkedip kosong setiap ketikan.
    placeholderData: (sebelumnya) => sebelumnya,
  });
}

export function useDetailSiswa(id: string | undefined) {
  return useQuery({
    queryKey: kunci.siswa.detail(id ?? ''),
    queryFn: () => api.get<Siswa>(`/students/${id}`),
    enabled: Boolean(id),
  });
}

export function useRingkasanSiswa() {
  return useQuery({
    queryKey: kunci.siswa.ringkasan(),
    queryFn: () => api.get<RingkasanSiswa>('/students/ringkasan'),
  });
}

export function useRiwayatPresensiSiswa(id: string | undefined, dari: string, sampai: string) {
  return useQuery({
    queryKey: kunci.presensi.riwayatSiswa(id ?? '', dari, sampai),
    queryFn: () => api.get<RiwayatSiswa>(`/attendance/siswa/${id}?dari=${dari}&sampai=${sampai}`),
    enabled: Boolean(id),
  });
}

type DataSiswa = {
  nis: string;
  full_name: string;
  class_id?: string | null;
  guardian_phone?: string | null;
  notify?: boolean;
};

function useSegarkanSiswa() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: kunci.siswa.akar });
    // Jumlah anggota kelas ikut berubah saat siswa dipindah atau dinonaktifkan.
    void qc.invalidateQueries({ queryKey: kunci.kelas.akar });
  };
}

export function useBuatSiswa() {
  const segarkan = useSegarkanSiswa();
  return useMutation({
    mutationFn: (data: DataSiswa) => api.post<Siswa>('/students', data),
    onSuccess: segarkan,
  });
}

export function useUbahSiswa() {
  const segarkan = useSegarkanSiswa();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<DataSiswa> & { id: string; is_active?: boolean }) =>
      api.patch<Siswa>(`/students/${id}`, data),
    onSuccess: segarkan,
  });
}

export function useNonaktifkanSiswa() {
  const segarkan = useSegarkanSiswa();
  return useMutation({
    mutationFn: (id: string) => api.post<{ pesan: string }>(`/students/${id}/nonaktifkan`),
    onSuccess: segarkan,
  });
}

export function useHapusSiswa() {
  const segarkan = useSegarkanSiswa();
  return useMutation({
    mutationFn: (id: string) => api.hapus<{ pesan: string }>(`/students/${id}`),
    onSuccess: segarkan,
  });
}

// ---------------- Import Excel ----------------

export function useImportSiswa() {
  const segarkan = useSegarkanSiswa();
  return useMutation({
    mutationFn: ({ berkas, hanyaPeriksa }: { berkas: File; hanyaPeriksa: boolean }) => {
      const form = new FormData();
      form.append('berkas', berkas, berkas.name);
      return api.post<HasilImport>(
        `/students/import${hanyaPeriksa ? '?periksa=true' : ''}`,
        form,
      );
    },
    onSuccess: (hasil) => {
      // Hanya menyegarkan bila memang ada yang tersimpan; mode periksa tidak
      // mengubah apa pun.
      if (hasil.tersimpan) segarkan();
    },
  });
}
