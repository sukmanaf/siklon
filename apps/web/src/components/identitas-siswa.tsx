import { cn, inisial } from '@/lib/utils';

/**
 * Identitas siswa dalam bentuk teks: nama + NIS (dan kelas bila diminta).
 *
 * Sistem ini sengaja tidak memakai foto siswa — keputusan pemilik proyek.
 * Lingkaran inisial di kiri murni huruf, bukan gambar, dan gunanya hanya
 * membantu mata menyusuri tabel yang panjang.
 */
export function IdentitasSiswa({
  nama,
  nis,
  kelas,
  ukuran = 'md',
  className,
}: {
  nama: string;
  nis: string;
  kelas?: string | null;
  ukuran?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const gaya = {
    sm: { bulat: 'size-7 text-[10.5px]', nama: 'text-[13px]', sub: 'text-[11px]' },
    md: { bulat: 'size-8 text-[11.5px]', nama: 'text-[13px]', sub: 'text-xs' },
    lg: { bulat: 'size-12 text-base', nama: 'text-base', sub: 'text-[12.5px]' },
  }[ukuran];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary-ink',
          gaya.bulat,
        )}
      >
        {inisial(nama)}
      </div>
      <div className="min-w-0">
        <div className={cn('truncate font-semibold', gaya.nama)}>{nama}</div>
        <div className={cn('num truncate text-muted-foreground', gaya.sub)}>
          {nis}
          {kelas ? ` · ${kelas}` : ''}
        </div>
      </div>
    </div>
  );
}
