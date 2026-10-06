'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CopyIcon, GraduationCapIcon, LayoutGridIcon, Loader2Icon, Trash2Icon, SearchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { useBuatKelas, useDaftarKelas, useHapusKelas, useUbahKelas } from '@/hooks/use-kelas';
import { useDebounce } from '@/hooks/use-debounce';
import { useTahunAjaranAktif } from '@/hooks/use-akademik';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { Kelas } from '@/lib/tipe';
import { DialogNaikKelas } from './dialog-naik-kelas';
import { DialogSalinKelas } from './dialog-salin-kelas';

const skema = z.object({
  name: z.string().trim().min(1, 'Nama kelas wajib diisi').max(30),
  grade_level: z
    .string()
    .refine((v) => v === '' || (Number(v) >= 1 && Number(v) <= 12), 'Tingkat antara 1 dan 12'),
});
type Nilai = z.infer<typeof skema>;

export default function HalamanKelas() {
  const tahun = useTahunAjaranAktif();
  const daftar = useDaftarKelas();
  const buat = useBuatKelas();
  const ubah = useUbahKelas();
  const hapus = useHapusKelas();

  const [dialog, setDialog] = useState<{ buka: boolean; kelas: Kelas | null }>({
    buka: false,
    kelas: null,
  });
  const [teks, setTeks] = useState('');
  const pencarian = useDebounce(teks, 400);
  const [perHalaman, setPerHalaman] = useState(10);
  const [naikBuka, setNaikBuka] = useState(false);
  const [salinBuka, setSalinBuka] = useState(false);
  const [akanHapus, setAkanHapus] = useState<Kelas | null>(null);

  const { control, handleSubmit, reset } = useForm<Nilai>({
    resolver: zodResolver(skema),
    defaultValues: { name: '', grade_level: '' },
  });

  useEffect(() => {
    if (!dialog.buka) return;
    reset({
      name: dialog.kelas?.name ?? '',
      grade_level: dialog.kelas?.grade_level ? String(dialog.kelas.grade_level) : '',
    });
  }, [dialog, reset]);

  function simpan(nilai: Nilai) {
    const data = {
      name: nilai.name,
      ...(nilai.grade_level ? { grade_level: Number(nilai.grade_level) } : {}),
    };
    const opsi = {
      onSuccess: () => {
        toastSukses(dialog.kelas ? 'Kelas diperbarui' : `Kelas ${nilai.name} dibuat`);
        setDialog({ buka: false, kelas: null });
      },
      onError: (e: unknown) => toastGagal(e, 'Kelas gagal disimpan'),
    };
    if (dialog.kelas) ubah.mutate({ id: dialog.kelas.id, ...data }, opsi);
    else buat.mutate(data, opsi);
  }

  const kolom: Kolom<Kelas>[] = [
    {
      kunci: 'nama',
      judul: 'Kelas',
      nilaiSortir: (k) => k.name,
      render: (k) => (
        <div>
          <div className="font-semibold">{k.name}</div>
          {k.grade_level != null && (
            <div className="text-xs text-muted-foreground">Tingkat {k.grade_level}</div>
          )}
        </div>
      ),
    },
    {
      kunci: 'jumlah',
      judul: 'Jumlah Siswa',
      nilaiSortir: (k) => k._count.students,
      render: (k) => (
        <Link
          href={`/siswa?kelas=${k.id}`}
          className="num font-semibold text-primary hover:underline"
        >
          {k._count.students}
        </Link>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (k) =>
        k.is_active ? <Badge variant="ok">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>,
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right whitespace-nowrap',
      render: (k) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => setDialog({ buka: true, kelas: k })}>
            Edit
          </Button>
          <Button
            size="sm"
            onClick={() =>
              ubah.mutate(
                { id: k.id, is_active: !k.is_active },
                {
                  onSuccess: () =>
                    toastSukses(k.is_active ? `${k.name} dinonaktifkan` : `${k.name} diaktifkan`),
                  onError: (e) => toastGagal(e, 'Gagal mengubah status kelas'),
                },
              )
            }
          >
            {k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button
            size="icon-sm"
            variant="destructive-outline"
            aria-label={`Hapus kelas ${k.name}`}
            onClick={() => setAkanHapus(k)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];

  const sedangSimpan = buat.isPending || ubah.isPending;

    const dataKelas = daftar.data?.filter(k => !pencarian || k.name.toLowerCase().includes(pencarian.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kelas</CardTitle>
          <CardHint>
            {tahun.data ? `Tahun ajaran ${tahun.data.name}` : 'Memuat tahun ajaran…'}
            {daftar.data ? ` · ${daftar.data.length} kelas` : ''}
          </CardHint>
          {/*
            flex-wrap: tiga tombol di sini total ±400px, lebih lebar dari layar
            HP 390px. Tanpa ini barisnya menonjol keluar kartu dan seluruh
            halaman jadi bisa digeser mendatar.
          */}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setSalinBuka(true)} disabled={!daftar.data?.length}>
              <CopyIcon />
              Salin ke Tahun Lain
            </Button>
            <Button size="sm" onClick={() => setNaikBuka(true)} disabled={!daftar.data?.length}>
              <GraduationCapIcon />
              Kenaikan Kelas
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setDialog({ buka: true, kelas: null })}
            >
              + Tambah Kelas
            </Button>
          </div>
        </CardHeader>

        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={dataKelas}
            idBaris={(k) => k.id}
            memuat={daftar.isPending}
            error={daftar.error}
            onCobaLagi={() => void daftar.refetch()}
            sortirAwal={{ kunci: 'nama', arah: 'naik' }}
            perHalaman={perHalaman}
            classBaris={(k) => (k.is_active ? undefined : 'opacity-60')}
            kosong={
              <EmptyState
                ikon={<LayoutGridIcon />}
                judul="Belum ada kelas"
                deskripsi="Kelas harus dibuat lebih dulu sebelum siswa bisa diimpor dari Excel — import menolak nama kelas yang belum terdaftar."
                aksi={
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setDialog({ buka: true, kelas: null })}
                  >
                    Tambah kelas pertama
                  </Button>
                }
              />
            }
          />
        </CardContentFlush>
      </Card>

      <Dialog
        open={dialog.buka}
        onOpenChange={(o) => !o && setDialog({ buka: false, kelas: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.kelas ? 'Ubah kelas' : 'Tambah kelas'}</DialogTitle>
            <DialogDescription>
              Nama kelas harus unik dalam satu tahun ajaran, dan harus sama persis dengan yang
              ditulis di berkas Excel saat import.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(simpan)} noValidate className="space-y-4">
            <FormField control={control} name="name" label="Nama kelas" wajib>
              {({ id, field, invalid, ...a }) => (
                <Input id={id} autoFocus placeholder="mis. VII-A" aria-invalid={invalid} {...a} {...field} />
              )}
            </FormField>

            <FormField
              control={control}
              name="grade_level"
              label="Tingkat"
              deskripsi="Angka 1–12. Dipakai menebak kelas tujuan saat kenaikan kelas."
            >
              {({ id, field, invalid, ...a }) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={12}
                  placeholder="7"
                  aria-invalid={invalid}
                  {...a}
                  {...field}
                />
              )}
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => setDialog({ buka: false, kelas: null })}
                disabled={sedangSimpan}
              >
                Batal
              </Button>
              <Button type="submit" variant="default" disabled={sedangSimpan}>
                {sedangSimpan && <Loader2Icon className="animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DialogSalinKelas
        buka={salinBuka}
        jumlahKelas={daftar.data?.length ?? 0}
        onTutup={() => setSalinBuka(false)}
      />

      <DialogNaikKelas
        buka={naikBuka}
        kelas={daftar.data ?? []}
        onTutup={() => setNaikBuka(false)}
      />

      <ConfirmDialog
        open={Boolean(akanHapus)}
        onOpenChange={(o) => !o && setAkanHapus(null)}
        judul={`Hapus kelas ${akanHapus?.name}?`}
        deskripsi="Kelas yang sudah punya riwayat presensi akan ditolak server — nonaktifkan saja, supaya nama kelas di laporan lama tidak hilang."
        labelKonfirmasi="Hapus kelas"
        berbahaya
        memuat={hapus.isPending}
        onKonfirmasi={() =>
          akanHapus &&
          hapus.mutate(akanHapus.id, {
            onSuccess: () => {
              toastSukses(`Kelas ${akanHapus.name} dihapus`);
              setAkanHapus(null);
            },
            onError: (e) => toastGagal(e, 'Kelas tidak bisa dihapus'),
          })
        }
      />
    </div>
  );
}
