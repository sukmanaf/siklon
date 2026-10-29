'use client';

import { useState } from 'react';
import { BanIcon, InboxIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContentFlush, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type Kolom } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { GelembungWa } from './gelembung-wa';
import {
  useDaftarPesanWa,
  useDetailPesanWa,
  useKirimUlangPesan,
  useKirimUlangSemuaGagal,
  useBatalkanSemuaAntrean,
  type PesanWa,
} from '@/hooks/use-wa';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

const SEMUA = '__semua__';
const PER_HALAMAN = 25;

const GAYA_STATUS = {
  QUEUED: { label: 'Dalam antrean', variant: 'info' as const },
  SENT: { label: 'Terkirim', variant: 'ok' as const },
  FAILED: { label: 'Gagal', variant: 'danger' as const },
  CANCELLED: { label: 'Dibatalkan', variant: 'muted' as const },
};

export function TabLog() {
  const [status, setStatus] = useState(SEMUA);
  const [halaman, setHalaman] = useState(1);
  const [lihatId, setLihatId] = useState<string | null>(null);
  const [konfirmasiUlang, setKonfirmasiUlang] = useState(false);
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false);

  const daftar = useDaftarPesanWa({
    status: status === SEMUA ? undefined : status,
    page: halaman,
    perPage: PER_HALAMAN,
  });
  const detail = useDetailPesanWa(lihatId);
  const ulangSatu = useKirimUlangPesan();
  const ulangSemua = useKirimUlangSemuaGagal();
  const batalkanSemua = useBatalkanSemuaAntrean();

  const kolom: Kolom<PesanWa>[] = [
    {
      kunci: 'waktu',
      judul: 'Waktu',
      render: (p) => (
        <span className="num">
          {new Date(p.dibuatPada).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      kunci: 'penerima',
      judul: 'Penerima',
      render: (p) => (
        <div className="min-w-0">
          <div className="truncate">{p.siswa?.nama ?? '—'}</div>
          {/* Nomor sudah disamarkan server: layar ini sering terbuka di ruang terbuka. */}
          <div className="num truncate text-xs text-muted-foreground">{p.nomor}</div>
        </div>
      ),
    },
    {
      kunci: 'kejadian',
      judul: 'Kejadian',
      render: (p) => <Badge variant="muted">{p.kejadian}</Badge>,
    },
    {
      kunci: 'isi',
      judul: 'Isi Pesan',
      className: 'max-w-[260px]',
      render: (p) =>
        p.status === 'FAILED' && p.errorTerakhir ? (
          <span className="text-[12px] text-alpa">{p.errorTerakhir}</span>
        ) : (
          <span className="block truncate text-[12px] text-muted-foreground">{p.cuplikan}…</span>
        ),
    },
    {
      kunci: 'percobaan',
      judul: 'Percobaan',
      className: 'text-center',
      classHead: 'text-center',
      render: (p) => <span className="num">{p.percobaan}</span>,
    },
    {
      kunci: 'status',
      judul: 'Status',
      render: (p) => {
        const g = GAYA_STATUS[p.status as keyof typeof GAYA_STATUS] ?? GAYA_STATUS.QUEUED;
        return <Badge variant={g.variant}>{g.label}</Badge>;
      },
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      classHead: 'text-right',
      className: 'text-right whitespace-nowrap',
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => setLihatId(p.id)}>
            Lihat
          </Button>
          {p.status !== 'SENT' && (
            <Button
              size="sm"
              disabled={ulangSatu.isPending}
              onClick={() =>
                ulangSatu.mutate(p.id, {
                  onSuccess: (h) => toastSukses(h.pesan),
                  onError: (e) => toastGagal(e, 'Gagal mengantrekan ulang'),
                })
              }
            >
              Coba lagi
            </Button>
          )}
        </div>
      ),
    },
  ];

  const gagal = daftar.data?.items.filter((p) => p.status === 'FAILED').length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Log Pengiriman</CardTitle>
          {daftar.data && <CardHint>{daftar.data.total} pesan</CardHint>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setHalaman(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Filter status pesan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua status</SelectItem>
                <SelectItem value="QUEUED">Dalam antrean</SelectItem>
                <SelectItem value="SENT">Terkirim</SelectItem>
                <SelectItem value="FAILED">Gagal saja</SelectItem>
                <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="border-alpa/40 text-alpa hover:bg-alpa-bg hover:text-alpa"
              onClick={() => setKonfirmasiBatal(true)}
              disabled={batalkanSemua.isPending}
            >
              {batalkanSemua.isPending ? <Loader2Icon className="animate-spin" /> : <BanIcon />}
              Batalkan antrean
            </Button>
            <Button size="sm" onClick={() => setKonfirmasiUlang(true)} disabled={ulangSemua.isPending}>
              {ulangSemua.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              Kirim ulang yang gagal
            </Button>
          </div>
        </CardHeader>

        {gagal > 0 && (
          <p className="border-b border-border bg-alpa-bg px-4 py-2 text-[12.5px] font-medium text-alpa">
            {gagal} pesan gagal di halaman ini. Nomor yang gagal berkali-kali biasanya bukan nomor
            WhatsApp — periksa datanya di halaman Siswa.
          </p>
        )}

        <CardContentFlush>
          <DataTable
            kolom={kolom}
            data={daftar.data?.items}
            idBaris={(p) => p.id}
            memuat={daftar.isPending}
            error={daftar.error}
            onCobaLagi={() => void daftar.refetch()}
            classBaris={(p) => (p.status === 'FAILED' ? 'bg-alpa-bg/40' : undefined)}
            paginasiServer={{
              halaman,
              perPage: PER_HALAMAN,
              total: daftar.data?.total ?? 0,
              totalHalaman: daftar.data?.totalPage ?? 1,
              onHalaman: setHalaman,
            }}
            kosong={
              <EmptyState
                ikon={<InboxIcon />}
                judul={status === SEMUA ? 'Belum ada pesan' : 'Tidak ada pesan dengan status itu'}
                deskripsi="Pesan masuk ke antrean begitu ada scan yang memicu notifikasi."
              />
            }
          />
        </CardContentFlush>
      </Card>

      <Dialog open={Boolean(lihatId)} onOpenChange={(o) => !o && setLihatId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Isi pesan</DialogTitle>
            <DialogDescription>
              Persis seperti yang dikirim ke wali murid. Nomor lengkap hanya tampil di sini, tidak
              di daftar.
            </DialogDescription>
          </DialogHeader>

          {detail.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : detail.isError ? (
            <p className="text-[13px] text-alpa">Isi pesan tidak bisa dimuat.</p>
          ) : (
            <div className="space-y-3">
              <GelembungWa isi={detail.data.body} nomor={detail.data.nomor} />
              <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
                <dt className="text-muted-foreground">Kejadian</dt>
                <dd className="num">{detail.data.event}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="num">{detail.data.status}</dd>
                <dt className="text-muted-foreground">Percobaan</dt>
                <dd className="num">{detail.data.attempts}</dd>
                <dt className="text-muted-foreground">Terkirim</dt>
                <dd className="num">
                  {detail.data.sent_at
                    ? new Date(detail.data.sent_at).toLocaleString('id-ID')
                    : 'belum'}
                </dd>
              </dl>
              {detail.data.last_error && (
                <p className={cn('rounded-lg bg-alpa-bg px-3 py-2 text-[12.5px] text-alpa')}>
                  {detail.data.last_error}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={konfirmasiUlang}
        onOpenChange={setKonfirmasiUlang}
        judul="Kirim ulang semua pesan yang gagal?"
        deskripsi="Semua pesan berstatus GAGAL dimasukkan kembali ke antrean dengan percobaan direset. Pesan yang dibatalkan karena wali minta berhenti tidak ikut — mengirimnya lagi justru melanggar permintaan mereka."
        labelKonfirmasi="Kirim ulang"
        memuat={ulangSemua.isPending}
        onKonfirmasi={() =>
          ulangSemua.mutate(undefined, {
            onSuccess: (h) => {
              toastSukses(h.pesan);
              setKonfirmasiUlang(false);
            },
            onError: (e) => toastGagal(e, 'Gagal mengantrekan ulang'),
          })
        }
      />

      <ConfirmDialog
        open={konfirmasiBatal}
        onOpenChange={setKonfirmasiBatal}
        judul="Batalkan semua antrean pesan?"
        deskripsi="Semua pesan yang saat ini masih berstatus 'Dalam antrean' akan ditandai Dibatalkan dan tidak akan dikirimkan saat WhatsApp tersambung."
        labelKonfirmasi="Ya, batalkan antrean"
        berbahaya
        memuat={batalkanSemua.isPending}
        onKonfirmasi={() =>
          batalkanSemua.mutate(undefined, {
            onSuccess: (h) => {
              toastSukses(h.pesan);
              setKonfirmasiBatal(false);
            },
            onError: (e) => toastGagal(e, 'Gagal membatalkan antrean'),
          })
        }
      />
    </div>
  );
}
