import { DEFAULT_TEMPLATE_WA, type KejadianWa, NAMA_HARI } from '@siklon/shared';
import { logger } from '../../config/logger.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { hariLokal, jamLokal, jamDetikLokal } from '../../lib/waktu.js';

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
 * Urai format Spintax {opsi1|opsi2|opsi3}.
 * Memilih salah satu opsi secara acak untuk memvariasikan isi pesan,
 * sehingga pola teks ratusan pesan tidak terbaca identik oleh sistem anti-spam Meta.
 */
export function uraiSpintax(teks: string): string {
  let hasil = teks;
  const pola = /\{([^{}]+?\|[^{}]+?)\}/g;
  while (pola.test(hasil)) {
    hasil = hasil.replace(pola, (_, opsi: string) => {
      const pilihan = opsi.split('|');
      const terpilih = pilihan[Math.floor(Math.random() * pilihan.length)];
      return (terpilih ?? '').trim();
    });
  }
  return hasil;
}

/**
 * Ganti {placeholder} dengan nilainya dan urai spintax.
 *
 * Placeholder yang tidak dikenal DIBIARKAN apa adanya, bukan dikosongkan.
 * Alasannya: kalau admin salah menulis {nama_siswa} padahal variabelnya {siswa},
 * pesan yang dikosongkan berbunyi "Ananda  telah HADIR" dan salahnya tidak
 * jelas dari mana. Dibiarkan terlihat, kesalahannya langsung ketahuan saat pratinjau —
 * dan sekaligus tercatat sebagai peringatan di log.
 */
export function render(template: string, vars: Variabel): string {
  // 1. Eksekusi variasi Spintax terlebih dahulu
  const templateBervariasi = uraiSpintax(template);

  const tidakDikenal: string[] = [];

  // 2. Ganti variabel {kunci}
  const hasil = templateBervariasi.replace(/\{(\w+)\}/g, (utuh, kunci: string) => {
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
  catatan?: string | null;
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

  const template = templates[k.kejadian] ?? DEFAULT_TEMPLATE_WA[k.kejadian];
  if (!template) {
    throw new Error(`Template WhatsApp untuk kejadian "${k.kejadian}" belum ada di Pengaturan`);
  }

  const vars: Variabel = {
    siswa: k.namaSiswa,
    kelas: k.kelas ?? '-',
    tanggal: tanggalPanjang(k.waktu),
    jam: jamLokal(k.waktu),
    menit: k.menitTerlambat ?? 0,
    catatan: k.catatan || '-',
    sekolah: sekolah.nama,
    ...(k.rekap ?? {}),
  };

  const pesanTersusun = render(template, vars);

  // Penanda unik otomatis (Ref Hash & Detik Scan)
  // Menjamin string pesan selalu memiliki checksum/hash yang 100% berbeda di radar Meta.
  if (!pesanTersusun.includes('Ref #') && !pesanTersusun.includes('ID #')) {
    const ref = Math.random().toString(36).substring(2, 6).toUpperCase();
    const detik = jamDetikLokal(k.waktu);
    return `${pesanTersusun}\n\n_Ref: #${ref} • ${detik} WIB_`;
  }

  return pesanTersusun;
}

/** Pratinjau tanpa menyimpan apa pun — dipakai halaman editor template. */
export async function pratinjau(kejadian: KejadianWa): Promise<string> {
  return susunPesan({
    kejadian,
    namaSiswa: 'Andi Pratama',
    kelas: 'VII-A',
    waktu: new Date(),
    menitTerlambat: 12,
    catatan: 'Surat dokter',
    rekap: { bulan: 'September 2026', hadir: 18, terlambat: 2, izin: 1, sakit: 0, alpa: 1, persen: 90.9 },
  });
}
