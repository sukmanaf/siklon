'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { KEJADIAN_WA, type KejadianWa, type TemplateWa } from '@siklon/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHint, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { KEJADIAN_LABEL, usePratinjauTemplate } from '@/hooks/use-wa';
import { useSemuaSetting, useSimpanSetting } from '@/hooks/use-pengaturan';
import { toastGagal, toastSukses } from '@/lib/toast';
import { GelembungWa } from './gelembung-wa';

/**
 * Variabel yang benar-benar dikenal backend (lihat modules/whatsapp/template.ts).
 * Daftar di mockup sudah usang — namanya lebih pendek sekarang.
 */
const VARIABEL: { nama: string; jelas: string; untuk?: KejadianWa[] }[] = [
  { nama: 'wali', jelas: 'Nama wali; "Bapak/Ibu" bila kosong' },
  { nama: 'siswa', jelas: 'Nama lengkap siswa' },
  { nama: 'kelas', jelas: 'Nama kelas, mis. VII-A' },
  { nama: 'tanggal', jelas: 'Selasa, 8 September 2026' },
  { nama: 'jam', jelas: 'Jam scan, mis. 07:22' },
  { nama: 'menit', jelas: 'Menit keterlambatan', untuk: ['TERLAMBAT'] },
  { nama: 'sekolah', jelas: 'Nama sekolah dari Pengaturan' },
  { nama: 'bulan', jelas: 'Periode rekap', untuk: ['REKAP'] },
  { nama: 'hadir', jelas: 'Jumlah hadir', untuk: ['REKAP'] },
  { nama: 'terlambat', jelas: 'Jumlah terlambat', untuk: ['REKAP'] },
  { nama: 'izin', jelas: 'Jumlah izin', untuk: ['REKAP'] },
  { nama: 'sakit', jelas: 'Jumlah sakit', untuk: ['REKAP'] },
  { nama: 'alpa', jelas: 'Jumlah alpa', untuk: ['REKAP'] },
  { nama: 'persen', jelas: 'Persentase kehadiran', untuk: ['REKAP'] },
];

