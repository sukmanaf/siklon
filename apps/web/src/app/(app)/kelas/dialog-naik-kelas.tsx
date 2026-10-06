'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useDaftarKelas, useNaikkanKelas } from '@/hooks/use-kelas';
import { useDaftarTahunAjaran, useTahunAjaranAktif } from '@/hooks/use-akademik';
import { toastGagal, toastSukses } from '@/lib/toast';
import type { Kelas } from '@/lib/tipe';

const LEWATI = '__lewati__';

/**
 * Menebak kelas tujuan: tingkat naik satu, sisa nama tetap.
 * "VII-A" (tingkat 7) -> cari kelas tingkat 8 yang akhirannya juga "A".
 * Tebakan ini hanya titik awal — operator tetap bisa mengubahnya.
 */
function tebakTujuan(asal: Kelas, semua: Kelas[]): string {
  if (asal.grade_level == null) return LEWATI;
  const akhiran = asal.name.replace(/^[^-\s]*[-\s]?/, '').trim().toUpperCase();
  const kandidat = semua.filter((k) => k.grade_level === asal.grade_level! + 1);
  const cocok = kandidat.find(
    (k) => k.name.replace(/^[^-\s]*[-\s]?/, '').trim().toUpperCase() === akhiran,
  );
  return cocok?.id ?? LEWATI;
}

