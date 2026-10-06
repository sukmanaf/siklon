'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PeringatanGagal } from '@/components/peringatan-gagal';
import { useDaftarKelas } from '@/hooks/use-kelas';
import { useFilterUrl } from '@/hooks/use-filter-url';
import { unduhan, useBulananKelas } from '@/hooks/use-laporan';
import { pesanError } from '@/lib/api';
import { bulanIni, geserBulan, labelBulan } from '@/lib/tanggal';
import { LegendaMatriks, MatriksBulanan } from './matriks';

/*
 * Halaman ini dulu punya dua tab: matriks per kelas dan rekap per siswa.
 * Tab "Per Siswa" dibuang atas permintaan pemilik proyek (13 September 2026);
 * rekap satu siswa sekarang diambil lewat tombol cetak/Excel di kolom pertama
 * matriks, tepat di baris siswanya.
 *
 * Tampilan kalender yang dulu ada di tab itu tidak hilang dari aplikasi — ia
 * sudah ada di halaman detail siswa (`/siswa/[id]`), lengkap dengan riwayat
 * presensi dan penggeser bulan. Tab itu memang duplikatnya.
 */
export function IsiLaporanBulanan() {
  const [filter, setFilter] = useFilterUrl({ bulan: bulanIni(), kelas: '' });
  const kelas = useDaftarKelas();

  // Kelas pertama dipilih otomatis supaya halaman tidak terbuka kosong.
  useEffect(() => {
    if (!filter.kelas && kelas.data?.[0]) setFilter({ kelas: kelas.data[0].id }, { ganti: true });
  }, [filter.kelas, kelas.data, setFilter]);

  const matriks = useBulananKelas(filter.bulan, filter.kelas || undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon-sm"
          aria-label="Bulan sebelumnya"
          onClick={() => setFilter({ bulan: geserBulan(filter.bulan, -1) })}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-36 text-center text-sm font-semibold">
          {labelBulan(filter.bulan)}
        </span>
        <Button
          size="icon-sm"
          aria-label="Bulan berikutnya"
          onClick={() => setFilter({ bulan: geserBulan(filter.bulan, 1) })}
        >
          <ChevronRightIcon />
        </Button>
        <Button size="sm" onClick={() => setFilter({ bulan: bulanIni() })}>
          Bulan ini
        </Button>
      </div>

      {kelas.isError && (
        <PeringatanGagal
          judul="Daftar kelas gagal dimuat, jadi matriks belum bisa ditampilkan."
          error={kelas.error}
          onCobaLagi={() => void kelas.refetch()}
        />
      )}

        <Card>
          <CardHeader>
            <CardTitle>Matriks Kehadiran</CardTitle>
            {matriks.data && (
              <CardHint>
                {matriks.data.kelas.nama} · {matriks.data.baris.length} siswa ·{' '}
                {matriks.data.hariEfektif.length} hari efektif
              </CardHint>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Select value={filter.kelas} onValueChange={(v) => setFilter({ kelas: v })}>
                <SelectTrigger className="w-40" aria-label="Pilih kelas">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {kelas.data?.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filter.kelas && (
                <>
                  <Button size="sm" asChild>
                    <a href={unduhan.bulananKelasExcel(filter.bulan, filter.kelas)} download>
                      <DownloadIcon />
                      Excel
                    </a>
                  </Button>
                  <Button size="sm" asChild>
                    <a
                      href={unduhan.bulananKelasPdf(filter.bulan, filter.kelas)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileTextIcon />
                      Lihat PDF
                    </a>
                  </Button>
                </>
              )}
            </div>
          </CardHeader>

          <CardContentFlush>
            {matriks.isPending ? (
              <Skeleton className="m-4 h-64" />
            ) : matriks.isError ? (
              <EmptyState
                variant="error"
                judul="Matriks tidak bisa dimuat"
                deskripsi={pesanError(matriks.error)}
                aksi={
                  <Button variant="default" onClick={() => void matriks.refetch()}>
                    Coba lagi
                  </Button>
                }
              />
            ) : matriks.data.baris.length === 0 ? (
              <EmptyState
                judul="Kelas ini belum punya siswa"
                deskripsi="Tambahkan siswanya lebih dulu di halaman Siswa."
                aksi={
                  <Button size="sm" asChild>
                    <Link href="/siswa">Buka halaman Siswa</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <MatriksBulanan data={matriks.data} bulan={filter.bulan} />
                <LegendaMatriks legenda={matriks.data.legenda} />
              </>
            )}
          </CardContentFlush>
        </Card>
    </div>
  );
}
