'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { pesanError } from '@/lib/api';
import { cn } from '@/lib/utils';

export type Arah = 'naik' | 'turun';
export type Sortir = { kunci: string; arah: Arah };

export type Kolom<T> = {
  /** Pengenal kolom; dipakai sebagai kunci sortir. */
  kunci: string;
  judul: ReactNode;
  render: (baris: T) => ReactNode;
  /**
   * Nilai untuk mengurutkan. Ada sendiri karena `render` mengembalikan JSX
   * yang tidak bisa dibandingkan. Kolom tanpa ini tidak bisa disortir.
   */
  nilaiSortir?: (baris: T) => string | number | null | undefined;
  className?: string;
  classHead?: string;
};

type Props<T> = {
  kolom: Kolom<T>[];
  data: T[] | undefined;
  idBaris: (baris: T) => string;
  memuat?: boolean;
  error?: unknown;
  onCobaLagi?: () => void;
  /** Ditampilkan saat data ada tapi kosong. */
  kosong?: ReactNode;
  perHalaman?: number;
  /**
   * Dipakai bila daftarnya dipaginasi server (mis. 600 siswa). Saat prop ini
   * ada, tabel tidak memotong datanya sendiri — ia hanya menggambar kontrol
   * halaman dan melapor lewat `onHalaman`.
   */
  paginasiServer?: {
    halaman: number;
    perPage: number;
    total: number;
    totalHalaman: number;
    onHalaman: (halaman: number) => void;
  };
  sortirAwal?: Sortir;
  classBaris?: (baris: T) => string | undefined;
  className?: string;
};

/**
 * Tabel serbaguna: sortir per kolom + pagination, plus keadaan memuat, error,
 * dan kosong sekaligus. Halaman yang memakainya cukup mendeskripsikan kolom.
 *
 * Sortir dan pagination di sini dikerjakan di sisi klien. Untuk daftar yang
 * dipaginasi server (mis. 600 siswa), halaman pemanggil yang mengurus
 * `page`/`perPage` ke API dan cukup mengoper potongan datanya ke sini dengan
 * `perHalaman={0}` supaya tabel ini tidak memotong ulang.
 */
