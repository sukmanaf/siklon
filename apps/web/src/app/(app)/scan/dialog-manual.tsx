'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon, SearchIcon } from 'lucide-react';
import type { HasilScan } from '@siklon/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IdentitasSiswa } from '@/components/identitas-siswa';
import { useDaftarSiswa } from '@/hooks/use-siswa';
import { useDebounce } from '@/hooks/use-debounce';
import { usePresensiManual } from '@/hooks/use-presensi';
import { pesanError } from '@/lib/api';
import { hariIni } from '@/lib/tanggal';
import { toastGagal } from '@/lib/toast';
import type { Siswa } from '@/lib/tipe';
import { cn } from '@/lib/utils';

/** Jam saat ini "HH:MM" — dipakai sebagai isi awal kolom Jam masuk. */
function jamSekarang(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Alasan yang paling sering dipakai — mengetik ulang tiap pagi itu melelahkan. */
const ALASAN_CEPAT = [
  'Kartu tertinggal di rumah',
  'Kartu rusak / tidak terbaca',
  'Masuk lewat pintu tanpa scanner',
];

/**
 * Presensi manual (FE-031).
 *
 * Catatan wajib diisi — itu aturan server, dan alasannya kuat: presensi yang
 * dicatat tanpa scan harus bisa dipertanggungjawabkan saat orang tua bertanya
 * kenapa anaknya tercatat hadir.
 */
export function DialogManual({
  buka,
  onTutup,
  onHasil,
}: {
  buka: boolean;
  onTutup: () => void;
  onHasil: (hasil: HasilScan) => void;
}) {
  const [cari, setCari] = useState('');
  const cariTertunda = useDebounce(cari, 300);
  const [terpilih, setTerpilih] = useState<Siswa | null>(null);
  const [catatan, setCatatan] = useState('');
  /** Bisa diubah manual — pencatatannya sering baru dilakukan belakangan,
   * bukan persis saat siswanya datang, jadi jam saat tombol diklik belum
   * tentu jam masuk yang benar. */
  const [jam, setJam] = useState(jamSekarang);
  const manual = usePresensiManual();

  const daftar = useDaftarSiswa({
    cari: cariTertunda || undefined,
    aktif: true,
    perPage: 8,
  });

  useEffect(() => {
    if (buka) return;
    setCari('');
    setTerpilih(null);
    setCatatan('');
    manual.reset();
    // manual sengaja tidak jadi dependensi: objeknya baru tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka]);

  // Jam-nya sengaja disetel ulang ke "sekarang" tiap dialog DIBUKA (bukan
  // ditutup) — supaya kalau dialog dibuka lagi nanti untuk siswa lain, jam
  // yang tertinggal dari pengisian sebelumnya tidak ikut kebawa.
  useEffect(() => {
    if (buka) setJam(jamSekarang());
  }, [buka]);

  function kirim() {
    if (!terpilih || !catatan.trim()) return;
    // WIB = UTC+7 tetap sepanjang tahun (tidak ada DST di Indonesia), jadi
    // aman ditulis langsung tanpa perlu Date/Intl untuk zona waktu.
    const waktu = `${hariIni()}T${jam}:00+07:00`;
    manual.mutate(
      { nis: terpilih.nis, catatan: catatan.trim(), waktu },
      {
        onSuccess: (hasil) => {
          onHasil(hasil);
          onTutup();
        },
        onError: (e) => toastGagal(e, 'Presensi manual gagal'),
      },
    );
  }

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Presensi manual</DialogTitle>
          <DialogDescription>
            Untuk siswa yang kartunya tertinggal atau rusak. Statusnya tetap dihitung dengan
            aturan jam masuk yang sama seperti scan biasa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cari-siswa-manual">Cari siswa</Label>
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
              <Input
                id="cari-siswa-manual"
                autoFocus
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  setTerpilih(null);
                }}
                placeholder="Nama atau NIS…"
                className="pl-8"
              />
            </div>
          </div>

          {!terpilih && cariTertunda && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {daftar.isPending && (
                <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" /> Mencari…
                </div>
              )}
              {!daftar.isPending && daftar.data?.items.length === 0 && (
                <p className="px-3 py-3 text-[13px] text-muted-foreground">
                  Tidak ada siswa aktif yang cocok.
                </p>
              )}
              {daftar.data?.items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTerpilih(s)}
                  className="flex w-full items-center border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2"
                >
                  <IdentitasSiswa
                    nama={s.full_name}
                    nis={s.nis}
                    kelas={s.classes?.name ?? null}
                    ukuran="sm"
                  />
                </button>
              ))}
            </div>
          )}

          {terpilih && (
            <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary-soft p-3">
              <IdentitasSiswa
                nama={terpilih.full_name}
                nis={terpilih.nis}
                kelas={terpilih.classes?.name ?? null}
              />
              <Button size="sm" className="ml-auto" onClick={() => setTerpilih(null)}>
                Ganti
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="jam-manual">Jam masuk</Label>
            <Input
              id="jam-manual"
              type="time"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
              className="w-32"
            />
            <p className="text-[11.5px] text-muted-foreground">
              Default jam saat ini — ubah kalau presensinya baru dicatat belakangan, bukan persis
              saat siswanya datang.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catatan-manual">
              Alasan<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ALASAN_CEPAT.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setCatatan(a)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                    catatan === a
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
            <Textarea
              id="catatan-manual"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Kenapa presensinya dicatat tanpa scan?"
              className="min-h-16"
            />
          </div>

          {manual.isError && (
            <p className="rounded-lg bg-alpa-bg px-3.5 py-2.5 text-[12.5px] font-medium text-alpa">
              {pesanError(manual.error)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onTutup} disabled={manual.isPending}>
            Batal
          </Button>
          <Button
            variant="default"
            disabled={!terpilih || !catatan.trim() || manual.isPending}
            onClick={kirim}
          >
            {manual.isPending && <Loader2Icon className="animate-spin" />}
            Catat presensi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
