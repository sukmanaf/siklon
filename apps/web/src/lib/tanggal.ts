/**
 * Bantuan tanggal untuk tampilan.
 *
 * Semua tanggal dari API sudah berupa string `YYYY-MM-DD` dalam zona
 * Asia/Jakarta. Perhitungan di sini memakai UTC secara sengaja: `new Date('2026-09-01')`
 * ditafsirkan sebagai tengah malam UTC, dan kalau dibaca dengan getDate() lokal
 * bisa mundur sehari di zona barat. Dengan UTC, tanggalnya tetap apa adanya.
 */

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const NAMA_HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** "2026-09" -> "September 2026" */
export function labelBulan(ym: string) {
  const [t, b] = ym.split('-').map(Number);
  return `${NAMA_BULAN[(b ?? 1) - 1]} ${t}`;
}

/** Bulan berjalan dalam bentuk "YYYY-MM" menurut jam perangkat pemakai. */
export function bulanIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function geserBulan(ym: string, delta: number) {
  const [t, b] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(t!, (b ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const awalBulan = (ym: string) => `${ym}-01`;

export function akhirBulan(ym: string) {
  const [t, b] = ym.split('-').map(Number);
  const hari = new Date(Date.UTC(t!, b!, 0)).getUTCDate();
  return `${ym}-${String(hari).padStart(2, '0')}`;
}

export type SelBulan = { tanggal: string; hari: number; dow: number };

/** Semua tanggal dalam satu bulan, lengkap dengan hari apa (0=Minggu). */
export function tanggalDalamBulan(ym: string): SelBulan[] {
  const [t, b] = ym.split('-').map(Number);
  const jumlah = new Date(Date.UTC(t!, b!, 0)).getUTCDate();
  return Array.from({ length: jumlah }, (_, i) => {
    const hari = i + 1;
    const d = new Date(Date.UTC(t!, b! - 1, hari));
    return {
      tanggal: `${ym}-${String(hari).padStart(2, '0')}`,
      hari,
      dow: d.getUTCDay(),
    };
  });
}

/** "2026-09-08" -> "8 Sep 2026" */
export function tanggalPendek(iso: string) {
  const [t, b, h] = iso.split('-').map(Number);
  return `${h} ${NAMA_BULAN[(b ?? 1) - 1]?.slice(0, 3)} ${t}`;
}

/** "07:00" + 10 menit -> "07:10". Mengembalikan null bila jamnya tidak valid. */
export function tambahMenit(jam: string, menit: number): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(jam);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + menit;
  // Dibiarkan berputar dalam satu hari; batas terlambat lewat tengah malam
  // tidak masuk akal, tapi lebih baik menampilkan angka daripada crash.
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Selisih menit antara dua jam "HH:MM". */
export function selisihMenit(dari: string, sampai: string): number {
  const p = (j: string) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5));
  return p(sampai) - p(dari);
}
