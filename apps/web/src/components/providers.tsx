'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { alamatLoginSesiHabis, api, KesalahanApi, KesalahanJaringan, pasangPenangan401 } from '@/lib/api';

function buatQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data presensi berubah cepat; 30 detik cukup untuk menahan
        // permintaan berulang tanpa membuat layar terasa basi.
        staleTime: 30_000,
        retry: (jumlahGagal, error) => {
          // Mengulang permintaan yang ditolak karena hak akses atau data
          // tidak ada hanya menunda pesan errornya muncul.
          if (error instanceof KesalahanApi && error.status < 500 && error.status !== 429) {
            return false;
          }
          // Server mati atau kabel lepas cukup dicoba sekali lagi. Dua kali
          // percobaan dengan backoff membuat pengguna menatap kerangka kosong
          // sekitar 6 detik sebelum tahu servernya memang tidak bisa dihubungi.
          if (error instanceof KesalahanJaringan) return jumlahGagal < 1;
          return jumlahGagal < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient dibuat di dalam state supaya tiap sesi render server tidak
  // berbagi cache antar pengguna.
  const [queryClient] = useState(buatQueryClient);
  const router = useRouter();
  const pathname = usePathname();

  // FE-004: satu-satunya tempat 401 ditangani. Cache dikosongkan supaya data
  // pengguna sebelumnya tidak sempat terlihat oleh pengguna berikutnya.
  useEffect(() => {
    pasangPenangan401(() => {
      if (pathname === '/login') return;
      queryClient.clear();

      /*
       * Cookie yang ditolak server HARUS dibuang lebih dulu.
       *
       * Kalau tidak, cookie-nya masih ada di browser sementara server sudah
       * menolaknya (token_version berubah, akun dinonaktifkan, atau JWT
       * kedaluwarsa). Middleware hanya melihat "ada cookie" lalu menganggap
       * pengguna sudah masuk, jadi setiap pengalihan ke /login dipantulkan
       * balik ke halaman semula — dan layar terjebak menampilkan kerangka
       * pemuatan selamanya.
       *
       * /auth/logout tidak butuh sesi yang sah, jadi aman dipanggil di sini.
       * Pengalihan tetap dijalankan walau panggilan ini gagal.
       */
      void api
        .post('/auth/logout', undefined, { diamSaat401: true })
        .catch(() => undefined)
        .finally(() => router.replace(alamatLoginSesiHabis()));
    });
    return () => pasangPenangan401(null);
  }, [queryClient, router, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
