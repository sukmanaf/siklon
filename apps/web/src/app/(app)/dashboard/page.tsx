'use client';

import Link from 'next/link';
import {
  ActivityIcon,
  MessageCircleOffIcon,
  PlugZapIcon,
  TriangleAlertIcon,
  UserRoundXIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { GrafikTren } from '@/components/grafik-tren';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import { StatusBadge } from '@/components/status-badge';
import { useDashboard } from '@/hooks/use-laporan';
import { useSaya } from '@/hooks/use-auth';
import { pesanError } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function HalamanDashboard() {
  const { data: saya } = useSaya();
  const d = useDashboard();

  if (d.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (d.isError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          judul="Dashboard tidak bisa dimuat"
          deskripsi={pesanError(d.error)}
          aksi={
            <Button variant="default" onClick={() => void d.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </Card>
    );
  }

  const h = d.data.hariIni;
  const s = d.data.sistem;
  const b = d.data.perluDibenahi;

  // Hal-hal yang membuat notifikasi diam-diam tidak sampai. Ditaruh paling
  // atas karena inilah yang paling sering merusak tujuan sistem ini tanpa
  // ada yang sadar.
  const masalah = [
    b.siswaTanpaWali > 0 && {
      teks: `${b.siswaTanpaWali} siswa belum punya nomor wali`,
      href: '/siswa?tanpaWali=1',
      Ikon: UserRoundXIcon,
    },
    b.notifikasiMati > 0 && {
      teks: `${b.notifikasiMati} siswa notifikasinya dimatikan`,
      href: '/siswa',
      Ikon: MessageCircleOffIcon,
    },
    !s.scannerAgentOnline && {
      teks: 'Scanner Agent sedang offline — tidak ada scan yang masuk',
      href: '/scanner',
      Ikon: PlugZapIcon,
    },
    s.antrean.gagal > 0 && {
      teks: `${s.antrean.gagal} pesan WhatsApp gagal terkirim`,
      href: '/whatsapp?tab=log',
      Ikon: TriangleAlertIcon,
    },
  ].filter(Boolean) as { teks: string; href: string; Ikon: typeof UserRoundXIcon }[];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Hadir" nilai={h.hadir} warna="text-hadir" titik="bg-hadir"
          jelas={`dari ${d.data.siswaAktif} siswa aktif`} />
        <Stat label="Terlambat" nilai={h.terlambat} warna="text-terlambat" titik="bg-terlambat"
          jelas={`batas ${d.data.batasTerlambat}`} />
        <Stat label="Izin / Sakit" nilai={h.izin + h.sakit} warna="text-izin" titik="bg-izin"
          jelas={`${h.izin} izin · ${h.sakit} sakit`} />
        <Stat label="Alpa" nilai={h.alpa} warna="text-alpa" titik="bg-alpa"
          jelas={`${h.belum} belum tercatat`} />
      </div>

      {masalah.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Perlu dibenahi</CardTitle>
            <CardHint>hal yang membuat notifikasi tidak sampai</CardHint>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {masalah.map((m) => (
              <Link
                key={m.teks}
                href={m.href}
                className="flex items-center gap-2 rounded-lg bg-terlambat-bg px-3 py-2 text-[12.5px] font-medium text-terlambat transition-colors hover:brightness-95"
              >
                <m.Ikon className="size-4 shrink-0" />
                {m.teks}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tren Kehadiran</CardTitle>
            <CardHint>persentase hadir + terlambat, {d.data.tren.length} hari terakhir</CardHint>
          </CardHeader>
          <CardContent>
            <GrafikTren data={d.data.tren} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kelas Perlu Perhatian</CardTitle>
            <CardHint>kehadiran terendah hari ini</CardHint>
          </CardHeader>
          <CardContentFlush>
            {d.data.kelasPerluPerhatian.length === 0 ? (
              <EmptyState
                judul="Tidak ada kelas bermasalah"
                deskripsi="Semua kelas kehadirannya baik hari ini."
              />
            ) : (
              <ul className="divide-y divide-border">
                {d.data.kelasPerluPerhatian.map((k) => (
                  <li key={k.kelas} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{k.kelas}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {k.total} tercatat
                      </div>
                    </div>
                    {k.alpa > 0 && <Badge variant="danger">{k.alpa} alpa</Badge>}
                    <div className="w-16 text-right">
                      <span
                        className={cn(
                          'num font-bold',
                          (k.persen ?? 100) < 85 ? 'text-alpa' : 'text-foreground',
                        )}
                      >
                        {k.persen === null ? '—' : `${k.persen}%`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContentFlush>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terakhir</CardTitle>
            <CardHint>scan yang baru saja masuk</CardHint>
            <Button size="sm" className="ml-auto" asChild>
              <Link href="/scan">Buka Konsol Scan</Link>
            </Button>
          </CardHeader>
          <CardContentFlush>
            {d.data.aktivitasTerakhir.length === 0 ? (
              <EmptyState
                ikon={<ActivityIcon />}
                judul="Belum ada scan hari ini"
                deskripsi="Aktivitas muncul di sini begitu kartu siswa mulai dipindai di gerbang."
              />
            ) : (
              <ul className="divide-y divide-border">
                {d.data.aktivitasTerakhir.map((a) => (
                  <li key={`${a.nis}-${a.jam}`} className="flex items-center gap-3 px-4 py-2">
                    {/*
                      min-w-0 + shrink-0: tanpa keduanya, nama siswa menolak
                      dipotong dan gugus kanan menolak menyempit, sehingga
                      kartunya meluap keluar layar di HP. Ini baru terlihat
                      setelah ada data aktivitas sungguhan.
                    */}
                    <div className="min-w-0 flex-1">
                      <IdentitasSiswa nama={a.nama} nis={a.nis} kelas={a.kelas} ukuran="sm" />
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {(a.status === 'HADIR' || a.status === 'TERLAMBAT') && (
                        <StatusBadge status={a.status} />
                      )}
                      {/* Titik scan disembunyikan di layar sempit: isinya sering
                          "—" (scan kamera tidak mencatat asalnya) dan itu yang
                          paling tidak berguna untuk dipertahankan. */}
                      <span className="num hidden text-[12.5px] text-muted-foreground sm:inline">
                        {a.titik ?? '—'}
                      </span>
                      <span className="num font-semibold">{a.jam ?? '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContentFlush>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Sistem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <BarisSistem
              label="Scanner Agent"
              nilai={s.scannerAgentOnline ? 'Online' : 'Offline'}
              baik={s.scannerAgentOnline}
              href="/scanner"
            />
            <BarisSistem
              label="WhatsApp"
              nilai={`${s.whatsapp.provider}${s.whatsapp.tersambung ? ' · tersambung' : ' · terputus'}`}
              baik={s.whatsapp.tersambung}
              href="/whatsapp"
            />
            <BarisSistem
              label="Antrean pesan"
              nilai={`${s.antrean.menunggu} menunggu · ${s.antrean.gagal} gagal`}
              baik={s.antrean.gagal === 0}
              href="/whatsapp?tab=log"
            />
            <BarisSistem
              label="Terkirim hari ini"
              nilai={`${s.antrean.terkirimHariIni} / ${s.antrean.batasHarian}`}
              baik={s.antrean.terkirimHariIni < s.antrean.batasHarian}
              href="/whatsapp"
            />
            <p className="border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Masuk sebagai {saya?.nama} ({saya?.peran === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}).
              Jam masuk {d.data.jamMasuk}, batas terlambat {d.data.batasTerlambat}.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  nilai,
  warna,
  titik,
  jelas,
}: {
  label: string;
  nilai: number;
  warna: string;
  titik: string;
  jelas: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className={cn('size-2 rounded-full', titik)} />
        {label}
      </div>
      <div className={cn('mt-1 text-[26px] leading-none font-bold', warna)}>{nilai}</div>
      <div className="mt-1.5 text-[11.5px] text-muted-foreground">{jelas}</div>
    </div>
  );
}

function BarisSistem({
  label,
  nilai,
  baik,
  href,
}: {
  label: string;
  nilai: string;
  baik: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 hover:underline">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className={cn('size-2 rounded-full', baik ? 'bg-hadir' : 'bg-alpa')} />
        <b className="num">{nilai}</b>
      </span>
    </Link>
  );
}
