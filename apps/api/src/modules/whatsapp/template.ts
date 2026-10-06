import type { KejadianWa } from '@siklon/shared';
import { logger } from '../../config/logger.js';
import { NAMA_HARI } from '@siklon/shared';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { hariLokal, jamLokal } from '../../lib/waktu.js';

export type Variabel = Record<string, string | number>;

export const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** 'Selasa, 8 September 2026' */
export function tanggalPanjang(d: Date): string {
  const hari = NAMA_HARI[hariLokal(d)] ?? '';
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const [th, bl, tg] = iso.split('-');
  return `${hari}, ${Number(tg)} ${BULAN[Number(bl) - 1]} ${th}`;
}

/**
 * Ganti {placeholder} dengan nilainya.
 *
 * Placeholder yang tidak dikenal DIBIARKAN apa adanya, bukan dikosongkan.
 * Alasannya: kalau admin salah menulis {nama_siswa} padahal variabelnya {siswa},
 * pesan yang dikosongkan berbunyi "Ananda  telah HADIR" dan salahnya tidak
 * jelas dari mana. Dibiarkan terlihat, kesalahannya langsung ketahuan saat pratinjau —
 * dan sekaligus tercatat sebagai peringatan di log.
 */
export function render(template: string, vars: Variabel): string {
  const tidakDikenal: string[] = [];

  const hasil = template.replace(/\{(\w+)\}/g, (utuh, kunci: string) => {
    if (kunci in vars) return String(vars[kunci]);
    tidakDikenal.push(kunci);
    return utuh;
  });

  if (tidakDikenal.length > 0) {
    logger.warn(
      { tidakDikenal: [...new Set(tidakDikenal)] },
      'Template WhatsApp memuat variabel yang tidak dikenal — periksa di halaman Pengaturan',
    );
  }
  return hasil;
}

export type KonteksPesan = {
  kejadian: KejadianWa;
  namaSiswa: string;
  kelas: string | null;
  waktu: Date;
  menitTerlambat?: number;
  /** Dipakai template REKAP. */
  rekap?: {
    bulan: string;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alpa: number;
    persen: number;
  };
};

/** Susun isi pesan final dari template yang tersimpan di settings. */
export async function susunPesan(k: KonteksPesan): Promise<string> {
  const [templates, sekolah] = await Promise.all([
    ambilSetting('template_wa'),
    ambilSetting('sekolah'),
  ]);

  const template = templates[k.kejadian];
  if (!template) {
    throw new Error(`Template WhatsApp untuk kejadian "${k.kejadian}" belum ada di Pengaturan`);
  }

  const vars: Variabel = {
    siswa: k.namaSiswa,
    kelas: k.kelas ?? '-',
    tanggal: tanggalPanjang(k.waktu),
    jam: jamLokal(k.waktu),
    menit: k.menitTerlambat ?? 0,
    sekolah: sekolah.nama,
    ...(k.rekap ?? {}),
  };

  return render(template, vars);
}

/** Pratinjau tanpa menyimpan apa pun — dipakai halaman editor template. */
export async function pratinjau(kejadian: KejadianWa): Promise<string> {
  return susunPesan({
    kejadian,
    namaSiswa: 'Andi Pratama',
    kelas: 'VII-A',
    waktu: new Date(),
    menitTerlambat: 12,
    rekap: { bulan: 'September 2026', hadir: 18, terlambat: 2, izin: 1, sakit: 0, alpa: 1, persen: 90.9 },
  });
}
