'use client';

import { RefreshCwIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import type { StatusSambungan } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';

/**
 * Status sambungan realtime (FE-023).
 *
 * Ditulis besar dan berwarna, bukan titik kecil di pojok: kalau socket putus,
 * layar konsol tetap menampilkan hasil scan terakhir dan tampak "normal"
 * padahal sudah tidak menerima apa-apa. Petugas harus tahu itu langsung.
 */
export function IndikatorSambungan({
  status,
  percobaan,
  alasan,
}: {
  status: StatusSambungan;
  percobaan: number;
  alasan: string | null;
}) {
  if (status === 'tersambung') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-hadir-bg px-2.5 py-1 text-xs font-semibold text-hadir">
        <WifiIcon className="size-3.5" />
        Tersambung
      </span>
    );
  }

  const menyambung = status === 'menyambung';
  return (
    <span
      role="alert"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        menyambung ? 'bg-terlambat-bg text-terlambat' : 'bg-alpa-bg text-alpa',
      )}
      title={alasan ?? undefined}
    >
      {menyambung ? (
        <RefreshCwIcon className="size-3.5 animate-spin" />
      ) : (
        <WifiOffIcon className="size-3.5" />
      )}
      {menyambung
        ? `Menyambung ulang${percobaan ? ` (percobaan ${percobaan})` : '…'}`
        : 'Terputus dari server'}
    </span>
  );
}

/** Spanduk lebar saat sambungan putus — tidak mungkin terlewat dari jauh. */
export function SpandukTerputus({ status }: { status: StatusSambungan }) {
  if (status === 'tersambung') return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl border-2 border-alpa bg-alpa-bg px-4 py-3 text-alpa"
    >
      <WifiOffIcon className="size-6 shrink-0" />
      <div>
        <div className="text-lg font-bold">Layar ini tidak menerima scan</div>
        <div className="text-sm">
          Sambungan ke server terputus. Presensi yang dipindai sekarang mungkin tidak tercatat —
          periksa jaringan dan jangan lanjutkan sampai tulisan ini hilang.
        </div>
      </div>
    </div>
  );
}
