'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { StatusPresensi } from '@siklon/shared';
import { Button } from '@/components/ui/button';
import { warnaStatus } from '@/components/status-badge';
import { labelBulan, tanggalDalamBulan, NAMA_HARI_PENDEK } from '@/lib/tanggal';
import { cn } from '@/lib/utils';

export type SelKalender = {
  status?: StatusPresensi;
  jamMasuk?: string | null;
  jamPulang?: string | null;
  catatan?: string | null;
};

/**
 * Kalender kehadiran satu bulan.
 *
 * Tiap tanggal diwarnai sesuai statusnya memakai palet yang sama dengan
 * StatusBadge, jadi hijau di kalender berarti hal yang sama dengan hijau di
 * tabel. Hari libur dan hari di luar hari sekolah digambar berbeda — abu-abu
 * bergaris — supaya kotak kosong karena libur tidak terbaca sebagai alpa.
 */
export function KalenderKehadiran({
  bulan,
  onGantiBulan,
  data,
  libur,
  hariSekolah,
  hariIni,
}: {
  bulan: string;
  /** Bila tidak diisi, panah navigasi disembunyikan — tombol mati lebih buruk daripada tidak ada tombol. */
  onGantiBulan?: (arah: 'mundur' | 'maju') => void;
  /** Peta tanggal (YYYY-MM-DD) ke isi selnya. */
  data: Map<string, SelKalender>;
  /** Peta tanggal libur ke namanya. */
  libur: Map<string, string>;
  /** 0=Minggu … 6=Sabtu. Hari di luar daftar ini bukan hari sekolah. */
  hariSekolah: number[];
  hariIni?: string;
}) {
  const sel = tanggalDalamBulan(bulan);
  // Kotak kosong sebelum tanggal 1 supaya kolomnya jatuh di hari yang benar.
  const kosongAwal = sel[0]?.dow ?? 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {onGantiBulan ? (
          <Button size="icon-sm" onClick={() => onGantiBulan('mundur')} aria-label="Bulan sebelumnya">
            <ChevronLeftIcon />
          </Button>
        ) : (
          <span />
        )}
        <div className="text-sm font-semibold">{labelBulan(bulan)}</div>
        {onGantiBulan ? (
          <Button size="icon-sm" onClick={() => onGantiBulan('maju')} aria-label="Bulan berikutnya">
            <ChevronRightIcon />
          </Button>
        ) : (
          <span />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {NAMA_HARI_PENDEK.map((h, i) => (
          <div
            key={h}
            className={cn(
              'pb-1 text-center text-[10.5px] font-bold tracking-wide uppercase',
              hariSekolah.includes(i) ? 'text-muted-foreground' : 'text-faint',
            )}
          >
            {h}
          </div>
        ))}

        {Array.from({ length: kosongAwal }, (_, i) => (
          <div key={`kosong-${i}`} />
        ))}

        {sel.map((s) => {
          const isi = data.get(s.tanggal);
          const namaLibur = libur.get(s.tanggal);
          const bukanHariSekolah = !hariSekolah.includes(s.dow);
          const gaya = isi?.status ? warnaStatus(isi.status) : null;

          const judul = [
            s.tanggal,
            namaLibur ? `Libur: ${namaLibur}` : null,
            !namaLibur && bukanHariSekolah ? 'Bukan hari sekolah' : null,
            isi?.status ? warnaStatus(isi.status).label : null,
            isi?.jamMasuk ? `masuk ${isi.jamMasuk}` : null,
            isi?.jamPulang ? `pulang ${isi.jamPulang}` : null,
            isi?.catatan,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={s.tanggal}
              title={judul}
              className={cn(
                'relative grid aspect-square place-items-center rounded-md text-[12.5px] font-semibold',
                gaya
                  ? `${gaya.kelas}`
                  : namaLibur || bukanHariSekolah
                    ? 'bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)4px,transparent_4px,transparent_8px)] text-faint'
                    : 'bg-surface-2 text-faint',
                hariIni === s.tanggal && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
              )}
            >
              {s.hari}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA'] as StatusPresensi[]).map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', warnaStatus(st).titik)} />
            {warnaStatus(st).label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--neutral-bg),var(--neutral-bg)3px,transparent_3px,transparent_6px)] ring-1 ring-border" />
          Libur / bukan hari sekolah
        </span>
      </div>
    </div>
  );
}
