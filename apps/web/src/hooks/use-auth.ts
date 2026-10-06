'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Peran } from '@siklon/shared';
import { api, KesalahanApi } from '@/lib/api';
import { kunci } from '@/lib/query-keys';

/** Bentuk `req.user` di backend — lihat middlewares/auth.ts. */
export type Saya = {
  id: string;
  username: string;
  nama: string;
  peran: Peran;
  wajibGantiPassword: boolean;
};

/**
 * Profil pengguna yang sedang masuk.
 *
 * Ini juga pemeriksaan sesi yang sebenarnya: middleware Next hanya melihat ada
 * atau tidaknya cookie, sedangkan validitasnya (tanda tangan, token_version,
 * akun masih aktif) hanya bisa dipastikan backend.
 */
export function useSaya(aktif = true) {
  return useQuery({
    queryKey: kunci.saya,
    queryFn: () => api.get<Saya>('/auth/me'),
    enabled: aktif,
    // Identitas jarang berubah dalam satu sesi; jangan ditembak berulang kali.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      api.post<{ user: Saya; token: string }>('/auth/login', data, { diamSaat401: true }),
    onSuccess: ({ user }) => {
      // Isi cache langsung supaya halaman tujuan tidak perlu menunggu /auth/me.
      qc.setQueryData(kunci.saya, user);
    },
  });
}

export function useGantiPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { passwordLama: string; passwordBaru: string }) =>
      api.post<{ pesan: string }>('/auth/change-password', data),
    onSuccess: () => {
      // token_version naik di server dan cookie diganti; profil (termasuk
      // wajibGantiPassword) harus diambil ulang.
      void qc.invalidateQueries({ queryKey: kunci.saya });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (semuaPerangkat?: boolean) =>
      api.post<{ pesan: string }>(semuaPerangkat ? '/auth/logout-all' : '/auth/logout'),
    // Apa pun hasilnya, pengguna harus berakhir di halaman login: kalau logout
    // gagal karena sesi sudah tidak valid, memaksanya bertahan di dalam
    // aplikasi justru lebih membingungkan.
    onSettled: () => {
      qc.clear();
      router.replace('/login');
    },
  });
}

/** Apakah error ini berarti "tidak punya hak akses"? */
export const adalah403 = (e: unknown) => e instanceof KesalahanApi && e.status === 403;