export function DialogNaikKelas({
  buka,
  kelas,
  onTutup,
}: {
  buka: boolean;
  kelas: Kelas[];
  onTutup: () => void;
}) {
  const naikkan = useNaikkanKelas();
  const tahunAktif = useTahunAjaranAktif();
  const daftarTahun = useDaftarTahunAjaran();
  const [tahunTujuanId, setTahunTujuanId] = useState<number | null>(null);
  const [tujuan, setTujuan] = useState<Record<string, string>>({});
  const [konfirmasi, setKonfirmasi] = useState(false);

  /*
   * Kelas TUJUAN belum tentu se-tahun dengan kelas asal.
   *
   * Kenaikan kelas yang sesungguhnya terjadi tepat di pergantian tahun ajaran:
   * VII-A 2026/2027 naik ke VIII-A 2027/2028. Selama dialog ini hanya
   * menawarkan kelas tahun aktif, pergantian tahun tidak bisa dikerjakan
   * dari layar sama sekali.
   */
  const tahunAsalId = tahunAktif.data?.id ?? null;
  const pakaiTahunLain = tahunTujuanId !== null && tahunTujuanId !== tahunAsalId;
  const kelasTahunLain = useDaftarKelas(pakaiTahunLain ? tahunTujuanId! : undefined);
  const kelasTujuan = pakaiTahunLain ? (kelasTahunLain.data ?? []) : kelas;
  const namaTahunTujuan =
    daftarTahun.data?.find((t) => t.id === tahunTujuanId)?.name ?? null;

  // Kelas tanpa siswa tidak perlu ditawarkan — tidak ada yang bisa dipindahkan.
  const asal = useMemo(
    () =>
      [...kelas]
        .filter((k) => k._count.students > 0)
        .sort((a, b) => (b.grade_level ?? 0) - (a.grade_level ?? 0) || a.name.localeCompare(b.name)),
    [kelas],
  );

  // Tahun tujuan bawaan = tahun aktif, yaitu perilaku lama.
  useEffect(() => {
    if (buka && tahunTujuanId === null && tahunAsalId !== null) setTahunTujuanId(tahunAsalId);
  }, [buka, tahunTujuanId, tahunAsalId]);

  useEffect(() => {
    if (!buka) {
      setKonfirmasi(false);
      return;
    }
    setTujuan(Object.fromEntries(asal.map((k) => [k.id, tebakTujuan(k, kelasTujuan)])));
  }, [buka, asal, kelasTujuan]);

  const pasangan = asal
    .filter((k) => tujuan[k.id] && tujuan[k.id] !== LEWATI)
    .map((k) => ({
      dariKelasId: k.id,
      keKelasId: tujuan[k.id]!,
      dari: k,
      ke: kelasTujuan.find((x) => x.id === tujuan[k.id])!,
    }));

  const totalSiswa = pasangan.reduce((t, p) => t + p.dari._count.students, 0);
  const kelasTertinggi = asal.filter((k) => tujuan[k.id] === LEWATI);

  function jalankan() {
    naikkan.mutate(
      pasangan.map(({ dariKelasId, keKelasId }) => ({ dariKelasId, keKelasId })),
      {
        onSuccess: (hasil) => {
          const total = hasil.reduce((t, h) => t + h.jumlah, 0);
          toastSukses(
            `${total} siswa naik kelas`,
            hasil.map((h) => `${h.dari} → ${h.ke}: ${h.jumlah}`).join(' · '),
          );
          onTutup();
        },
        onError: (e) => toastGagal(e, 'Kenaikan kelas gagal'),
      },
    );
  }

  return (
    <Dialog open={buka} onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kenaikan kelas massal</DialogTitle>
          <DialogDescription>
            Memindahkan seluruh siswa aktif dari kelas asal ke kelas tujuan sekaligus. Riwayat
            presensi lama tidak ikut berubah — laporan bulan-bulan lalu tetap menampilkan kelas
            yang benar.
          </DialogDescription>
        </DialogHeader>

        {!konfirmasi && (
          <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            <Label htmlFor="tahun-tujuan" className="text-[13px] text-foreground">
              Kelas tujuan diambil dari tahun ajaran
            </Label>
            <Select
              value={tahunTujuanId === null ? '' : String(tahunTujuanId)}
              onValueChange={(v) => setTahunTujuanId(Number(v))}
            >
              <SelectTrigger id="tahun-tujuan" className="w-full sm:w-64">
                <SelectValue placeholder="Pilih tahun ajaran" />
              </SelectTrigger>
              <SelectContent>
                {daftarTahun.data?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.is_active ? ' — aktif' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {pakaiTahunLain && (
              <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-terlambat">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                <span>
                  Siswa akan pindah ke kelas tahun <b>{namaTahunTujuan}</b>. Selama tahun itu
                  belum diaktifkan, kelas tahun berjalan akan terlihat <b>kosong</b> — siswanya
                  tidak hilang, hanya sudah tercatat di tahun berikutnya. Aktifkan tahun{' '}
                  <b>{namaTahunTujuan}</b> di halaman Pengaturan setelah ini.
                </span>
              </div>
            )}

            {pakaiTahunLain && kelasTahunLain.data?.length === 0 && (
              <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-alpa">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                <span>
                  Tahun <b>{namaTahunTujuan}</b> belum punya kelas sama sekali. Tutup dialog ini,
                  lalu pakai <b>Salin kelas ke tahun lain</b> untuk membuat kerangkanya dulu.
                </span>
              </div>
            )}
          </div>
        )}

        {!konfirmasi ? (
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {asal.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Belum ada kelas yang berisi siswa.
              </p>
            )}

            {asal.map((k) => (
              <div key={k.id} className="flex items-center gap-2.5">
                <div className="w-36 shrink-0">
                  <div className="text-[13px] font-semibold">{k.name}</div>
                  <div className="num text-xs text-muted-foreground">
                    {k._count.students} siswa
                  </div>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-faint" />
                <Select
                  value={tujuan[k.id] ?? LEWATI}
                  onValueChange={(v) => setTujuan((t) => ({ ...t, [k.id]: v }))}
                >
                  <SelectTrigger aria-label={`Kelas tujuan untuk ${k.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LEWATI}>— Tidak dipindahkan —</SelectItem>
                    {kelasTujuan
                      .filter((x) => x.id !== k.id)
                      .map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : (
          /* Pratinjau: apa persisnya yang akan terjadi, sebelum dijalankan. */
          <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
            <ul className="space-y-1.5">
              {pasangan.map((p) => (
                <li key={p.dariKelasId} className="text-[13px]">
                  <b className="num">{p.dari._count.students} siswa</b> akan dipindahkan dari{' '}
                  <b>{p.dari.name}</b> ke <b>{p.ke.name}</b>
                  {pakaiTahunLain && <> tahun <b>{namaTahunTujuan}</b></>}
                </li>
              ))}
            </ul>

            {kelasTertinggi.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-terlambat-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-terlambat">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                <span>
                  Tidak dipindahkan:{' '}
                  <b>{kelasTertinggi.map((k) => `${k.name} (${k._count.students})`).join(', ')}</b>.
                  Kalau ini kelas terakhir yang lulus, nonaktifkan siswanya lewat halaman Siswa
                  supaya kartunya tidak bisa dipakai absen lagi.
                </span>
              </div>
            )}

            <p className="text-[12.5px] text-muted-foreground">
              Total <b className="num">{totalSiswa}</b> siswa akan berpindah. Tindakan ini berjalan
              dalam satu transaksi — semuanya berhasil, atau tidak ada yang berubah.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => (konfirmasi ? setKonfirmasi(false) : onTutup())}
            disabled={naikkan.isPending}
          >
            {konfirmasi ? 'Kembali' : 'Batal'}
          </Button>
          {!konfirmasi ? (
            <Button
              variant="default"
              disabled={pasangan.length === 0}
              onClick={() => setKonfirmasi(true)}
            >
              Lihat pratinjau
            </Button>
          ) : (
            <Button variant="default" disabled={naikkan.isPending} onClick={jalankan}>
              {naikkan.isPending && <Loader2Icon className="animate-spin" />}
              Jalankan kenaikan kelas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
