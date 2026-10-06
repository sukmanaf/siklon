import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Inisial untuk avatar: "Admin Tata Usaha" -> "AT". */
export function inisial(nama: string) {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return '?';
  if (bagian.length === 1) return bagian[0]!.slice(0, 2).toUpperCase();
  return (bagian[0]![0]! + bagian[bagian.length - 1]![0]!).toUpperCase();
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "Selasa, 8 September 2026" */
export function tanggalPanjang(d: Date) {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "8 Sep 07:02" — dipakai kolom tabel yang sempit. */
export function tanggalJamSingkat(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const bulan = BULAN[d.getMonth()]!.slice(0, 3);
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${bulan} ${jam}:${menit}`;
}
