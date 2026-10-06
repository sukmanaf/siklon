import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card shadow-card', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      // flex-wrap penting: kepala kartu hampir selalu berisi judul + tombol
      // aksi, dan di lebar HP keduanya tidak muat sebaris. Tanpa ini tombolnya
      // terdorong keluar dan seluruh halaman jadi bisa digeser mendatar.
      className={cn(
        'flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-sm font-semibold', className)} {...props} />;
}

function CardHint({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/** Isi kartu tanpa padding — dipakai saat isinya tabel penuh lebar. */
function CardContentFlush({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-0', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardHint, CardContent, CardContentFlush };
