'use client';

import { useState } from 'react';
import { EllipsisVerticalIcon, InboxIcon, MonitorSmartphoneIcon, UserRoundXIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { TidakPunyaAkses } from '@/components/tidak-punya-akses';
import { useSaya } from '@/hooks/use-auth';
import {
  useCabutSesiPengguna,
  useDaftarPengguna,
  useUbahPengguna,
  type Pengguna,
} from '@/hooks/use-pengguna';
import { KesalahanApi, pesanError } from '@/lib/api';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn, inisial, tanggalJamSingkat } from '@/lib/utils';
import { DialogEditNama, DialogResetPassword } from './dialog-aksi';
import { FormBuatAkun } from './form-buat-akun';

type Aksi = { tipe: 'edit' | 'reset' | 'nonaktifkan' | 'aktifkan' | 'cabut'; pengguna: Pengguna };

export default function HalamanPengguna() {
  const { data: saya } = useSaya();
  const daftar = useDaftarPengguna();
  const ubah = useUbahPengguna();
  const cabut = useCabutSesiPengguna();
  const [aksi, setAksi] = useState<Aksi | null>(null);

  const tutup = () => setAksi(null);

  // FE-011: menyembunyikan menu tidak cukup. Kalau URL ini dibuka Admin biasa,
  // backend menjawab 403 dan inilah yang dilihat pengguna.
  if (daftar.error instanceof KesalahanApi && daftar.error.status === 403) {
    return <TidakPunyaAkses pesan={daftar.error.message} />;
  }

  const kolom: Kolom<Pengguna>[] = [
    {
      kunci: 'pengguna',
      judul: 'Pengguna',
      nilaiSortir: (p) => p.full_name,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-bold',
              p.role === 'SUPER_ADMIN'
                ? 'bg-primary text-white'
                : 'bg-primary-soft text-primary-ink',
            )}
          >
            {inisial(p.full_name)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{p.full_name}</div>
            <div className="num text-muted-foreground">{p.username}</div>
          </div>
        </div>
      ),
    },
    {
      kunci: 'peran',
      judul: 'Peran',
      nilaiSortir: (p) => p.role,
      render: (p) =>
        p.role === 'SUPER_ADMIN' ? (
          <Badge variant="primary">SUPER ADMIN</Badge>
        ) : (
          <Badge variant="muted">ADMIN</Badge>
        ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      nilaiSortir: (p) => (p.is_active ? (p.must_change_password ? 1 : 0) : 2),
      render: (p) =>
        !p.is_active ? (
          <Badge variant="danger">Nonaktif</Badge>
        ) : p.must_change_password ? (
          <Badge variant="warn">Wajib ganti password</Badge>
        ) : (
          <Badge variant="ok">Aktif</Badge>
        ),
    },
    {
      kunci: 'login',
      judul: 'Login Terakhir',
      nilaiSortir: (p) => p.last_login_at,
      render: (p) => {
        const waktu = tanggalJamSingkat(p.last_login_at);
        return waktu ? (
          <div className="text-[12.5px] text-muted-foreground">
            {waktu}
            {p.last_login_ip && <div className="num">{p.last_login_ip}</div>}
          </div>
        ) : (
          <span className="text-[12.5px] text-faint">belum pernah masuk</span>
        );
      },
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right whitespace-nowrap',
      render: (p) => {
        // Akun sendiri dan Super Admin lain sengaja tidak bisa diutak-atik dari
        // sini — backend juga menolaknya, jadi tombolnya tidak ditampilkan
        // supaya tidak menjanjikan sesuatu yang pasti gagal.
        if (p.id === saya?.id) {
          return <span className="text-xs text-faint">akun Anda</span>;
        }
        if (p.role === 'SUPER_ADMIN') {
          return <span className="text-xs text-faint">hanya lewat CLI server</span>;
        }
        if (!p.is_active) {
          return (
            <Button size="sm" onClick={() => setAksi({ tipe: 'aktifkan', pengguna: p })}>
              Aktifkan kembali
            </Button>
          );
        }
        // Dua aksi harian tampil sebagai tombol; yang jarang dipakai
        // disimpan di menu supaya kolom ini tidak melebar dan terpotong.
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button size="sm" onClick={() => setAksi({ tipe: 'edit', pengguna: p })}>
              Edit
            </Button>
            <Button size="sm" onClick={() => setAksi({ tipe: 'reset', pengguna: p })}>
              Reset Password
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" aria-label={`Aksi lain untuk ${p.full_name}`}>
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setAksi({ tipe: 'cabut', pengguna: p })}>
                  <MonitorSmartphoneIcon />
                  Cabut semua sesi
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onSelect={() => setAksi({ tipe: 'nonaktifkan', pengguna: p })}
                >
                  <UserRoundXIcon />
                  Nonaktifkan akun
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const total = daftar.data?.length ?? 0;
  const aktif = daftar.data?.filter((p) => p.is_active).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-[12.6px] leading-relaxed text-primary-ink">
        <b className="font-bold">Halaman khusus Super Admin.</b> Sistem hanya mengenal dua peran:{' '}
        <b>Super Admin</b> (semua wewenang + kelola pengguna) dan <b>Admin</b> (seluruh
        operasional, tanpa akses halaman ini). Akun baru selalu dibuat dengan peran Admin —
        menambah Super Admin hanya bisa lewat perintah CLI di server.
      </div>

      {/*
        Dua kolom hanya dipakai pada layar sangat lebar. Di layar laptop biasa
        (1366–1440) tabel dan formulir berdampingan membuat kolom Aksi terpotong,
        jadi formulirnya turun ke bawah tabel.
      */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,2.1fr)_minmax(320px,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Daftar Pengguna</CardTitle>
            {!daftar.isPending && !daftar.isError && (
              <CardHint>
                {total} akun · {aktif} aktif
              </CardHint>
            )}
          </CardHeader>
          <CardContentFlush>
            <DataTable
              kolom={kolom}
              data={daftar.data}
              idBaris={(p) => p.id}
              memuat={daftar.isPending}
              error={daftar.error}
              onCobaLagi={() => void daftar.refetch()}
              sortirAwal={{ kunci: 'peran', arah: 'naik' }}
              classBaris={(p) => (p.is_active ? undefined : 'opacity-60')}
              kosong={
                <EmptyState
                  ikon={<InboxIcon />}
                  judul="Belum ada akun lain"
                  deskripsi="Buat akun admin lewat formulir di sebelah kanan."
                />
              }
            />
          </CardContentFlush>
        </Card>

        <FormBuatAkun />
      </div>

      <DialogEditNama pengguna={aksi?.tipe === 'edit' ? aksi.pengguna : null} onTutup={tutup} />
      <DialogResetPassword
        pengguna={aksi?.tipe === 'reset' ? aksi.pengguna : null}
        onTutup={tutup}
      />

      <ConfirmDialog
        open={aksi?.tipe === 'nonaktifkan'}
        onOpenChange={(o) => !o && tutup()}
        judul={`Nonaktifkan ${aksi?.pengguna.full_name}?`}
        deskripsi="Akun tidak dihapus, hanya dimatikan — jejak siapa yang mencatat presensi tetap utuh. Semua sesinya langsung dicabut dan ia tidak bisa masuk lagi sampai diaktifkan kembali."
        labelKonfirmasi="Nonaktifkan"
        berbahaya
        memuat={ubah.isPending}
        onKonfirmasi={() =>
          aksi &&
          ubah.mutate(
            { id: aksi.pengguna.id, is_active: false },
            {
              onSuccess: () => {
                toastSukses(`${aksi.pengguna.full_name} dinonaktifkan`);
                tutup();
              },
              onError: (e) => toastGagal(e, 'Gagal menonaktifkan akun'),
            },
          )
        }
      />

      <ConfirmDialog
        open={aksi?.tipe === 'aktifkan'}
        onOpenChange={(o) => !o && tutup()}
        judul={`Aktifkan kembali ${aksi?.pengguna.full_name}?`}
        deskripsi="Akun bisa dipakai masuk lagi dengan password terakhirnya. Kalau password itu sudah tidak diketahui, reset setelah akun aktif."
        labelKonfirmasi="Aktifkan"
        memuat={ubah.isPending}
        onKonfirmasi={() =>
          aksi &&
          ubah.mutate(
            { id: aksi.pengguna.id, is_active: true },
            {
              onSuccess: () => {
                toastSukses(`${aksi.pengguna.full_name} diaktifkan kembali`);
                tutup();
              },
              onError: (e) => toastGagal(e, 'Gagal mengaktifkan akun'),
            },
          )
        }
      />

      <ConfirmDialog
        open={aksi?.tipe === 'cabut'}
        onOpenChange={(o) => !o && tutup()}
        judul={`Cabut semua sesi ${aksi?.pengguna.full_name}?`}
        deskripsi="Dipakai saat ada dugaan akunnya dipakai orang lain. Ia akan dikeluarkan dari semua perangkat dan harus masuk lagi dengan password yang sama."
        labelKonfirmasi="Cabut sesi"
        berbahaya
        memuat={cabut.isPending}
        onKonfirmasi={() =>
          aksi &&
          cabut.mutate(aksi.pengguna.id, {
            onSuccess: () => {
              toastSukses('Semua sesi dicabut');
              tutup();
            },
            onError: (e) => toastGagal(e, 'Gagal mencabut sesi'),
          })
        }
      />

      {daftar.isError && !(daftar.error instanceof KesalahanApi && daftar.error.status === 403) && (
        <p className="sr-only" role="status">
          {pesanError(daftar.error)}
        </p>
      )}
    </div>
  );
}