export function TabTemplate() {
  const setting = useSemuaSetting();
  const simpan = useSimpanSetting();
  const [kejadian, setKejadian] = useState<KejadianWa>('TERLAMBAT');
  const [draf, setDraf] = useState<TemplateWa>({} as TemplateWa);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const pratinjauServer = usePratinjauTemplate(kejadian);

  const tersimpan = (setting.data?.['template_wa'] ?? {}) as TemplateWa;

  useEffect(() => {
    if (setting.data) setDraf(tersimpan);
    // Nilai dari server jadi titik awal; suntingan tidak ditimpa polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setting.data]);

  const isi = draf[kejadian] ?? '';
  const berubah = isi !== (tersimpan[kejadian] ?? '');

  /** Sisipkan {variabel} tepat di posisi kursor, bukan di ujung teks. */
  function sisipkan(nama: string) {
    const el = areaRef.current;
    const sisip = `{${nama}}`;
    if (!el) {
      setDraf((d) => ({ ...d, [kejadian]: (d[kejadian] ?? '') + sisip }));
      return;
    }
    const awal = el.selectionStart ?? isi.length;
    const akhir = el.selectionEnd ?? isi.length;
    const baru = isi.slice(0, awal) + sisip + isi.slice(akhir);
    setDraf((d) => ({ ...d, [kejadian]: baru }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(awal + sisip.length, awal + sisip.length);
    });
  }

  /**
   * Pratinjau dirender di klien dengan variabel contoh yang sama dengan
   * `pratinjau()` di backend, supaya berubah seketika saat diketik — memanggil
   * server tiap ketikan hanya menambah jeda tanpa menambah kebenaran.
   */
  const contoh: Record<string, string> = {
    siswa: 'Andi Pratama',
    kelas: 'VII-A',
    tanggal: 'Selasa, 8 September 2026',
    jam: '07:22',
    menit: '12',
    sekolah: (setting.data?.sekolah?.nama as string) ?? 'SMP Negeri 1 Contoh',
    bulan: 'September 2026',
    hadir: '18',
    terlambat: '2',
    izin: '1',
    sakit: '0',
    alpa: '1',
    persen: '90.9',
  };
  // Placeholder tak dikenal DIBIARKAN apa adanya — sama seperti backend, supaya
  // salah tulis langsung terlihat di pratinjau, bukan jadi teks kosong.
  const pratinjauLokal = isi.replace(/\{(\w+)\}/g, (utuh, k: string) => contoh[k] ?? utuh);
  const takDikenal = [...isi.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1]!)
    .filter((k) => !(k in contoh));

  if (setting.isPending) return <Skeleton className="h-96 w-full" />;

  const varTampil = VARIABEL.filter((v) => !v.untuk || v.untuk.includes(kejadian));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Template Pesan</CardTitle>
          <CardHint>klik variabel untuk menyisipkan</CardHint>
          <div className="ml-auto flex gap-2">
            {berubah && (
              <Button
                size="sm"
                onClick={() => setDraf((d) => ({ ...d, [kejadian]: tersimpan[kejadian] ?? '' }))}
              >
                <RotateCcwIcon />
                Batalkan
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              disabled={!berubah || !isi.trim() || simpan.isPending}
              onClick={() =>
                simpan.mutate(
                  { kunci: 'template_wa', nilai: draf },
                  {
                    onSuccess: () => {
                      toastSukses(`Template ${kejadian} disimpan`);
                      void pratinjauServer.refetch();
                    },
                    onError: (e) => toastGagal(e, 'Template gagal disimpan'),
                  },
                )
              }
            >
              {simpan.isPending && <Loader2Icon className="animate-spin" />}
              Simpan
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <Select value={kejadian} onValueChange={(v) => setKejadian(v as KejadianWa)}>
            <SelectTrigger aria-label="Pilih kejadian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KEJADIAN_WA.map((k) => (
                <SelectItem key={k} value={k}>
                  {k} — {KEJADIAN_LABEL[k].judul}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-[12.5px] text-muted-foreground">{KEJADIAN_LABEL[kejadian].jelas}</p>

          <Textarea
            ref={areaRef}
            value={isi}
            onChange={(e) => setDraf((d) => ({ ...d, [kejadian]: e.target.value }))}
            className="min-h-44 font-mono text-[12.5px] leading-relaxed"
            aria-label={`Template ${kejadian}`}
            placeholder="Tulis pesan yang akan diterima wali murid…"
          />

          {!isi.trim() && (
            <p className="text-[12.5px] font-medium text-alpa">
              Template kosong akan membuat notifikasi kejadian ini gagal disusun.
            </p>
          )}

          {takDikenal.length > 0 && (
            <p className="rounded-lg bg-terlambat-bg px-3 py-2 text-[12.5px] leading-relaxed text-terlambat">
              Variabel tidak dikenal: <b className="num">{[...new Set(takDikenal)].join(', ')}</b>.
              Backend membiarkannya apa adanya — jadi tulisan itu akan ikut terkirim ke wali murid.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">VARIABEL:</span>
            {varTampil.map((v) => (
              <button
                key={v.nama}
                type="button"
                title={v.jelas}
                onClick={() => sisipkan(v.nama)}
                className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary-ink transition-colors hover:brightness-95"
              >
                {`{${v.nama}}`}
              </button>
            ))}
          </div>

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Bungkus teks dengan tanda bintang untuk menebalkannya di WhatsApp — mis.{' '}
            <span className="font-mono">*{'{siswa}'}*</span>.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Pratinjau di HP Wali</CardTitle>
            {berubah && <Badge variant="warn">belum disimpan</Badge>}
          </CardHeader>
          <CardContent>
            <div data-uji="pratinjau-wa">
              <GelembungWa isi={pratinjauLokal} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versi tersimpan di server</CardTitle>
            <CardHint>hasil render backend</CardHint>
          </CardHeader>
          <CardContent>
            {pratinjauServer.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : pratinjauServer.isError ? (
              <p className="text-[12.5px] text-alpa">
                Template ini belum tersimpan di server, jadi belum bisa dipratinjau dari sana.
              </p>
            ) : (
              <pre className="max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                {pratinjauServer.data.isi}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
