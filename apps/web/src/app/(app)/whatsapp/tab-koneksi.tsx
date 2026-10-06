'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Loader2Icon,
  MoonIcon,
  PlugIcon,
  PlugZapIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import {
  useDispatchSekarang,
  useHapusSesiWa,
  useKirimPesanUji,
  usePutuskanWa,
  useSambungkanWa,
  useStatusWa,
} from '@/hooks/use-wa';
import { pesanError } from '@/lib/api';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function TabKoneksi() {
  // Selama belum tersambung, status di-poll cepat: QR pairing hanya berlaku
  // sekitar 20 detik dan harus diganti sebelum kedaluwarsa (FE-033).
  const [cepat, setCepat] = useState(true);
  const status = useStatusWa(cepat);
  const sambung = useSambungkanWa();
  const putus = usePutuskanWa();
  const hapusSesi = useHapusSesiWa();
  const dispatch = useDispatchSekarang();
  const uji = useKirimPesanUji();

  const [nomorUji, setNomorUji] = useState('');
  const [konfirmasiPutus, setKonfirmasiPutus] = useState(false);
  const [konfirmasiGanti, setKonfirmasiGanti] = useState(false);
  const [gambarQr, setGambarQr] = useState<string | null>(null);
  const qrTerakhir = useRef<string | null>(null);

  const p = status.data?.provider;
  const a = status.data?.antrean;
  const g = status.data?.pengaman;

  useEffect(() => {
    setCepat(!p?.tersambung);
  }, [p?.tersambung]);

  // QR datang sebagai teks mentah dari Baileys; dirender jadi gambar di sini.
  // Setiap kali teksnya berubah (server menerbitkan QR baru sebelum yang lama
  // kedaluwarsa), gambarnya ikut berganti tanpa halaman dimuat ulang.
  useEffect(() => {
    const teks = p?.qr ?? null;
    if (!teks) {
      setGambarQr(null);
      qrTerakhir.current = null;
      return;
    }
    if (teks === qrTerakhir.current) return;
    qrTerakhir.current = teks;
    let batal = false;
    void QRCode.toDataURL(teks, { width: 320, margin: 1 }).then((url) => {
      if (!batal) setGambarQr(url);
    });
    return () => {
      batal = true;
    };
  }, [p?.qr]);

  if (status.isPending) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (status.isError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          judul="Status WhatsApp tidak bisa dimuat"
          deskripsi={pesanError(status.error)}
          aksi={
            <Button variant="default" onClick={() => void status.refetch()}>
              Coba lagi
            </Button>
          }
        />
      </Card>
    );
  }

  const persenKuota = a && a.batasHarian > 0 ? (a.terkirimHariIni / a.batasHarian) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Pengaman ini yang mencegah pesan sungguhan terkirim saat development. */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed',
          g?.providerEnv === 'dummy'
            ? 'border-izin/30 bg-izin-bg text-izin'
            : g?.production
              ? 'border-alpa/30 bg-alpa-bg text-alpa'
              : 'border-terlambat/30 bg-terlambat-bg text-terlambat',
        )}
      >
        <ShieldCheckIcon className="mt-px size-4 shrink-0" />
        <span>
          <b>Pengaman pengiriman:</b> {g?.catatan}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Status Koneksi</CardTitle>
            <div className="ml-auto">
              {p?.tersambung ? (
                <Badge variant="ok">● Tersambung</Badge>
              ) : (
                <Badge variant="danger">● Terputus</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <Baris label="Provider" nilai={p?.nama ?? '—'} />
            <Baris label="Nomor terhubung" nilai={p?.nomor ?? '—'} mono />
            <Baris
              label="Tersambung sejak"
              nilai={
                p?.tersambungSejak ? new Date(p.tersambungSejak).toLocaleString('id-ID') : '—'
              }
            />
            <Baris label="Terkirim hari ini" nilai={`${a?.terkirimHariIni ?? 0} pesan`} mono />
            <Baris
              label="Sisa kuota harian"
              nilai={`${a?.sisaKuota ?? 0} / ${a?.batasHarian ?? 0}`}
              mono
              warna={persenKuota > 80 ? 'text-alpa' : persenKuota > 60 ? 'text-terlambat' : undefined}
            />

            <div className="h-2 overflow-hidden rounded-full bg-libur-bg">
              <div
                className={cn(
                  'h-full rounded-full',
                  persenKuota > 80 ? 'bg-alpa' : persenKuota > 60 ? 'bg-terlambat' : 'bg-hadir',
                )}
                style={{ width: `${Math.min(100, persenKuota)}%` }}
              />
            </div>

            {a?.dalamJamTenang && (
              <div className="flex items-start gap-2 rounded-lg bg-izin-bg px-3 py-2 text-[12.5px] text-izin">
                <MoonIcon className="mt-px size-4 shrink-0" />
                Sedang jam tenang ({a.jamTenang.mulai}–{a.jamTenang.selesai}). Pesan tetap
                diantrekan tapi belum dikirim.
              </div>
            )}

            {p?.errorTerakhir && (
              <div className="flex items-start gap-2 rounded-lg bg-alpa-bg px-3 py-2 text-[12.5px] text-alpa">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                {p.errorTerakhir}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {p?.tersambung ? (
                <Button size="sm" variant="destructive-outline" onClick={() => setKonfirmasiPutus(true)}>
                  <PlugIcon />
                  Putuskan &amp; scan ulang
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  disabled={sambung.isPending}
                  onClick={() =>
                    sambung.mutate(undefined, {
                      onSuccess: (h) => toastSukses('Menyambungkan', h.pesan),
                      onError: (e) => toastGagal(e, 'Gagal menyambungkan'),
                    })
                  }
                >
                  {sambung.isPending ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
                  Sambungkan
                </Button>
              )}
              <Button
                size="sm"
                disabled={dispatch.isPending}
                onClick={() =>
                  dispatch.mutate(undefined, {
                    onSuccess: () => toastSukses('Satu putaran pengiriman dijalankan'),
                    onError: (e) => toastGagal(e, 'Gagal menjalankan pengiriman'),
                  })
                }
              >
                {dispatch.isPending && <Loader2Icon className="animate-spin" />}
                Kirim antrean sekarang
              </Button>

              {/*
                Nomor Baileys adalah barang habis pakai — kalau kena blokir,
                sekolah harus bisa pindah nomor tanpa akses SSH ke server.
                Tanpa tombol ini, ganti nomor berarti menghapus folder sesi
                lewat terminal, dan itu di luar jangkauan admin sekolah.
              */}
              <Button
                size="sm"
                variant="destructive-outline"
                className="ml-auto"
                onClick={() => setKonfirmasiGanti(true)}
              >
                <RefreshCwIcon />
                Ganti nomor
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Pairing hanya muncul saat memang dibutuhkan. */}
          {!p?.tersambung && (
            <Card>
              <CardHeader>
                <CardTitle>Pindai QR</CardTitle>
                <CardHint>pakai WhatsApp nomor SEKOLAH, bukan nomor pribadi</CardHint>
              </CardHeader>
              <CardContent>
                {gambarQr ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gambarQr}
                      alt="QR pairing WhatsApp"
                      data-uji="qr-pairing"
                      className="rounded-xl border border-border bg-white p-2"
                      width={280}
                      height={280}
                    />
                    <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
                      Buka WhatsApp di HP sekolah → <b>Perangkat tertaut</b> →{' '}
                      <b>Tautkan perangkat</b>. QR ini berganti sendiri sebelum kedaluwarsa, jadi
                      halaman tidak perlu dimuat ulang.
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    ikon={<Loader2Icon className="animate-spin" />}
                    judul="Menunggu QR dari server"
                    deskripsi="Tekan Sambungkan bila QR belum juga muncul."
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Antrean Pengiriman</CardTitle>
              <CardHint>worker mengirim dengan jeda acak antar pesan</CardHint>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Angka label="Menunggu" nilai={a?.menunggu} warna="text-terlambat" />
                <Angka label="Terkirim" nilai={a?.terkirim} warna="text-hadir" />
                <Angka label="Gagal" nilai={a?.gagal} warna="text-alpa" />
                <Angka label="Hari ini" nilai={a?.terkirimHariIni} warna="text-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kirim Pesan Uji</CardTitle>
              <CardHint>tetap lewat semua lapis pengaman</CardHint>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nomor-uji">Nomor tujuan</Label>
                <div className="flex gap-2">
                  <Input
                    id="nomor-uji"
                    value={nomorUji}
                    onChange={(e) => setNomorUji(e.target.value)}
                    placeholder="081234567890"
                    className="font-mono"
                    inputMode="tel"
                  />
                  <Button
                    variant="default"
                    disabled={!nomorUji.trim() || uji.isPending}
                    onClick={() =>
                      uji.mutate(
                        { nomor: nomorUji.trim() },
                        {
                          onSuccess: (h) => toastSukses(`Pesan uji dikirim ke ${h.ke}`),
                          onError: (e) => toastGagal(e, 'Pesan uji gagal'),
                        },
                      )
                    }
                  >
                    {uji.isPending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                    Kirim
                  </Button>
                </div>
              </div>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Pakai nomor Anda sendiri lebih dulu. Kalau provider masih <b>dummy</b>, pesannya
                hanya dicatat di log server dan tidak benar-benar terkirim.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={konfirmasiGanti}
        onOpenChange={setKonfirmasiGanti}
        judul="Ganti ke nomor WhatsApp lain?"
        deskripsi="Sesi nomor sekarang dibuang, dan Anda harus memindai QR lagi dengan nomor baru. Wali murid akan menerima pesan dari nomor yang berbeda — pastikan nomor barunya sudah diumumkan lebih dulu. Sesi lama tetap diarsipkan di server."
        labelKonfirmasi="Buang sesi & pindai ulang"
        berbahaya
        memuat={hapusSesi.isPending}
        onKonfirmasi={() =>
          hapusSesi.mutate(undefined, {
            onSuccess: (h) => {
              toastSukses('Sesi dibuang', h.pesan);
              setKonfirmasiGanti(false);
            },
            onError: (e) => toastGagal(e, 'Gagal membuang sesi'),
          })
        }
      />

      <ConfirmDialog
        open={konfirmasiPutus}
        onOpenChange={setKonfirmasiPutus}
        judul="Putuskan sambungan WhatsApp?"
        deskripsi="Notifikasi berhenti terkirim sampai QR dipindai ulang. Pesan yang sudah diantrekan tetap tersimpan dan akan dikirim setelah tersambung lagi."
        labelKonfirmasi="Putuskan"
        berbahaya
        memuat={putus.isPending}
        onKonfirmasi={() =>
          putus.mutate(undefined, {
            onSuccess: () => {
              toastSukses('WhatsApp diputuskan');
              setKonfirmasiPutus(false);
            },
            onError: (e) => toastGagal(e, 'Gagal memutuskan'),
          })
        }
      />
    </div>
  );
}

function Baris({
  label,
  nilai,
  mono,
  warna,
}: {
  label: string;
  nilai: string;
  mono?: boolean;
  warna?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <b className={cn('truncate text-right', mono && 'num', warna)}>{nilai}</b>
    </div>
  );
}

function Angka({ label, nilai, warna }: { label: string; nilai?: number; warna: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className={cn('num text-[22px] font-bold', warna)}>{nilai ?? 0}</div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
