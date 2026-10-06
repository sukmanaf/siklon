'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Peran } from '@siklon/shared';
import { api } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Sama dengan objek PILIH di apps/api/src/modules/users/users.service.ts. */
export type Pengguna = {
  id: string;
  username: string;
  full_name: string;
  role: Peran;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
};

export function useDaftarPengguna() {
  return useQuery({
    queryKey: kunci.pengguna.daftar(),
    queryFn: () => api.get<Pengguna[]>('/users'),
  });
}

/** Menyegarkan seluruh turunan kunci 'pengguna' sekaligus. */
function useSegarkan() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: kunci.pengguna.akar });
}

export function useBuatPengguna() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: { username: string; full_name: string; password: string }) =>
      api.post<Pengguna>('/users', data),
    onSuccess: () => void segarkan(),
  });
}

export function useUbahPengguna() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      full_name?: string;
      is_active?: boolean;
    }) => api.patch<Pengguna>(`/users/${id}`, data),
    onSuccess: () => void segarkan(),
  });
}

export function useResetPasswordPengguna() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: ({ id, passwordBaru }: { id: string; passwordBaru: string }) =>
      api.post<{ pesan: string }>(`/users/${id}/reset-password`, { passwordBaru }),
    onSuccess: () => void segarkan(),
  });
}

export function useCabutSesiPengguna() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (id: string) => api.post<{ pesan: string }>(`/users/${id}/revoke-sessions`),
    onSuccess: () => void segarkan(),
  });
}

/**
 * Password sementara yang mudah dibacakan lewat telepon: tanpa karakter yang
 * gampang tertukar (0/O, 1/l/I) dan selalu memuat angka serta simbol.
 */
export function acakPassword(panjang = 10) {
  const huruf = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const angka = '23456789';
  const simbol = '@#$%&*?';
  const semua = huruf + angka + simbol;

  const ambil = (dari: string) => {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return dari[b[0]! % dari.length]!;
  };

  // Pastikan minimal satu angka dan satu simbol, sisanya acak, lalu diaduk.
  const isi = [ambil(angka), ambil(simbol)];
  while (isi.length < panjang) isi.push(ambil(semua));
  for (let i = isi.length - 1; i > 0; i--) {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    const j = b[0]! % (i + 1);
    [isi[i], isi[j]] = [isi[j]!, isi[i]!];
  }
  return isi.join('');
}
