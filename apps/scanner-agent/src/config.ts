import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Isi config.json sengaja sesedikit mungkin: hanya alamat server dan kunci API.
 *
 * Daftar scanner TIDAK ada di sini. Nomor COM di Windows bisa berubah sendiri
 * saat colokan USB dipindah, dan tidak ada yang tahu scanner fisik mana yang
 * jadi COM3 tanpa mencoba. Pemetaannya diatur dari halaman Scanner di aplikasi
 * dan dikirim ke agent lewat WebSocket — jadi berkas ini tidak pernah diubah
 * lagi setelah dipasang.
 */
export type Konfigurasi = {
  apiUrl: string;
  apiKey: string;
  /** Berkas antrean offline. Relatif terhadap folder agent. */
  antreanPath: string;
  /**
   * Port yang dilaporkan manual, di luar hasil deteksi otomatis.
   *
   * Jalan keluar untuk perangkat yang tidak terbaca `SerialPort.list()` —
   * misalnya adaptor RS232 yang udev-nya tidak lengkap, atau port virtual
   * saat pengujian. Isi dengan path lengkap, contoh: ["/dev/ttyUSB9"].
   */
  portTambahan: string[];
  /** Selang laporan port ke server, detik. */
  laporDetik: number;
  /** Selang percobaan kirim antrean offline, detik. */
  kirimUlangDetik: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

const DEFAULT: Omit<Konfigurasi, 'apiUrl' | 'apiKey'> = {
  portTambahan: [],
  antreanPath: './antrean.sqlite',
  laporDetik: 60,
  kirimUlangDetik: 15,
  logLevel: 'info',
};

const CONTOH = `{
  "apiUrl": "https://presensi.sekolahku.sch.id",
  "apiKey": "tempel-kunci-dari-halaman-Scanner"
}`;

export function bacaKonfigurasi(berkas = 'config.json'): Konfigurasi {
  const jalur = resolve(berkas);

  if (!existsSync(jalur)) {
    console.error(`\nBerkas konfigurasi tidak ditemukan: ${jalur}\n`);
    console.error(`Buat berkas config.json berisi:\n\n${CONTOH}\n`);
    process.exit(1);
  }

  let isi: unknown;
  try {
    isi = JSON.parse(readFileSync(jalur, 'utf8'));
  } catch (err) {
    console.error(`\nconfig.json bukan JSON yang valid: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const c = isi as Partial<Konfigurasi>;
  const salah: string[] = [];

  if (!c.apiUrl?.trim()) salah.push('apiUrl belum diisi');
  else if (!/^https?:\/\//.test(c.apiUrl)) salah.push('apiUrl harus dimulai http:// atau https://');
  if (!c.apiKey?.trim()) salah.push('apiKey belum diisi');
  else if (c.apiKey.includes('tempel-kunci')) salah.push('apiKey masih berisi contoh, belum diganti');

  if (salah.length > 0) {
    console.error(`\nconfig.json belum benar:\n${salah.map((s) => `  - ${s}`).join('\n')}\n`);
    console.error(`Contoh yang benar:\n\n${CONTOH}\n`);
    process.exit(1);
  }

  return {
    ...DEFAULT,
    ...c,
    apiUrl: c.apiUrl!.replace(/\/+$/, ''),
    apiKey: c.apiKey!,
  };
}
