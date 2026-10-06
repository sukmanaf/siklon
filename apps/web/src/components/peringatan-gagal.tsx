'use client';

import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pesanError } from '@/lib/api';

/**
 * Pemberitahuan ringkas saat data pendukung gagal dimuat (FE-043).
 *
 * Dipakai di halaman yang tetap bisa dibuka walau sebagian datanya gagal —
 * mis. daftar kelas untuk filter. Tanpa ini, halamannya terlihat "normal tapi
 * kosong" dan pengguna mengira memang belum ada datanya, bukan bahwa
 * servernya tidak terjangkau.
 */
export function PeringatanGagal({
  judul,
  error,
  onCobaLagi,
}: {
  judul: string;
  error: unknown;
  onCobaLagi?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-2 rounded-lg border border-alpa/30 bg-alpa-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-alpa"
    >
      <TriangleAlertIcon className="mt-px size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <b>{judul}</b> {pesanError(error)}
      </span>
      {onCobaLagi && (
        <Button size="sm" onClick={onCobaLagi}>
          <RefreshCwIcon />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
