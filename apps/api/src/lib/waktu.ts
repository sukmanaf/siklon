import { ZONA_WAKTU } from '@siklon/shared';

/**
 * Semua fungsi di sini memakai zona waktu Asia/Jakarta secara EKSPLISIT,
 * tidak bergantung pada TZ server.
 *
 * Alasannya penting: `new Date().toISOString().slice(0, 10)` memberi tanggal
 * UTC. Pada pukul 06:30 WIB tanggal UTC-nya masih benar, tapi pada 00:30 WIB
 * tanggal UTC sudah HARI SEBELUMNYA. Kalau ada scan susulan atau job berjalan
 * lewat tengah malam, presensinya akan tercatat di tanggal yang salah.
 */

const fmtTanggal = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_WAKTU,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fmtJam = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_WAKTU,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const fmtJamDetik = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_WAKTU,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** 'YYYY-MM-DD' menurut waktu Jakarta. */
export const tanggalLokal = (d: Date = new Date()): string => fmtTanggal.format(d);

/** 'HH:MM' menurut waktu Jakarta. */
export const jamLokal = (d: Date = new Date()): string => fmtJam.format(d);

/** 'HH:MM:SS' menurut waktu Jakarta. */
export const jamDetikLokal = (d: Date = new Date()): string => fmtJamDetik.format(d);

/** Menit sejak tengah malam menurut waktu Jakarta. 07:22 -> 442 */
export function menitDalamHari(d: Date = new Date()): number {
  const [j, m] = fmtJam.format(d).split(':');
  return Number(j) * 60 + Number(m);
}

/** Hari dalam seminggu menurut waktu Jakarta. 0 = Minggu, 6 = Sabtu. */
export function hariLokal(d: Date = new Date()): number {
  const nama = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_WAKTU, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nama);
}

/** '07:30' -> 450 menit. Melempar bila formatnya salah. */
export function jamKeMenit(jam: string): number {
  const cocok = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(jam);
  if (!cocok) throw new Error(`Format jam tidak valid: "${jam}". Harus HH:MM.`);
  return Number(cocok[1]) * 60 + Number(cocok[2]);
}

/** 450 -> '07:30' */
export function menitKeJam(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Ubah 'YYYY-MM-DD' menjadi Date yang mewakili TENGAH MALAM di Jakarta.
 * Dipakai untuk kolom DATE di database supaya tidak bergeser sehari.
 */
export function tanggalKeDate(tanggal: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new Error(`Format tanggal tidak valid: "${tanggal}". Harus YYYY-MM-DD.`);
  }
  // Jakarta = UTC+7 tanpa DST, jadi tengah malam lokal = 17:00 UTC hari sebelumnya.
  // Memakai UTC eksplisit agar hasilnya sama di server mana pun.
  return new Date(`${tanggal}T00:00:00.000+07:00`);
}

/**
 * Untuk kolom bertipe DATE (attendance_date, holiday_date).
 *
 * Prisma memetakan kolom DATE ke Date pada TENGAH MALAM UTC. Memakai
 * tanggalKeDate() di sini membuat nilainya bergeser sehari — persis bug yang
 * membuat pencarian hari libur 17 Agustus tidak pernah cocok.
 */
export function tanggalKeKolomDate(tanggal: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new Error(`Format tanggal tidak valid: "${tanggal}". Harus YYYY-MM-DD.`);
  }
  return new Date(`${tanggal}T00:00:00.000Z`);
}

/** Baca kembali kolom DATE menjadi 'YYYY-MM-DD'. Harus UTC, bukan lokal. */
export function kolomDateKeTanggal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Rentang [awal, akhir) satu hari lokal, untuk query timestamptz. */
export function rentangHari(tanggal: string): { awal: Date; akhir: Date } {
  const awal = tanggalKeDate(tanggal);
  const akhir = new Date(awal.getTime() + 24 * 60 * 60 * 1000);
  return { awal, akhir };
}
