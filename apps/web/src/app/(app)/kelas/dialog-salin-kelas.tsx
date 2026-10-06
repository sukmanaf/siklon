'use client';

import { useEffect, useState } from 'react';
import { CopyIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDaftarTahunAjaran, useTahunAjaranAktif } from '@/hooks/use-akademik';
import { useSalinKelas } from '@/hooks/use-kelas';
import { toastGagal, toastSukses } from '@/lib/toast';

/**
 * Menyalin kerangka kelas ke tahun ajaran lain.
 *
 * Kelas terikat ke tahun ajaran, jadi tahun baru selalu mulai kosong. Tanpa
 * ini, admin membuat ulang enam kelas dengan nama yang sama persis tiap
 * pergantian tahun — pekerjaan berulang yang tidak menambah apa pun.
 */
export function DialogSalinKelas({
  buka,
  jumlahKelas,
  onTutup,
}: {
  buka: boolean;
  /** Berapa kelas yang ada di tahun aktif — yang akan disalin. */
  jumlahKelas: number;
  onTutup: () => void;
}) {
  const tahunAktif = useTahunAjaranAktif();
  const daftarTahun = useDaftarTahunAjaran();
  const salin = useSalinKelas();
  const [keTahunId, setKeTahunId] = useState<string>('');

  useEffect(() => {
    if (!buka) setKeTahunId('');
  }, [buka]);

  const lain = (daftarTahun.data ?? []).filter((t) => t.id !== tahunAktif.data?.id);
  const terpilih = lain.find((t) => String(t.id) === keTahunId);

  function jalankan() {
    salin.mutate(
      { keTahunId: Number(keTahunId) },
      {
        onSuccess: (h) => {
          toastSukses(
            `${h.dibuat} kelas disalin ke ${h.tahunTujuan}`,
            h.dilewati > 0
              ? `${h.dilewati} kelas dilewati karena namanya sudah ada di sana.`
              : undefined,
          );
          onTutup();
        },
        onError: (e) => toastGagal(e, 'Penyalinan kelas gagal'),
      },
    );
  }

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Salin kelas ke tahun ajaran lain</DialogTitle>
          <DialogDescription>
            Menyalin <b>nama dan tingkat</b> kelas dari tahun ajaran aktif ke tahun lain. Siswanya
            tidak ikut — memindahkan siswa dilakukan lewat <b>Kenaikan Kelas</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {tahunAktif.data ? (
              <>
                Yang disalin: <b className="num">{jumlahKelas}</b> kelas dari tahun{' '}
                <b>{tahunAktif.data.name}</b>.
              </>
            ) : (
              'Memuat tahun ajaran…'
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ke-tahun">Salin ke tahun ajaran</Label>
            <Select value={keTahunId} onValueChange={setKeTahunId}>
              <SelectTrigger id="ke-tahun">
                <SelectValue placeholder="Pilih tahun ajaran tujuan" />
              </SelectTrigger>
              <SelectContent>
                {lain.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lain.length === 0 && (
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-terlambat">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                <span>
                  Belum ada tahun ajaran lain. Buat dulu di <b>Pengaturan → Tahun Ajaran</b>.
                </span>
              </p>
            )}
          </div>

          {terpilih && (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Kelas yang namanya sudah ada di <b>{terpilih.name}</b> akan dilewati, bukan
              digandakan — jadi aman kalau dijalankan dua kali.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onTutup} disabled={salin.isPending}>
            Batal
          </Button>
          <Button
            variant="default"
            disabled={!keTahunId || salin.isPending || jumlahKelas === 0}
            onClick={jalankan}
          >
            {salin.isPending ? <Loader2Icon className="animate-spin" /> : <CopyIcon />}
            Salin kelas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
