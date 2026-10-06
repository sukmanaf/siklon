'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  EllipsisVerticalIcon,
  FileSpreadsheetIcon,
  SearchIcon,
  Trash2Icon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { formatNomor } from '@siklon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import { useDaftarKelas } from '@/hooks/use-kelas';
import { useDebounce } from '@/hooks/use-debounce';
import { useFilterUrl } from '@/hooks/use-filter-url';
import {
  useDaftarSiswa,
  useHapusSiswa,
  useNonaktifkanSiswa,
  useRingkasanSiswa,
  useUbahSiswa,
} from '@/hooks/use-siswa';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { Siswa } from '@/lib/tipe';
import { DialogSiswa } from './dialog-siswa';

const SEMUA = '__semua__';
const PER_HALAMAN = 10;

/** Nilai bawaan filter; yang sama dengan ini tidak ditulis ke URL. */
const BAWAAN = { cari: '', kelas: SEMUA, status: 'aktif', tanpaWali: '', hal: '1' };

type Aksi = { tipe: 'nonaktifkan' | 'aktifkan' | 'hapus'; siswa: Siswa };

export function DaftarSiswa() {
  const [filter, setFilter] = useFilterUrl(BAWAAN);
  const kelas = useDaftarKelas();
  const ringkasan = useRingkasanSiswa();
  const ubah = useUbahSiswa();
  const nonaktifkan = useNonaktifkanSiswa();
  const hapus = useHapusSiswa();

  const [dialogSiswa, setDialogSiswa] = useState<{ buka: boolean; siswa: Siswa | null }>({
    buka: false,
    siswa: null,
  });
  const [aksi, setAksi] = useState<Aksi | null>(null);

  // --- Pencarian: diketik di state lokal, baru masuk URL setelah berhenti ---
  const [teks, setTeks] = useState(filter.cari);
  const teksTertunda = useDebounce(teks, 350);
  const terakhirDikirim = useRef(filter.cari);

  useEffect(() => {
    if (teksTertunda === terakhirDikirim.current) return;
    terakhirDikirim.current = teksTertunda;
    // Halaman dikembalikan ke 1: hasil pencarian baru tidak punya halaman 3.
    setFilter({ cari: teksTertunda, hal: '1' });
  }, [teksTertunda, setFilter]);

  // Tombol Back mengubah URL dari luar; kotak pencarian harus ikut.
  useEffect(() => {
    if (filter.cari !== terakhirDikirim.current) {
      terakhirDikirim.current = filter.cari;
      setTeks(filter.cari);
    }
  }, [filter.cari]);

  const halaman = Math.max(1, Number(filter.hal) || 1);
  const daftar = useDaftarSiswa({
    cari: filter.cari || undefined,
    kelasId: filter.kelas === SEMUA ? undefined : filter.kelas,
    aktif: filter.status === 'semua' ? undefined : filter.status === 'aktif',
    tanpaWali: filter.tanpaWali === '1' ? true : undefined,
    page: halaman,
    perPage: PER_HALAMAN,
  });

  const kolom: Kolom<Siswa>[] = [
    {
      kunci: 'siswa',
      judul: 'Siswa',
      render: (s) => <IdentitasSiswa nama={s.full_name} nis={s.nis} />,
    },
    {
      kunci: 'kelas',
      judul: 'Kelas',
      render: (s) =>
        s.classes ? (
          <Badge variant="primary">{s.classes.name}</Badge>
        ) : (
          <Badge variant="warn">Belum ada kelas</Badge>
        ),
    },
    {
      // Nomornya yang penting; nama wali hanya sapaan di pesan WhatsApp.
      kunci: 'hp',
      judul: 'No. HP Wali',
      render: (s) =>
        s.guardian_phone ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="num">{formatNomor(s.guardian_phone)}</span>
            {/* notify kini melekat pada siswa, bukan pada wali. */}
            {!s.notify && <Badge variant="muted">notifikasi mati</Badge>}
          </div>
        ) : (
          <Badge variant="danger">Belum ada nomor</Badge>
        ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (s) =>
        s.is_active ? <Badge variant="ok">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>,
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right whitespace-nowrap',
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" asChild>
            <Link href={`/siswa/${s.id}`}>Detail</Link>
          </Button>
          <Button size="sm" onClick={() => setDialogSiswa({ buka: true, siswa: s })}>
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" aria-label={`Aksi lain untuk ${s.full_name}`}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {s.is_active ? (
                <DropdownMenuItem onSelect={() => setAksi({ tipe: 'nonaktifkan', siswa: s })}>
                  <UserRoundXIcon />
                  Nonaktifkan
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setAksi({ tipe: 'aktifkan', siswa: s })}>
                  <UserRoundCheckIcon />
                  Aktifkan kembali
                </DropdownMenuItem>
              )}
              <DropdownMenuItem destructive onSelect={() => setAksi({ tipe: 'hapus', siswa: s })}>
                <Trash2Icon />
                Hapus permanen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const r = ringkasan.data;
  const adaFilter =
    filter.cari !== '' ||
    filter.kelas !== SEMUA ||
    filter.status !== 'aktif' ||
    filter.tanpaWali === '1';

  return (
    <div className="space-y-4">
      {/* Tiga angka ini adalah "lubang" data: siswa yang diam-diam tidak terpantau. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuAngka label="Siswa aktif" nilai={r?.aktif} warna="text-foreground" />
        <KartuAngka
          label="Belum ada kelas"
          nilai={r?.tanpaKelas}
          warna="text-terlambat"
          onKlik={() => setFilter({ status: 'aktif', kelas: SEMUA, hal: '1' })}
        />
        <KartuAngka
          label="Belum ada nomor HP"
          nilai={r?.tanpaWali}
          warna="text-alpa"
          onKlik={() => setFilter({ tanpaWali: '1', hal: '1' })}
        />
        <KartuAngka label="Notifikasi dimatikan" nilai={r?.notifikasiMati} warna="text-izin" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="Cari nama atau NIS…"
              className="pl-8"
              aria-label="Cari siswa"
            />
          </div>

          <Select value={filter.kelas} onValueChange={(v) => setFilter({ kelas: v, hal: '1' })}>
            <SelectTrigger className="w-40" aria-label="Filter kelas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kelas</SelectItem>
              {kelas.data?.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter.status} onValueChange={(v) => setFilter({ status: v, hal: '1' })}>
            <SelectTrigger className="w-36" aria-label="Filter status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="nonaktif">Nonaktif</SelectItem>
              <SelectItem value="semua">Semua status</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className={filter.tanpaWali === '1' ? 'border-primary text-primary' : undefined}
            aria-pressed={filter.tanpaWali === '1'}
            onClick={() =>
              setFilter({ tanpaWali: filter.tanpaWali === '1' ? '' : '1', hal: '1' })
            }
          >
            Tanpa nomor HP
          </Button>

          {adaFilter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTeks('');
                setFilter({ cari: '', kelas: SEMUA, status: 'aktif', tanpaWali: '', hal: '1' });
              }}
            >
              Reset
            </Button>
          )}

          <div className="ml-auto flex gap-2">
            <Button size="sm" asChild>
              <Link href="/siswa/import">
                <FileSpreadsheetIcon />
                Import Excel
              </Link>
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setDialogSiswa({ buka: true, siswa: null })}
            >
              + Tambah Siswa
            </Button>
          </div>
        </div>

        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={daftar.data?.items}
            idBaris={(s) => s.id}
            memuat={daftar.isPending}
            error={daftar.error}
            onCobaLagi={() => void daftar.refetch()}
            classBaris={(s) => (s.is_active ? undefined : 'opacity-60')}
            paginasiServer={{
              halaman,
              perPage: PER_HALAMAN,
              total: daftar.data?.total ?? 0,
              totalHalaman: daftar.data?.totalPage ?? 1,
              onHalaman: (h) => setFilter({ hal: String(h) }),
            }}
            kosong={
              <EmptyState
                ikon={<UsersRoundIcon />}
                judul={adaFilter ? 'Tidak ada siswa yang cocok' : 'Belum ada siswa'}
                deskripsi={
                  adaFilter
                    ? 'Coba longgarkan filternya, atau kosongkan kotak pencarian.'
                    : 'Tambahkan satu per satu, atau impor sekaligus dari berkas Excel.'
                }
                aksi={
                  adaFilter ? undefined : (
                    <Button size="sm" asChild>
                      <Link href="/siswa/import">Import dari Excel</Link>
                    </Button>
                  )
                }
              />
            }
          />
        </CardContentFlush>
      </Card>

      <DialogSiswa
        buka={dialogSiswa.buka}
        siswa={dialogSiswa.siswa}
        onTutup={() => setDialogSiswa({ buka: false, siswa: null })}
      />

      <ConfirmDialog
        open={aksi?.tipe === 'nonaktifkan'}
        onOpenChange={(o) => !o && setAksi(null)}
        judul={`Nonaktifkan ${aksi?.siswa.full_name}?`}
        deskripsi="Dipakai untuk siswa yang lulus atau pindah. Riwayat presensinya tetap tersimpan sehingga laporan bulan-bulan lalu tidak berubah, tapi kartunya tidak bisa dipakai absen lagi."
        labelKonfirmasi="Nonaktifkan"
        berbahaya
        memuat={nonaktifkan.isPending}
        onKonfirmasi={() =>
          aksi &&
          nonaktifkan.mutate(aksi.siswa.id, {
            onSuccess: () => {
              toastSukses(`${aksi.siswa.full_name} dinonaktifkan`);
              setAksi(null);
            },
            onError: (e) => toastGagal(e, 'Gagal menonaktifkan siswa'),
          })
        }
      />

      <ConfirmDialog
        open={aksi?.tipe === 'aktifkan'}
        onOpenChange={(o) => !o && setAksi(null)}
        judul={`Aktifkan kembali ${aksi?.siswa.full_name}?`}
        deskripsi="Kartunya bisa dipakai absen lagi mulai hari ini."
        labelKonfirmasi="Aktifkan"
        memuat={ubah.isPending}
        onKonfirmasi={() =>
          aksi &&
          ubah.mutate(
            { id: aksi.siswa.id, is_active: true },
            {
              onSuccess: () => {
                toastSukses(`${aksi.siswa.full_name} diaktifkan kembali`);
                setAksi(null);
              },
              onError: (e) => toastGagal(e, 'Gagal mengaktifkan siswa'),
            },
          )
        }
      />

      <ConfirmDialog
        open={aksi?.tipe === 'hapus'}
        onOpenChange={(o) => !o && setAksi(null)}
        judul={`Hapus ${aksi?.siswa.full_name} permanen?`}
        deskripsi="Hanya bisa untuk siswa yang belum pernah tercatat presensi. Kalau sudah punya riwayat, server akan menolak dan menyarankan menonaktifkan saja."
        labelKonfirmasi="Hapus permanen"
        berbahaya
        memuat={hapus.isPending}
        onKonfirmasi={() =>
          aksi &&
          hapus.mutate(aksi.siswa.id, {
            onSuccess: () => {
              toastSukses(`${aksi.siswa.full_name} dihapus`);
              setAksi(null);
            },
            onError: (e) => toastGagal(e, 'Siswa tidak bisa dihapus'),
          })
        }
      />
    </div>
  );
}

function KartuAngka({
  label,
  nilai,
  warna,
  onKlik,
}: {
  label: string;
  nilai: number | undefined;
  warna: string;
  onKlik?: () => void;
}) {
  const isi = (
    <>
      <div className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${warna}`}>{nilai ?? '—'}</div>
    </>
  );

  if (!onKlik) {
    return <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">{isi}</div>;
  }
  return (
    <button
      type="button"
      onClick={onKlik}
      className="rounded-lg border border-border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-primary"
    >
      {isi}
    </button>
  );
}
