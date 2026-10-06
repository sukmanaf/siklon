'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  CalendarOffIcon,
  MessageCircleOffIcon,
  PencilIcon,
  PhoneIcon,
} from 'lucide-react';
import { formatNomor } from '@siklon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { KalenderKehadiran, type SelKalender } from '@/components/kalender-kehadiran';
import { StatusBadge } from '@/components/status-badge';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import { useDetailSiswa, useRiwayatPresensiSiswa } from '@/hooks/use-siswa';
import { useDaftarLibur } from '@/hooks/use-akademik';
import { useSemuaSetting } from '@/hooks/use-pengaturan';
import { pesanError } from '@/lib/api';
import {
  akhirBulan,
  awalBulan,
  bulanIni,
  geserBulan,
  hariIni as hariIniStr,
  labelBulan,
  tanggalPendek,
} from '@/lib/tanggal';
import type { BarisPresensi } from '@/lib/tipe';
import { DialogSiswa } from '../dialog-siswa';

export default function HalamanDetailSiswa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bulan, setBulan] = useState(bulanIni());
  const [editBuka, setEditBuka] = useState(false);

  const siswa = useDetailSiswa(id);
  const riwayat = useRiwayatPresensiSiswa(id, awalBulan(bulan), akhirBulan(bulan));
  const libur = useDaftarLibur(Number(bulan.slice(0, 4)));
  const setting = useSemuaSetting();

  const petaPresensi = useMemo(() => {
    const m = new Map<string, SelKalender>();
    for (const b of riwayat.data?.baris ?? []) {
      m.set(b.tanggal, { status: b.status, jamMasuk: b.jamMasuk, catatan: b.catatan });
    }
    return m;
  }, [riwayat.data]);

  const petaLibur = useMemo(
    () => new Map((libur.data ?? []).map((l) => [l.holiday_date.slice(0, 10), l.name])),
    [libur.data],
  );

  const hariSekolah = setting.data?.presensi?.hari_sekolah ?? [1, 2, 3, 4, 5, 6];

  if (siswa.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (siswa.isError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          judul="Data siswa tidak bisa dimuat"
          deskripsi={pesanError(siswa.error)}
          aksi={
            <Button variant="default" onClick={() => void siswa.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </Card>
    );
  }

  const s = siswa.data;
  const r = riwayat.data?.ringkasan;

  const kolom: Kolom<BarisPresensi>[] = [
    {
      kunci: 'tanggal',
      judul: 'Tanggal',
      nilaiSortir: (b) => b.tanggal,
      render: (b) => <span className="num">{tanggalPendek(b.tanggal)}</span>,
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (b) => (
        <StatusBadge
          status={b.status}
          keterangan={b.terlambatMenit > 0 ? `${b.terlambatMenit} mnt` : undefined}
        />
      ),
    },
    {
      kunci: 'jam',
      judul: 'Jam Masuk',
      render: (b) => <span className="num">{b.jamMasuk ?? '—'}</span>,
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
        <span className="text-muted-foreground">{b.catatan ?? <span className="text-faint">—</span>}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" asChild className="-ml-2">
        <Link href="/siswa">
          <ArrowLeftIcon />
          Kembali ke daftar siswa
        </Link>
      </Button>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <IdentitasSiswa nama={s.full_name} nis={s.nis} ukuran="lg" />
                <Button size="sm" onClick={() => setEditBuka(true)}>
                  <PencilIcon />
                  Edit
                </Button>
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                {/*
                  NIS diberi badge "isi QR kartu" karena inilah satu-satunya
                  identitas yang dikenali pemindai — salah ketik di sini berarti
                  kartunya tidak akan pernah bisa dipakai absen.
                */}
                <dt className="text-muted-foreground">NIS</dt>
                <dd>
                  <span className="num font-semibold">{s.nis}</span>
                  <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10.5px] font-semibold text-primary-ink">
                    isi QR kartu
                  </span>
                </dd>
                <dt className="text-muted-foreground">Kelas</dt>
                <dd>
                  {s.classes ? (
                    <Badge variant="primary">{s.classes.name}</Badge>
                  ) : (
                    <Badge variant="warn">Belum ada kelas</Badge>
                  )}
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {s.is_active ? (
                    <Badge variant="ok">Aktif</Badge>
                  ) : (
                    <Badge variant="muted">Nonaktif</Badge>
                  )}
                </dd>
              </dl>
            </CardContent>
          </Card>

          {/* Nomor adalah tujuan pesan; namanya hanya sapaan di dalam pesan itu. */}
          <Card>
            <CardHeader>
              <CardTitle>No. HP Wali</CardTitle>
              <CardHint>tujuan notifikasi WhatsApp</CardHint>
            </CardHeader>
            <CardContent>
              {s.guardian_phone ? (
                <div className="space-y-2">
                  <div className="num flex items-center gap-2 text-base font-semibold">
                    <PhoneIcon className="size-4 text-muted-foreground" />
                    {formatNomor(s.guardian_phone)}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    Tujuan notifikasi WhatsApp. Pesannya menyapa{' '}
                    <b className="text-foreground">Bpk/Ibu</b> lalu langsung menyebut nama
                    ananda.
                  </div>
                  {s.notify ? (
                    <Badge variant="ok">Notifikasi aktif</Badge>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg bg-alpa-bg px-3 py-2 text-[12.5px] text-alpa">
                      <MessageCircleOffIcon className="mt-px size-4 shrink-0" />
                      Notifikasi dimatikan — nomor ini tidak akan dikabari saat anaknya sampai di
                      sekolah.
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  ikon={<MessageCircleOffIcon />}
                  variant="error"
                  judul="Belum ada nomor HP"
                  deskripsi="Tanpa nomor, kedatangan anak ini tidak pernah dikabarkan ke siapa pun — padahal itu tujuan utama sistem ini."
                  aksi={
                    <Button size="sm" onClick={() => setEditBuka(true)}>
                      Pasang nomor HP
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kehadiran</CardTitle>
            <CardHint>{labelBulan(bulan)}</CardHint>
          </CardHeader>
          <CardContent className="space-y-4">
            {riwayat.isError ? (
              <EmptyState
                variant="error"
                judul="Riwayat gagal dimuat"
                deskripsi={pesanError(riwayat.error)}
              />
            ) : (
              <>
                <KalenderKehadiran
                  bulan={bulan}
                  onGantiBulan={(arah) => setBulan((b) => geserBulan(b, arah === 'maju' ? 1 : -1))}
                  data={petaPresensi}
                  libur={petaLibur}
                  hariSekolah={hariSekolah}
                  hariIni={hariIniStr()}
                />

                <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:grid-cols-5">
                  <Angka label="Hadir" nilai={r?.hadir} kelas="text-hadir" />
                  <Angka label="Terlambat" nilai={r?.terlambat} kelas="text-terlambat" />
                  <Angka label="Izin" nilai={r?.izin} kelas="text-izin" />
                  <Angka label="Sakit" nilai={r?.sakit} kelas="text-sakit" />
                  <Angka label="Alpa" nilai={r?.alpa} kelas="text-alpa" />
                </div>

                {(r?.totalMenitTerlambat ?? 0) > 0 && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Total keterlambatan bulan ini:{' '}
                    <b className="num text-terlambat">{r?.totalMenitTerlambat} menit</b>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Presensi</CardTitle>
          <CardHint>{labelBulan(bulan)}</CardHint>
        </CardHeader>
        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={riwayat.data?.baris}
            idBaris={(b) => b.id}
            memuat={riwayat.isPending}
            error={riwayat.error}
            onCobaLagi={() => void riwayat.refetch()}
            sortirAwal={{ kunci: 'tanggal', arah: 'turun' }}
            perHalaman={31}
            kosong={
              <EmptyState
                ikon={<CalendarOffIcon />}
                judul="Belum ada catatan presensi bulan ini"
                deskripsi="Catatan muncul begitu kartunya dipindai di gerbang, atau saat admin menandai izin/sakit."
              />
            }
          />
        </CardContentFlush>
      </Card>

      <DialogSiswa buka={editBuka} siswa={s} onTutup={() => setEditBuka(false)} />
    </div>
  );
}

function Angka({ label, nilai, kelas }: { label: string; nilai?: number; kelas: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`text-xl font-bold ${kelas}`}>{nilai ?? '—'}</div>
    </div>
  );
}
