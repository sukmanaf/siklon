/**
 * Normalisasi nomor telepon Indonesia ke format E.164 tanpa tanda '+'.
 * Contoh yang semuanya harus jadi "6281234567890":
 *   0812-3456-7890 · +62 812 3456 7890 · 62812 3456 7890 · (0812) 34567890
 *
 * Ini penting karena nomor dipakai sebagai kunci kirim WhatsApp. Satu wali yang
 * nomornya tersimpan dua format berbeda akan dikirimi pesan dua kali.
 */
export function normalkanNomor(input: string): string | null {
  // Buang semua kecuali angka dan tanda plus di depan
  let n = input.trim().replace(/[\s\-().]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (!/^\d+$/.test(n)) return null;

  // 0812… -> 62812…
  if (n.startsWith('0')) n = '62' + n.slice(1);
  // 812… (tanpa awalan apa pun) -> 62812…
  else if (!n.startsWith('62')) n = '62' + n;

  // 62 + minimal 8, maksimal 13 digit. Nomor Indonesia realistis 10-13 digit total.
  if (!/^62\d{8,13}$/.test(n)) return null;
  return n;
}

/** Tampilan tersamar untuk layar yang tidak perlu nomor penuh: 0812****7890 */
export function samarkanNomor(nomor: string): string {
  const lokal = nomor.startsWith('62') ? '0' + nomor.slice(2) : nomor;
  if (lokal.length < 8) return lokal;
  return `${lokal.slice(0, 4)}****${lokal.slice(-4)}`;
}

/** Tampilan enak dibaca: 0812-3456-7890 */
export function formatNomor(nomor: string): string {
  const lokal = nomor.startsWith('62') ? '0' + nomor.slice(2) : nomor;
  return lokal.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
