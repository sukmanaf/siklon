import { createServer } from 'node:http';
import { buatApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { cekKoneksiDb, tutupDb } from './lib/prisma.js';
import { pasangSocket } from './realtime/socket.js';
import { hentikanDispatcher, mulaiDispatcher } from './modules/whatsapp/dispatcher.js';
import { ambilProvider, sambungkanUlangBilaPerlu } from './modules/whatsapp/pengirim.js';
import { tanganiPesanMasuk } from './modules/whatsapp/optout.service.js';
import { hentikanPenjadwalBackup, mulaiPenjadwalBackup } from './modules/backup/backup.service.js';
import { hentikanPenjadwalAlpa, mulaiPenjadwalAlpa } from './modules/presensi/alpa.service.js';

async function main() {
  // Gagal keras di awal lebih baik daripada menerima permintaan tanpa database.
  if (!(await cekKoneksiDb())) {
    logger.fatal('Tidak dapat menyambung ke database. Periksa DATABASE_URL.');
    process.exit(1);
  }

  const app = buatApp();
  // Server HTTP dibuat sendiri agar Socket.IO bisa berbagi port yang sama.
  const server = createServer(app);
  pasangSocket(server, env.SCANNER_API_KEY);

  // Pairing BARU tetap hanya boleh dimulai admin lewat halaman WhatsApp —
  // server tidak pernah menerbitkan QR sendiri. Yang dipulihkan di sini
  // hanyalah sesi yang sudah ada DAN notifikasinya memang sedang dinyalakan;
  // syarat lengkapnya ada di sambungkanUlangBilaPerlu().
  const wa = ambilProvider();
  wa.onPesanMasuk((dari, teks) => void tanganiPesanMasuk(dari, teks));
  mulaiDispatcher();
  void sambungkanUlangBilaPerlu();
  mulaiPenjadwalBackup();
  mulaiPenjadwalAlpa();

  server.listen(env.PORT, () => {
    logger.info(`SIKLON API siap di http://localhost:${env.PORT}/api/v1  [${env.NODE_ENV}]`);
  });

  const tutup = (sinyal: string) => async () => {
    logger.info(`${sinyal} diterima, menutup server...`);
    hentikanDispatcher();
    hentikanPenjadwalBackup();
    hentikanPenjadwalAlpa();
    server.close(async () => {
      await tutupDb();
      logger.info('Server ditutup dengan bersih.');
      process.exit(0);
    });
    // Jangan menggantung selamanya bila ada koneksi yang tidak mau lepas.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', tutup('SIGTERM'));
  process.on('SIGINT', tutup('SIGINT'));
}

main();
