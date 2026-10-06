'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DownloadIcon, FileTextIcon, PaperclipIcon, PencilIcon, UsersRoundIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import { StatusBadge } from '@/components/status-badge';
import { useDaftarKelas } from '@/hooks/use-kelas';
import { useFilterUrl } from '@/hooks/use-filter-url';
import { usePresensiHarian, type BarisHarian } from '@/hooks/use-presensi';
import { unduhan, useRekapHarian, type RekapKelas } from '@/hooks/use-laporan';
import { hariIni } from '@/lib/tanggal';
import { cn } from '@/lib/utils';
import { DialogUbahStatus } from './dialog-ubah-status';

const SEMUA = '__semua__';

export function IsiLaporanHarian() {
  const [filter, setFilter] = useFilterUrl({ tanggal: hariIni(), kelas: SEMUA });
  const kelas = useDaftarKelas();
  const [ubah, setUbah] = useState<BarisHarian | null>(null);

  const kelasId = filter.kelas === SEMUA ? undefined : filter.kelas;
  const harian = usePresensiHarian(filter.tanggal, kelasId);
  const rekap = useRekapHarian(filter.tanggal);

  const r = harian.data?.ringkasan;

  const namaKelasTerpilih = kelas.data?.find((k) => k.id === kelasId)?.name ?? null;

  const kolomSiswa: Kolom<BarisHarian>[] = [
    {
      kunci: 'siswa',
      judul: 'Siswa',
      nilaiSortir: (b) => b.nama,
      render: (b) => <IdentitasSiswa nama={b.nama} nis={b.nis} kelas={null} />,
    },
    {
      kunci: 'status',
      judul: 'Status',
      nilaiSortir: (b) => b.status,
      render: (b) =>
        b.status === 'BELUM' ? (
          <Badge variant="muted">Belum tercatat</Badge>
        ) : (
          <StatusBadge
            status={b.status}
            keterangan={b.terlambatMenit > 0 ? `${b.terlambatMenit} mnt` : undefined}
          />
        ),
    },
    {
      kunci: 'jam',
      judul: 'Jam Masuk',
      nilaiSortir: (b) => b.jamMasuk,
      render: (b) => <span className="num">{b.jamMasuk ?? '—'}</span>,
    },
    {
      kunci: 'pulang',
      judul: 'Jam Pulang',
      nilaiSortir: (b) => b.jamPulang,
      render: (b) => <span className="num">{b.jamPulang ?? '—'}</span>,
    },
    {
      kunci: 'titik',
      judul: 'Titik Scan',
      render: (b) => <span className="num text-muted-foreground">{b.titikScan ?? '—'}</span>,
    },
    {
      kunci: 'catatan',
      judul: 'Catatan',
      render: (b) => (
        <div className="min-w-0">
          <span className="flex items-center gap-1 truncate text-[12.5px] text-muted-foreground">
            {b.punyaLampiran && (
              <PaperclipIcon className="size-3.5 shrink-0" aria-label="Ada lampiran" />
            )}
            <span className="truncate">{b.catatan ?? '—'}</span>
          </span>
          {b.diubahManual && <Badge variant="warn">diubah manual</Badge>}
        </div>
      ),
    },
    {
      kunci: 'notif',
      judul: 'Notifikasi',
      render: (b) =>
        b.notifikasiAktif ? (
          <Badge variant="ok">aktif</Badge>
        ) : (
          <Badge variant="danger">mati</Badge>
        ),
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right',
      render: (b) => (
        <Button size="sm" onClick={() => setUbah(b)}>
          <PencilIcon />
          Ubah
        </Button>
      ),
    },
  ];

  const kolomRekap: Kolom<RekapKelas>[] = [
    {
      kunci: 'kelas',
      judul: 'Kelas',
      nilaiSortir: (k) => k.kelas,
      render: (k) => (
        <button
          type="button"
          onClick={() => setFilter({ kelas: k.kelas_id })}
          className="text-left"
        >
          <div className="font-semibold text-primary hover:underline">{k.kelas}</div>
        </button>
      ),
    },
    { kunci: 'total', judul: 'Siswa', nilaiSortir: (k) => k.total, render: (k) => <span className="num">{k.total}</span> },
    { kunci: 'hadir', judul: 'Hadir', nilaiSortir: (k) => k.hadir, render: (k) => <span className="num text-hadir">{k.hadir}</span> },
    { kunci: 'terlambat', judul: 'Terlambat', nilaiSortir: (k) => k.terlambat, render: (k) => <span className="num text-terlambat">{k.terlambat}</span> },
    { kunci: 'izin', judul: 'Izin', nilaiSortir: (k) => k.izin, render: (k) => <span className="num text-izin">{k.izin}</span> },
    { kunci: 'sakit', judul: 'Sakit', nilaiSortir: (k) => k.sakit, render: (k) => <span className="num text-sakit">{k.sakit}</span> },
    { kunci: 'alpa', judul: 'Alpa', nilaiSortir: (k) => k.alpa, render: (k) => <span className="num text-alpa">{k.alpa}</span> },
    { kunci: 'belum', judul: 'Belum', nilaiSortir: (k) => k.belum, render: (k) => <span className="num text-faint">{k.belum}</span> },
    {
      kunci: 'persen',
      judul: '% Hadir',
      nilaiSortir: (k) => k.persen_hadir,
      render: (k) => (
        <span className={cn('num font-bold', (k.persen_hadir ?? 100) < 85 && 'text-alpa')}>
          {k.persen_hadir === null ? '—' : `${k.persen_hadir}%`}
        </span>
      ),
    },
  ];

  const t = rekap.data?.totalSekolah;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={filter.tanggal}
          onChange={(e) => setFilter({ tanggal: e.target.value })}
          className="num w-40"
          aria-label="Tanggal laporan"
        />
        <Button size="sm" onClick={() => setFilter({ tanggal: hariIni() })}>
          Hari ini
        </Button>

        <Select value={filter.kelas} onValueChange={(v) => setFilter({ kelas: v })}>
          <SelectTrigger className="w-44" aria-label="Filter kelas">
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

        {r && (
          <span className="text-[12.5px] text-muted-foreground">
            <b className="num text-hadir">{r.hadir}</b> hadir ·{' '}
            <b className="num text-terlambat">{r.terlambat}</b> terlambat ·{' '}
            <b className="num text-alpa">{r.alpa}</b> alpa ·{' '}
            <b className="num text-faint">{r.belum}</b> belum
          </span>
        )}

        <div className="ml-auto flex gap-2">
          {/* Excel diunduh — browser tidak bisa menampilkannya. */}
          <Button size="sm" asChild>
            <a href={unduhan.harianExcel(filter.tanggal, kelasId)} download>
              <DownloadIcon />
              Excel
            </a>
          </Button>
          {/*
            PDF DIBUKA di tab baru, bukan diunduh. Yang dicari orang hampir
            selalu "lihat dulu hasil cetaknya", bukan menimbun berkas di folder
            Unduhan; kalau memang mau disimpan, tombol unduh penampil PDF
            bawaan browser sudah ada di situ. Servernya mengirim
            Content-Disposition: inline supaya browser menampilkan, bukan
            mengunduh.
          */}
          <Button size="sm" asChild>
            <a
              href={unduhan.harianPdf(filter.tanggal, kelasId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileTextIcon />
              Lihat PDF
            </a>
          </Button>
        </div>
      </div>

      {/*
        SATU tabel saja: data per KELAS (permintaan pemilik proyek, 13
        September 2026). Daftar siswa seluruh sekolah tidak ditampilkan di
        sini — detail per siswa ada di cetakannya, yang memang sudah dipecah
        satu kelas per halaman.

        Daftar siswa hanya muncul saat SATU kelas dipilih. Itu bukan pengecualian
        yang dibuat-buat: mengoreksi status presensi (izin/sakit, dengan alasan
        wajib) hanya bisa dilakukan dari baris siswa, dan layar ini satu-satunya
        tempatnya di seluruh aplikasi. Tanpa jalan masuk ini, koreksi status
        jadi mustahil dikerjakan.
      */}
      {!kelasId ? (
        <Card>
          <CardHeader>
            <CardTitle>Rekap Semua Kelas</CardTitle>
            <CardHint>klik nama kelas untuk membuka daftar siswanya</CardHint>
          </CardHeader>
          <CardContentFlush>
            <DataTable
              kolom={kolomRekap}
              data={rekap.data?.kelas}
              idBaris={(k) => k.kelas_id}
              memuat={rekap.isPending}
              error={rekap.error}
              onCobaLagi={() => void rekap.refetch()}
              perHalaman={0}
              sortirAwal={{ kunci: 'kelas', arah: 'naik' }}
              kosong={
                <EmptyState
                  judul="Belum ada kelas aktif"
                  deskripsi="Buat kelas dulu di halaman Kelas."
                  aksi={
                    <Button size="sm" asChild>
                      <Link href="/kelas">Buka halaman Kelas</Link>
                    </Button>
                  }
                />
              }
            />

            {/* Baris total sekolah dipisah dari tabel supaya tidak ikut tersortir. */}
            {t && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-border bg-surface-2 px-3 py-3 text-[13px]">
                <b className="font-bold">TOTAL SEKOLAH</b>
                <span className="num">{t.total} siswa</span>
                <span className="num text-hadir">{t.hadir} hadir</span>
                <span className="num text-terlambat">{t.terlambat} terlambat</span>
                <span className="num text-izin">{t.izin} izin</span>
                <span className="num text-sakit">{t.sakit} sakit</span>
                <span className="num text-alpa">{t.alpa} alpa</span>
                <span className="num text-faint">{t.belum} belum</span>
                <span className="num ml-auto text-base font-bold">
                  {t.persenHadir === null ? '—' : `${t.persenHadir}%`} hadir
                </span>
              </div>
            )}
          </CardContentFlush>
        </Card>
      ) : (
        <Card data-uji="daftar-siswa-kelas">
          <CardHeader>
            <CardTitle>{namaKelasTerpilih ?? 'Kelas'}</CardTitle>
            {r && (
              <CardHint>
                {r.total} siswa · {r.hadir} hadir · {r.terlambat} terlambat · {r.alpa} alpa
              </CardHint>
            )}
            <Button size="sm" className="ml-auto" onClick={() => setFilter({ kelas: SEMUA })}>
              Kembali ke semua kelas
            </Button>
          </CardHeader>
          <CardContentFlush>
            <DataTable
              kolom={kolomSiswa}
              data={harian.data?.baris}
              idBaris={(b) => b.siswaId}
              memuat={harian.isPending}
              error={harian.error}
              onCobaLagi={() => void harian.refetch()}
              perHalaman={0}
              sortirAwal={{ kunci: 'siswa', arah: 'naik' }}
              classBaris={(b) => (b.status === 'BELUM' ? 'bg-terlambat-bg/40' : undefined)}
              kosong={
                <EmptyState
                  ikon={<UsersRoundIcon />}
                  judul="Tidak ada siswa"
                  deskripsi="Pastikan siswanya sudah terdaftar dan aktif di kelas ini."
                />
              }
            />
          </CardContentFlush>
        </Card>
      )}

      <DialogUbahStatus baris={ubah} tanggal={filter.tanggal} onTutup={() => setUbah(null)} />
    </div>
  );
}
