'use client';

import { useState } from 'react';
import { CalendarPlusIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { useDaftarLibur, useHapusLibur, useTambahLibur } from '@/hooks/use-akademik';
import { NAMA_HARI_PENDEK, tanggalPendek } from '@/lib/tanggal';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { Libur } from '@/lib/tipe';

/** Tanggal dari API bisa berupa ISO penuh; ambil bagian YYYY-MM-DD saja. */
const kunciTanggal = (l: Libur) => l.holiday_date.slice(0, 10);

export function TabLibur() {
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(tahunIni);
  const daftar = useDaftarLibur(tahun);
  const tambah = useTambahLibur();
  const hapus = useHapusLibur();

  const [tanggal, setTanggal] = useState('');
  const [nama, setNama] = useState('');

  const kolom: Kolom<Libur>[] = [
    {
      kunci: 'tanggal',
      judul: 'Tanggal',
      nilaiSortir: kunciTanggal,
      render: (l) => {
        const t = kunciTanggal(l);
        const hari = NAMA_HARI_PENDEK[new Date(`${t}T00:00:00Z`).getUTCDay()];
        return (
          <span className="num">
            {tanggalPendek(t)} <span className="text-muted-foreground">· {hari}</span>
          </span>
        );
      },
    },
    { kunci: 'nama', judul: 'Keterangan', nilaiSortir: (l) => l.name, render: (l) => l.name },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right',
      render: (l) => (
        <Button
          size="icon-sm"
          variant="destructive-outline"
          aria-label={`Hapus hari libur ${l.name}`}
          onClick={() =>
            hapus.mutate(kunciTanggal(l), {
              onSuccess: () => toastSukses(`${l.name} dihapus dari daftar libur`),
              onError: (e) => toastGagal(e, 'Gagal menghapus hari libur'),
            })
          }
        >
          <Trash2Icon />
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Hari Libur</CardTitle>
          <CardHint>scan pada tanggal ini ditolak dan tidak dihitung alpa</CardHint>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => setTahun((t) => t - 1)} aria-label="Tahun sebelumnya">
              ‹
            </Button>
            <span className="num text-sm font-semibold">{tahun}</span>
            <Button size="sm" onClick={() => setTahun((t) => t + 1)} aria-label="Tahun berikutnya">
              ›
            </Button>
          </div>
        </CardHeader>
        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={daftar.data}
            idBaris={kunciTanggal}
            memuat={daftar.isPending}
            error={daftar.error}
            onCobaLagi={() => void daftar.refetch()}
            sortirAwal={{ kunci: 'tanggal', arah: 'naik' }}
            perHalaman={0}
            kosong={
              <EmptyState
                ikon={<CalendarPlusIcon />}
                judul={`Belum ada hari libur di ${tahun}`}
                deskripsi="Tambahkan libur nasional dan libur sekolah supaya siswa tidak tercatat alpa pada hari yang memang diliburkan."
              />
            }
          />
        </CardContentFlush>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Tambah Hari Libur</CardTitle>
        </CardHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="tgl-libur">Tanggal</Label>
            <Input
              id="tgl-libur"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="num"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nama-libur">Keterangan</Label>
            <Input
              id="nama-libur"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="mis. Hari Raya Idul Fitri"
              maxLength={120}
            />
          </div>

          <Button
            variant="default"
            className="w-full"
            disabled={!tanggal || !nama.trim() || tambah.isPending}
            onClick={() =>
              tambah.mutate(
                { holiday_date: tanggal, name: nama.trim() },
                {
                  onSuccess: () => {
                    toastSukses(`${nama.trim()} ditambahkan`);
                    setTahun(Number(tanggal.slice(0, 4)));
                    setTanggal('');
                    setNama('');
                  },
                  onError: (e) => toastGagal(e, 'Hari libur gagal ditambahkan'),
                },
              )
            }
          >
            {tambah.isPending && <Loader2Icon className="animate-spin" />}
            Tambah
          </Button>

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Satu tanggal hanya boleh punya satu keterangan. Akhir pekan tidak perlu dimasukkan —
            itu sudah diatur lewat <b>hari sekolah</b> di tab Jadwal.
          </p>
        </div>
      </Card>
    </div>
  );
}
