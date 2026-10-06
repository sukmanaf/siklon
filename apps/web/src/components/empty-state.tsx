import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keadaan kosong yang seragam. Dipakai juga untuk keadaan error dengan
 * `variant="error"` — sebuah halaman tidak boleh berakhir sebagai layar
 * putih kosong saat API mati (FE-043).
 */
export function EmptyState({
  ikon,
  judul,
  deskripsi,
  aksi,
  variant = 'kosong',
  className,
}: {
  ikon?: ReactNode;
  judul: string;
  deskripsi?: ReactNode;
  aksi?: ReactNode;
  variant?: 'kosong' | 'error';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-14 text-center', className)}>
      {ikon && (
        <div
          className={cn(
            'mb-1 grid size-11 place-items-center rounded-full [&_svg]:size-5',
            variant === 'error' ? 'bg-alpa-bg text-alpa' : 'bg-surface-2 text-faint',
          )}
        >
          {ikon}
        </div>
      )}
      <p className="text-sm font-semibold">{judul}</p>
      {deskripsi && (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{deskripsi}</p>
      )}
      {aksi && <div className="mt-3">{aksi}</div>}
    </div>
  );
}
