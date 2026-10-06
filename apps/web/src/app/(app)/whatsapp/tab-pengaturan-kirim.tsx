'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { KEJADIAN_WA, type KejadianWa, type Whatsapp } from '@siklon/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { KEJADIAN_LABEL } from '@/hooks/use-wa';
import { usePresensiHarian } from '@/hooks/use-presensi';
import { useRingkasanSiswa } from '@/hooks/use-siswa';
import { useSemuaSetting, useSimpanSetting } from '@/hooks/use-pengaturan';
import { hariIni } from '@/lib/tanggal';
import { toastGagal, toastSukses } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * Perkiraan volume pesan (FE-036).
 *
 * Angkanya tidak dikarang: jumlah penerima diambil dari ringkasan siswa, dan
 * proporsi hadir/terlambat/alpa diambil dari presensi hari ini kalau sudah ada
 * datanya. Kalau belum ada, dipakai perkiraan kasar dan hal itu dinyatakan di
 * layar — angka yang terlihat pasti padahal ditebak justru menyesatkan.
 */
function hitungVolume(opsi: {
  penerima: number;
  kirimSaat: KejadianWa[];
  rekapMingguan: boolean;
  proporsi: { hadir: number; terlambat: number; alpa: number } | null;
  jedaMinMs: number;
  jedaMaxMs: number;
}) {
  const { penerima, kirimSaat, rekapMingguan, proporsi } = opsi;
  // Perkiraan kasar bila belum ada data hari ini.
  const p = proporsi ?? { hadir: 0.85, terlambat: 0.08, alpa: 0.05 };

  const rinci: { kejadian: string; jumlah: number }[] = [];
  if (kirimSaat.includes('MASUK')) {
    rinci.push({ kejadian: 'MASUK', jumlah: Math.round(penerima * p.hadir) });
  }
  if (kirimSaat.includes('TERLAMBAT')) {
    rinci.push({ kejadian: 'TERLAMBAT', jumlah: Math.round(penerima * p.terlambat) });
  }
  if (kirimSaat.includes('PULANG')) {
    // Setiap siswa yang datang juga pulang — hadir maupun terlambat. Ini yang
    // membuat notifikasi pulang praktis melipatgandakan volume harian, dan
    // itulah yang perlu terlihat sebelum sekolah menyalakannya.
    rinci.push({ kejadian: 'PULANG', jumlah: Math.round(penerima * (p.hadir + p.terlambat)) });
  }
  if (kirimSaat.includes('ALPA')) {
    rinci.push({ kejadian: 'ALPA', jumlah: Math.round(penerima * p.alpa) });
  }
  if (kirimSaat.includes('REKAP')) {
    // Rekap mingguan dibagi rata ke 5 hari sekolah supaya bisa dibandingkan
    // dengan kejadian harian lainnya.
    rinci.push({
      kejadian: 'REKAP',
      jumlah: rekapMingguan ? Math.round(penerima / 5) : penerima,
    });
  }

  const perHari = rinci.reduce((t, r) => t + r.jumlah, 0);
  const jedaRataDetik = (opsi.jedaMinMs + opsi.jedaMaxMs) / 2 / 1000;
  // "Ekor antrean": berapa lama pesan terakhir baru terkirim kalau semuanya
  // masuk antrean bersamaan — ini yang menentukan apakah wali murid dapat
  // kabar saat anaknya baru sampai, atau satu jam kemudian.
  const ekorDetik = Math.max(0, perHari - 1) * jedaRataDetik;

  return { rinci, perHari, jedaRataDetik, ekorDetik };
}

function formatDurasi(detik: number) {
  if (detik < 60) return `${Math.round(detik)} detik`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  return `${jam} jam ${menit % 60} menit`;
}

