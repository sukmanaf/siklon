type Level = 'debug' | 'info' | 'warn' | 'error';
const URUT: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let ambang: Level = 'info';
export const setLevel = (l: Level) => { ambang = l; };

/**
 * Log sederhana ke stdout. Agent jalan sebagai service Windows/systemd yang
 * outputnya diarahkan ke berkas, jadi cukup teks berstempel waktu — bukan JSON
 * yang menyulitkan petugas sekolah saat diminta membaca lognya.
 */
function tulis(level: Level, pesan: string) {
  if (URUT[level] < URUT[ambang]) return;
  const jam = new Date().toLocaleTimeString('id-ID', { hour12: false });
  const tanda = level.toUpperCase().padEnd(5);
  console.log(`[${jam}] ${tanda} ${pesan}`);
}

export const log = {
  debug: (p: string) => tulis('debug', p),
  info: (p: string) => tulis('info', p),
  warn: (p: string) => tulis('warn', p),
  error: (p: string) => tulis('error', p),
};
