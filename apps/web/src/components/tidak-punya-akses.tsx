import Link from 'next/link';
import { ShieldAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';

/**
 * Ditampilkan saat backend menjawab 403.
 *
 * Menyembunyikan menu di sidebar hanya kosmetik; halaman ini yang menyambut
 * pengguna yang mengetik URL-nya langsung (FE-011).
 */
export function TidakPunyaAkses({ pesan }: { pesan?: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        variant="error"
        ikon={<ShieldAlertIcon />}
        judul="Anda tidak punya akses ke halaman ini"
        deskripsi={
          pesan ??
          'Halaman ini khusus Super Admin. Kalau Anda merasa seharusnya bisa membukanya, minta Super Admin sekolah memeriksa peran akun Anda.'
        }
        aksi={
          <Button asChild variant="default">
            <Link href="/dashboard">Kembali ke dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