export function DataTable<T>({
  kolom,
  data,
  idBaris,
  memuat,
  error,
  onCobaLagi,
  kosong,
  perHalaman = 20,
  paginasiServer,
  sortirAwal,
  classBaris,
  className,
}: Props<T>) {
  const [sortir, setSortir] = useState<Sortir | null>(sortirAwal ?? null);
  const [halaman, setHalaman] = useState(1);

  const terurut = useMemo(() => {
    if (!data || !sortir) return data ?? [];
    const kol = kolom.find((k) => k.kunci === sortir.kunci);
    if (!kol?.nilaiSortir) return data;
    const arah = sortir.arah === 'naik' ? 1 : -1;
    return [...data].sort((a, b) => {
      const x = kol.nilaiSortir!(a);
      const y = kol.nilaiSortir!(b);
      // Nilai kosong selalu di bawah, apa pun arah sortirnya.
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * arah;
      return String(x).localeCompare(String(y), 'id', { numeric: true }) * arah;
    });
  }, [data, sortir, kolom]);

  // `error` bertipe unknown; jadikan boolean dulu agar bisa dipakai di JSX.
  const adaError = error !== undefined && error !== null;

  const pakaiPaginasi = !paginasiServer && perHalaman > 0;
  const totalHalaman = pakaiPaginasi ? Math.max(1, Math.ceil(terurut.length / perHalaman)) : 1;
  // Kalau data menyusut (mis. setelah filter), halaman aktif ikut mundur.
  const halamanAman = Math.min(halaman, totalHalaman);
  const tampil = pakaiPaginasi
    ? terurut.slice((halamanAman - 1) * perHalaman, halamanAman * perHalaman)
    : terurut;

  // Angka yang digambar di kaki tabel: dari server bila ada, kalau tidak dari
  // hasil pemotongan lokal.
  const kaki = paginasiServer
    ? {
        halaman: paginasiServer.halaman,
        totalHalaman: paginasiServer.totalHalaman,
        total: paginasiServer.total,
        dari: (paginasiServer.halaman - 1) * paginasiServer.perPage + 1,
        sampai: Math.min(paginasiServer.halaman * paginasiServer.perPage, paginasiServer.total),
        ke: paginasiServer.onHalaman,
      }
    : {
        halaman: halamanAman,
        totalHalaman,
        total: terurut.length,
        dari: (halamanAman - 1) * perHalaman + 1,
        sampai: Math.min(halamanAman * perHalaman, terurut.length),
        ke: setHalaman,
      };

  const tampilkanKaki = !memuat && !adaError && (paginasiServer
    ? paginasiServer.total > paginasiServer.perPage
    : pakaiPaginasi && terurut.length > perHalaman);

  function ubahSortir(kunci: string) {
    setSortir((s) =>
      s?.kunci === kunci
        ? s.arah === 'naik'
          ? { kunci, arah: 'turun' }
          : null // klik ketiga mengembalikan urutan asli dari server
        : { kunci, arah: 'naik' },
    );
    setHalaman(1);
  }

  const jumlahKolom = kolom.length;

  return (
    <div className={className}>
      <TableWrap>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-surface-2">
              {kolom.map((k) => {
                const bisaSortir = Boolean(k.nilaiSortir);
                const aktif = sortir?.kunci === k.kunci;
                return (
                  <TableHead key={k.kunci} className={k.classHead}>
                    {bisaSortir ? (
                      <button
                        type="button"
                        onClick={() => ubahSortir(k.kunci)}
                        className="inline-flex items-center gap-1 font-bold tracking-wider uppercase transition-colors hover:text-foreground"
                        aria-label={`Urutkan menurut ${typeof k.judul === 'string' ? k.judul : k.kunci}`}
                      >
                        {k.judul}
                        {!aktif && <ChevronsUpDownIcon className="size-3 opacity-45" />}
                        {aktif && sortir.arah === 'naik' && <ChevronUpIcon className="size-3" />}
                        {aktif && sortir.arah === 'turun' && <ChevronDownIcon className="size-3" />}
                      </button>
                    ) : (
                      k.judul
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {memuat &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`memuat-${i}`} className="hover:bg-transparent">
                  {kolom.map((k) => (
                    <TableCell key={k.kunci}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!memuat && adaError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={jumlahKolom} className="p-0">
                  <EmptyState
                    variant="error"
                    judul="Data gagal dimuat"
                    deskripsi={pesanError(error)}
                    aksi={
                      onCobaLagi && (
                        <Button size="sm" onClick={onCobaLagi}>
                          Coba lagi
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {!memuat && !adaError && tampil.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={jumlahKolom} className="p-0">
                  {kosong ?? <EmptyState judul="Belum ada data" />}
                </TableCell>
              </TableRow>
            )}

            {!memuat &&
              !adaError &&
              tampil.map((baris) => (
                <TableRow key={idBaris(baris)} className={classBaris?.(baris)}>
                  {kolom.map((k) => (
                    <TableCell key={k.kunci} className={k.className}>
                      {k.render(baris)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableWrap>

      {tampilkanKaki && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Menampilkan {kaki.dari}–{kaki.sampai} dari {kaki.total}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={kaki.halaman <= 1} onClick={() => kaki.ke(kaki.halaman - 1)}>
              Sebelumnya
            </Button>
            <span className={cn('num text-muted-foreground')}>
              {kaki.halaman} / {kaki.totalHalaman}
            </span>
            <Button
              size="sm"
              disabled={kaki.halaman >= kaki.totalHalaman}
              onClick={() => kaki.ke(kaki.halaman + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
