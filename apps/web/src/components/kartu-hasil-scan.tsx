'use client';

import { CheckIcon, ClockIcon, LogOutIcon, ScanLineIcon, XIcon } from 'lucide-react';
import type { HasilScan } from '@siklon/shared';
import { cn } from '@/lib/utils';

/**
 * Kartu hasil scan untuk layar petugas gerbang (FE-024, FE-025).
 *
 * Ukurannya sengaja jauh lebih besar daripada tabel mana pun di aplikasi ini:
 * layar ini dibaca sambil berdiri, dari jarak sekitar dua meter, sambil
 * mengurus antrean. Nama siswa jadi elemen terbesar karena itu yang dipakai
 * petugas mencocokkan dengan orang di depannya.
 *
 * Warnanya mengikuti palet status yang sama dengan seluruh aplikasi:
 * hijau hadir, kuning terlambat, merah ditolak.
 */
export function KartuHasilScan({ hasil }: { hasil: HasilScan | null }) {
  if (!hasil) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-8 text-center">
        <ScanLineIcon className="size-12 text-faint" />
        <p className="text-xl font-semibold text-muted-foreground">Menunggu scan…</p>
        <p className="text-sm text-faint">
          Tempelkan kartu siswa ke pemindai di gerbang.
        </p>
      </div>
    );
  }

  /*
   * Absen pulang diberi nada sendiri (biru), bukan hijau seperti hadir.
   * Petugas gerbang sore hari perlu langsung tahu ini pulang, bukan datang —
   * dan warna itu yang terbaca lebih dulu dari jarak dua meter, sebelum
   * tulisannya sempat dibaca.
   */
  const nada = hasil.ok && hasil.jenis === 'PULANG'
    ? {
        bingkai: 'border-izin bg-izin-bg',
        teks: 'text-izin',
        Ikon: LogOutIcon,
        label: 'PULANG',
      }
    : !hasil.ok
    ? {
        bingkai: 'border-alpa bg-alpa-bg',
        teks: 'text-alpa',
        Ikon: XIcon,
        label: 'DITOLAK',
      }
    : hasil.status === 'TERLAMBAT'
      ? {
          bingkai: 'border-terlambat bg-terlambat-bg',
          teks: 'text-terlambat',
          Ikon: ClockIcon,
          label: 'TERLAMBAT',
        }
      : {
          bingkai: 'border-hadir bg-hadir-bg',
          teks: 'text-hadir',
          Ikon: CheckIcon,
          label: 'HADIR',
        };

  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'flex min-h-[280px] flex-col gap-4 rounded-xl border-2 p-6 sm:p-8',
        nada.bingkai,
      )}
    >
      {/*
        Boleh melipat. Kartu ini sekarang menempati kolom sempit (30% layar) di
        Konsol Scan; tanpa flex-wrap, jamnya terpotong di tepi kanan. Ukuran
        labelnya juga diturunkan — warna kartu sudah menyampaikan statusnya,
        yang harus tetap sebesar mungkin adalah namanya.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-full bg-white/60 dark:bg-black/25', nada.teks)}>
          <nada.Ikon className="size-6" strokeWidth={3} />
        </div>
        <div className={cn('text-2xl font-extrabold tracking-tight sm:text-3xl', nada.teks)}>
          {nada.label}
        </div>
        <div className={cn('num ml-auto text-2xl font-bold tabular-nums sm:text-3xl', nada.teks)}>
          {hasil.jam}
        </div>
      </div>

      {hasil.siswa ? (
        <div className="min-w-0">
          {/*
            Nama dibuat sebesar mungkin — ini yang dibaca dari jauh, dan
            satu-satunya hal yang dipakai petugas mencocokkan dengan orang di
            depannya. Karena itu ia MELIPAT, tidak dipotong: "Andi Prata…"
            tidak ada gunanya bagi siapa pun.
          */}
          <div className="text-4xl leading-tight font-extrabold break-words sm:text-5xl">
            {hasil.siswa.nama}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xl sm:text-2xl">
            <span className="font-bold">{hasil.siswa.kelas ?? 'Tanpa kelas'}</span>
            <span className="num text-muted-foreground">NIS {hasil.siswa.nis}</span>
          </div>
        </div>
      ) : (
        <div className="text-3xl font-extrabold sm:text-4xl">Kartu tidak dikenal</div>
      )}

      <div className={cn('mt-auto text-lg leading-snug font-semibold sm:text-xl', nada.teks)}>
        {hasil.pesan}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {/* Titik scan hanya ditampilkan kalau memang tercatat; scan lewat
            kamera tidak mencatat asalnya. */}
        {hasil.titikScan && (
          <span>
            Titik scan: <b className="num text-foreground">{hasil.titikScan}</b>
          </span>
        )}
        {hasil.jamPulang && (
          <span>
            Pulang: <b className="num text-foreground">{hasil.jamPulang}</b>
          </span>
        )}
        {hasil.terlambatMenit ? (
          <span>
            Terlambat <b className="num text-foreground">{hasil.terlambatMenit} menit</b>
          </span>
        ) : null}
        {hasil.waDiantrekan !== undefined && (
          <span>
            WhatsApp:{' '}
            <b className="text-foreground">
              {hasil.waDiantrekan ? 'diantrekan ke wali' : 'tidak dikirim'}
            </b>
          </span>
        )}
      </div>
    </div>
  );
}
