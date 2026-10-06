import { cn } from '@/lib/utils';
import type { StatusPresensi } from '@siklon/shared';

/**
 * Satu-satunya tempat status presensi diberi warna dan label.
 *
 * Kalau ada halaman yang butuh warna status, halaman itu memakai komponen ini
 * — bukan menuliskan sendiri kelas warnanya. Itu yang menjaga HADIR selalu
 * hijau dan ALPA selalu merah di seluruh aplikasi (FE-002).
 */
const GAYA: Record<StatusPresensi | 'LIBUR', { label: string; kelas: string; titik: string }> = {
  HADIR: { label: 'Hadir', kelas: 'bg-hadir-bg text-hadir', titik: 'bg-hadir' },
  TERLAMBAT: { label: 'Terlambat', kelas: 'bg-terlambat-bg text-terlambat', titik: 'bg-terlambat' },
  IZIN: { label: 'Izin', kelas: 'bg-izin-bg text-izin', titik: 'bg-izin' },
  SAKIT: { label: 'Sakit', kelas: 'bg-sakit-bg text-sakit', titik: 'bg-sakit' },
  ALPA: { label: 'Alpa', kelas: 'bg-alpa-bg text-alpa', titik: 'bg-alpa' },
  LIBUR: { label: 'Libur', kelas: 'bg-libur-bg text-libur', titik: 'bg-libur' },
};

export type StatusBadgeNilai = keyof typeof GAYA;

export function StatusBadge({
  status,
  titik = true,
  keterangan,
  className,
}: {
  status: StatusBadgeNilai;
  /** Titik warna di kiri label. Matikan untuk tempat yang sangat sempit. */
  titik?: boolean;
  /** Tambahan di belakang label, mis. "12 mnt" untuk keterlambatan. */
  keterangan?: string;
  className?: string;
}) {
  const gaya = GAYA[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-relaxed font-semibold whitespace-nowrap',
        gaya.kelas,
        className,
      )}
    >
      {titik && <span className={cn('size-1.5 shrink-0 rounded-full', gaya.titik)} />}
      {gaya.label}
      {keterangan && <span className="font-medium opacity-80">· {keterangan}</span>}
    </span>
  );
}

/** Warna status untuk keperluan di luar badge (kalender, grafik, kartu scan). */
export function warnaStatus(status: StatusBadgeNilai) {
  return GAYA[status];
}
