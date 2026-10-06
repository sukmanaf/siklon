'use client';

import { useState } from 'react';
import { CalendarRangeIcon, CheckIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import {
  useAktifkanTahunAjaran,
  useBuatTahunAjaran,
  useDaftarTahunAjaran,
  useHapusTahunAjaran,
} from '@/hooks/use-akademik';
import { tanggalPendek } from '@/lib/tanggal';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { TahunAjaran } from '@/lib/tipe';

export function TabTahun() {
  const daftar = useDaftarTahunAjaran();
  const buat = useBuatTahunAjaran();
  const aktifkan = useAktifkanTahunAjaran();
  const hapus = useHapusTahunAjaran();

  const [nama, setNama] = useState('');
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [akanAktifkan, setAkanAktifkan] = useState<TahunAjaran | null>(null);

  const namaValid = /^\d{4}\/\d{4}$/.test(nama);
  const tanggalValid = Boolean(mulai && selesai && selesai > mulai);

  const kolom: Kolom<TahunAjaran>[] = [
    {
      kunci: 'nama',
      judul: 'Tahun Ajaran',
      nilaiSortir: (t) => t.name,
      render: (t) => <span className="num font-semibold">{t.name}</span>,
    },
    {
      kunci: 'periode',
      judul: 'Periode',
      render: (t) => (
        <span className="num text-muted-foreground">
          {tanggalPendek(t.start_date.slice(0, 10))} – {tanggalPendek(t.end_date.slice(0, 10))}
        </span>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (t) =>
        t.is_active ? <Badge variant="ok">Aktif</Badge> : <Badge variant="muted">Arsip</Badge>,
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right whitespace-nowrap',
      render: (t) => (
        <div className="flex justify-end gap-1.5">
          {!t.is_active && (
            <Button size="sm" onClick={() => setAkanAktifkan(t)}>
              <CheckIcon />
              Aktifkan
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="destructive-outline"
            aria-label={`Hapus tahun ajaran ${t.name}`}
            disabled={t.is_active}
            title={t.is_active ? 'Tahun ajaran aktif tidak bisa dihapus' : undefined}
            onClick={() =>
              hapus.mutate(t.id, {
                onSuccess: () => toastSukses(`Tahun ajaran ${t.name} dihapus`),
                onError: (e) => toastGagal(e, 'Tahun ajaran tidak bisa dihapus'),
              })
            }
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tahun Ajaran</CardTitle>
          <CardHint>hanya satu yang boleh aktif</CardHint>
        </CardHeader>
        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={daftar.data}
            idBaris={(t) => String(t.id)}
            memuat={daftar.isPending}
            error={daftar.error}
            onCobaLagi={() => void daftar.refetch()}
            sortirAwal={{ kunci: 'nama', arah: 'turun' }}
            perHalaman={0}
            classBaris={(t) => (t.is_active ? undefined : 'opacity-70')}
            kosong={
              <EmptyState
                ikon={<CalendarRangeIcon />}
                judul="Belum ada tahun ajaran"
                deskripsi="Kelas selalu melekat pada satu tahun ajaran, jadi ini harus dibuat lebih dulu."
              />
            }
          />
        </CardContentFlush>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Tambah Tahun Ajaran</CardTitle>
        </CardHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="nama-tahun">Nama</Label>
            <Input
              id="nama-tahun"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="2026/2027"
              className="num"
              aria-invalid={nama !== '' && !namaValid}
            />
            {nama !== '' && !namaValid && (
              <p className="text-[11.5px] font-medium text-destructive">
                Format harus seperti 2026/2027.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mulai-tahun">Mulai</Label>
              <Input
                id="mulai-tahun"
                type="date"
                value={mulai}
                onChange={(e) => setMulai(e.target.value)}
                className="num"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selesai-tahun">Selesai</Label>
              <Input
                id="selesai-tahun"
                type="date"
                value={selesai}
                onChange={(e) => setSelesai(e.target.value)}
                className="num"
                aria-invalid={Boolean(mulai && selesai) && !tanggalValid}
              />
            </div>
          </div>

          <Button
            variant="default"
            className="w-full"
            disabled={!namaValid || !tanggalValid || buat.isPending}
            onClick={() =>
              buat.mutate(
                { name: nama, start_date: mulai, end_date: selesai },
                {
                  onSuccess: () => {
                    toastSukses(`Tahun ajaran ${nama} dibuat`, 'Belum aktif — aktifkan bila sudah waktunya.');
                    setNama('');
                    setMulai('');
                    setSelesai('');
                  },
                  onError: (e) => toastGagal(e, 'Tahun ajaran gagal dibuat'),
                },
              )
            }
          >
            {buat.isPending && <Loader2Icon className="animate-spin" />}
            Tambah
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(akanAktifkan)}
        onOpenChange={(o) => !o && setAkanAktifkan(null)}
        judul={`Aktifkan tahun ajaran ${akanAktifkan?.name}?`}
        deskripsi="Tahun ajaran yang sekarang aktif otomatis dinonaktifkan. Halaman Kelas dan daftar kelas di seluruh aplikasi akan menampilkan kelas milik tahun ajaran baru ini."
        labelKonfirmasi="Aktifkan"
        memuat={aktifkan.isPending}
        onKonfirmasi={() =>
          akanAktifkan &&
          aktifkan.mutate(akanAktifkan.id, {
            onSuccess: () => {
              toastSukses(`Tahun ajaran ${akanAktifkan.name} sekarang aktif`);
              setAkanAktifkan(null);
            },
            onError: (e) => toastGagal(e, 'Gagal mengaktifkan tahun ajaran'),
          })
        }
      />
    </div>
  );
}
