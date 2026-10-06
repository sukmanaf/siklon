import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TidakDitemukan() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="space-y-3">
        <p className="num text-4xl font-bold text-faint">404</p>
        <h1 className="text-lg">Halaman tidak ditemukan</h1>
        <p className="text-[13px] text-muted-foreground">
          Alamat yang Anda buka tidak ada. Mungkin menunya sudah berpindah.
        </p>
        <Button asChild variant="default" className="mt-2">
          <Link href="/dashboard">Kembali ke dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