export function TabPengaturanKirim() {
  const setting = useSemuaSetting();
  const simpan = useSimpanSetting();
  const ringkasan = useRingkasanSiswa();
  const harian = usePresensiHarian(hariIni());

  const [nilai, setNilai] = useState<Whatsapp | null>(null);

  const tersimpan = setting.data?.['whatsapp'] as Whatsapp | undefined;
  useEffect(() => {
    if (tersimpan) setNilai(tersimpan);
  }, [tersimpan]);

  if (setting.isPending || !nilai) return <Skeleton className="h-96 w-full" />;

  const r = ringkasan.data;
  // Penerima = siswa aktif yang punya nomor DAN notifikasinya menyala.
  const penerima = Math.max(0, (r?.aktif ?? 0) - (r?.tanpaWali ?? 0) - (r?.notifikasiMati ?? 0));

  const h = harian.data?.ringkasan;
  const tercatat = h ? h.total - h.belum : 0;
  const proporsi =
    h && tercatat >= 5
      ? {
          hadir: h.hadir / tercatat,
          terlambat: h.terlambat / tercatat,
          alpa: h.alpa / tercatat,
        }
      : null;

  const volume = hitungVolume({
    penerima,
    kirimSaat: nilai.kirim_saat,
    rekapMingguan: nilai.rekap_mingguan,
    proporsi,
    jedaMinMs: nilai.jeda_min_ms,
    jedaMaxMs: nilai.jeda_max_ms,
  });

  const lewatKuota = volume.perHari > nilai.maks_per_hari;
  const berubah = JSON.stringify(nilai) !== JSON.stringify(tersimpan);

  const ubah = <K extends keyof Whatsapp>(k: K, v: Whatsapp[K]) =>
    setNilai((n) => (n ? { ...n, [k]: v } : n));

  function toggleKejadian(k: KejadianWa) {
    const ada = nilai!.kirim_saat.includes(k);
    ubah(
      'kirim_saat',
      ada ? nilai!.kirim_saat.filter((x) => x !== k) : [...nilai!.kirim_saat, k],
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Kapan pesan dikirim</CardTitle>
          <CardHint>centang kejadian yang perlu dikabarkan</CardHint>
          <Button
            size="sm"
            variant="default"
            className="ml-auto"
            disabled={!berubah || simpan.isPending}
            onClick={() =>
              simpan.mutate(
                { kunci: 'whatsapp', nilai },
                {
                  onSuccess: () => toastSukses('Pengaturan notifikasi disimpan'),
                  onError: (e) => toastGagal(e, 'Pengaturan gagal disimpan'),
                },
              )
            }
          >
            {simpan.isPending && <Loader2Icon className="animate-spin" />}
            Simpan
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Switch
              id="wa-aktif"
              checked={nilai.aktif}
              onCheckedChange={(v) => ubah('aktif', v)}
            />
            <div>
              <Label htmlFor="wa-aktif" className="text-[13px] text-foreground">
                Notifikasi WhatsApp aktif
              </Label>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Saklar utama. Dimatikan berarti tidak ada pesan yang diantrekan sama sekali —
                termasuk pemberitahuan kedatangan, yang merupakan tujuan utama sistem ini.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {KEJADIAN_WA.map((k) => {
              const aktif = nilai.kirim_saat.includes(k);
              const jumlah = volume.rinci.find((x) => x.kejadian === k)?.jumlah ?? 0;
              return (
                <label
                  key={k}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    aktif ? 'border-primary bg-primary-soft' : 'border-border hover:border-faint',
                  )}
                >
                  <Switch
                    checked={aktif}
                    onCheckedChange={() => toggleKejadian(k)}
                    aria-label={`Kirim saat ${k}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold">{KEJADIAN_LABEL[k].judul}</span>
                      <span className="num text-[11px] text-muted-foreground">{k}</span>
                      {aktif && (
                        <span className="num ml-auto text-[12.5px] font-bold text-primary-ink">
                          ≈ {jumlah}/hari
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {KEJADIAN_LABEL[k].jelas}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {nilai.kirim_saat.includes('REKAP') && (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Switch
                id="rekap-mingguan"
                checked={nilai.rekap_mingguan}
                onCheckedChange={(v) => ubah('rekap_mingguan', v)}
              />
              <Label htmlFor="rekap-mingguan" className="text-[13px] text-foreground">
                Rekap dikirim mingguan (bukan harian)
              </Label>
            </div>
          )}

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="maks-hari">Batas pesan per hari</Label>
              <Input
                id="maks-hari"
                type="number"
                min={0}
                className="num"
                value={nilai.maks_per_hari}
                onChange={(e) => ubah('maks_per_hari', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maks-coba">Maksimal percobaan</Label>
              <Input
                id="maks-coba"
                type="number"
                min={1}
                max={10}
                className="num"
                value={nilai.maks_percobaan}
                onChange={(e) =>
                  ubah('maks_percobaan', Math.min(10, Math.max(1, Number(e.target.value) || 1)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jeda-min">Jeda minimum (ms)</Label>
              <Input
                id="jeda-min"
                type="number"
                min={0}
                className="num"
                value={nilai.jeda_min_ms}
                onChange={(e) => ubah('jeda_min_ms', Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jeda-max">Jeda maksimum (ms)</Label>
              <Input
                id="jeda-max"
                type="number"
                min={0}
                className="num"
                value={nilai.jeda_max_ms}
                onChange={(e) => ubah('jeda_max_ms', Math.max(0, Number(e.target.value) || 0))}
                aria-invalid={nilai.jeda_max_ms < nilai.jeda_min_ms}
              />
              {nilai.jeda_max_ms < nilai.jeda_min_ms && (
                <p className="text-[11.5px] font-medium text-destructive">
                  Tidak boleh lebih kecil dari jeda minimum.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenang-mulai">Jam tenang mulai</Label>
              <Input
                id="tenang-mulai"
                type="time"
                className="num"
                value={nilai.jam_tenang.mulai}
                onChange={(e) => ubah('jam_tenang', { ...nilai.jam_tenang, mulai: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenang-selesai">Jam tenang selesai</Label>
              <Input
                id="tenang-selesai"
                type="time"
                className="num"
                value={nilai.jam_tenang.selesai}
                onChange={(e) =>
                  ubah('jam_tenang', { ...nilai.jam_tenang, selesai: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Penghitung volume: ikut berubah seketika saat kejadian dicentang. */}
      <Card className="self-start" data-uji="kartu-volume">
        <CardHeader>
          <CardTitle>Perkiraan Volume</CardTitle>
          <CardHint>ikut berubah saat centangnya diubah</CardHint>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Perkiraan pesan per hari
            </div>
            <div
              data-uji="pesan-per-hari"
              className={cn('num text-4xl font-bold', lewatKuota ? 'text-alpa' : 'text-foreground')}
            >
              {volume.perHari}
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              dari <b className="num">{penerima}</b> siswa yang punya nomor dan notifikasinya
              menyala
            </div>
          </div>

          {lewatKuota && (
            <div className="flex items-start gap-2 rounded-lg bg-alpa-bg px-3 py-2 text-[12.5px] leading-relaxed text-alpa">
              <TriangleAlertIcon className="mt-px size-4 shrink-0" />
              Melebihi batas <b className="num">{nilai.maks_per_hari}</b> pesan/hari. Sisanya akan
              tertahan di antrean sampai besok — dan pemberitahuan kedatangan yang terlambat
              sehari sama saja dengan tidak terkirim.
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Ekor antrean
            </div>
            <div data-uji="ekor-antrean" className="num text-2xl font-bold">
              {formatDurasi(volume.ekorDetik)}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Selisih waktu antara pesan pertama dan terakhir kalau semuanya masuk antrean
              bersamaan, dengan jeda rata-rata{' '}
              <b className="num">{volume.jedaRataDetik.toFixed(1)} detik</b>. Ini yang menentukan
              apakah wali dapat kabar saat anaknya baru sampai, atau satu jam kemudian.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <div className="mb-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Rincian
            </div>
            {volume.rinci.length === 0 ? (
              <p className="text-[12.5px] text-terlambat">
                Tidak ada kejadian yang dicentang — tidak akan ada notifikasi sama sekali.
              </p>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                {volume.rinci.map((x) => (
                  <li key={x.kejadian} className="flex justify-between">
                    <span className="text-muted-foreground">{x.kejadian}</span>
                    <b className="num">≈ {x.jumlah}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            {proporsi
              ? 'Proporsi hadir/terlambat/alpa dihitung dari presensi hari ini.'
              : 'Belum cukup data presensi hari ini, jadi proporsinya memakai perkiraan kasar (85% hadir, 8% terlambat, 5% alpa). Angkanya akan lebih tepat setelah sekolah berjalan sehari penuh.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
