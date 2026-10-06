'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerCrashIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSaya } from '@/hooks/use-auth';
import { pesanError } from '@/lib/api';

/**
 * Penjaga seluruh halaman di dalam aplikasi.
 *
 * Middleware sudah memastikan ada cookie, tapi cookie bisa saja kedaluwarsa
 * atau sudah dibatalkan. `/auth/me` yang memutuskan: gagal 401 ditangani klien
 * API (kembali ke login), sedangkan `wajibGantiPassword` dibelokkan ke sana.
 */
export default function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: saya, isPending, isError, error, refetch } = useSaya();

  // FE-009: tidak ada halaman lain yang boleh terbuka sebelum passwordnya diganti.
  useEffect(() => {
    if (saya?.wajibGantiPassword) router.replace('/ganti-password');
  }, [saya?.wajibGantiPassword, router]);

  if (isPending || saya?.wajibGantiPassword) {
    return (
      <div className="grid min-h-screen md:grid-cols-[236px_1fr]">
        <div className="hidden bg-sidebar md:block" />
        <div className="flex flex-col">
          <div className="h-[57px] border-b border-border bg-card" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <Card className="w-full max-w-lg">
          <EmptyState
            variant="error"
            ikon={<ServerCrashIcon />}
            judul="Aplikasi tidak bisa menghubungi server"
            deskripsi={pesanError(error)}
            aksi={
              <Button variant="default" onClick={() => void refetch()}>
                Coba lagi
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return <AppShell saya={saya}>{children}</AppShell>;
}
