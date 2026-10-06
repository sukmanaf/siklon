'use client';

import { useEffect } from 'react';
import { ServerCrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Jaring pengaman terakhir: error yang lolos dari semua penanganan lokal
 * berakhir di sini, bukan sebagai layar putih kosong (FE-043).
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Detailnya tetap perlu terlihat saat pengembangan.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md space-y-3 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alpa-bg text-alpa">
          <ServerCrashIcon className="size-5" />
        </div>
        <h1 className="text-lg">Terjadi kesalahan</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Halaman ini gagal ditampilkan. Coba muat ulang; kalau terus berulang, catat waktunya dan
          laporkan ke pengelola sistem.
        </p>
        {error.digest && <p className="num text-xs text-faint">kode: {error.digest}</p>}
        <Button variant="default" onClick={reset} className="mt-2">
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
