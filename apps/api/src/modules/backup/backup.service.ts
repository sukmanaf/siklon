import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'backupdb');
const MAX_BACKUP_AGE_DAYS = 30;

/**
 * Memecah DATABASE_URL menjadi komponen koneksi PostgreSQL.
 */
function uraiDatabaseUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return {
      host: url.hostname || 'localhost',
      port: url.port || '5432',
      user: url.username || 'postgres',
      password: url.password || '',
      database: url.pathname.replace(/^\//, '') || 'absen',
    };
  } catch (err) {
    logger.error({ err }, 'Gagal memparsing DATABASE_URL untuk backup');
    return null;
  }
}

/**
 * Menghapus file backup lama di folder backupdb yang berusia lebih dari MAX_BACKUP_AGE_DAYS.
 */
function bersihkanBackupLama() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const maxAgeMs = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (file.startsWith('presensee_backup_') && (file.endsWith('.sql.gz') || file.endsWith('.sql'))) {
      const filePath = path.join(BACKUP_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          logger.info(`[BACKUP] Menghapus backup lama (>30 hari): ${file}`);
        }
      } catch (e) {
        logger.warn({ err: e }, `[BACKUP] Gagal memeriksa/menghapus file backup: ${file}`);
      }
    }
  }
}

/**
 * Menjalankan proses backup database menggunakan pg_dump dan mengkompres dengan gzip.
 */
export async function jalankanBackupDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    const dbConfig = uraiDatabaseUrl(env.DATABASE_URL);
    if (!dbConfig) {
      resolve(false);
      return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Format nama file: presensee_backup_YYYY-MM-DD_HH-mm-ss.sql.gz
    const now = new Date();
    const timestamp = now
      .toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })
      .replace(' ', '_')
      .replace(/:/g, '-');
    const filename = `presensee_backup_${timestamp}.sql.gz`;
    const outputPath = path.join(BACKUP_DIR, filename);

    const envPass = dbConfig.password ? `PGPASSWORD="${dbConfig.password}" ` : '';
    const cmd = `${envPass}pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} --clean --if-exists | gzip > "${outputPath}"`;

    logger.info(`[BACKUP] Memulai proses backup database ke: ${outputPath}`);

    exec(cmd, { shell: '/bin/sh' }, (error, _stdout, stderr) => {
      if (error) {
        // Cek jika pg_dump tidak terinstall
        if (error.message.includes('not found') || stderr.includes('not found')) {
          logger.warn('[BACKUP] pg_dump atau gzip tidak ditemukan di sistem/container. Backup dibatalkan.');
        } else {
          logger.error({ error, stderr }, '[BACKUP] Gagal mengeksekusi backup database');
        }
        resolve(false);
        return;
      }

      logger.info(`[BACKUP] Backup database BERHASIL dibuat: ${filename}`);
      bersihkanBackupLama();
      resolve(true);
    });
  });
}

let cronTask: ScheduledTask | null = null;

/**
 * Memulai penjadwal otomatis backup setiap hari jam 09:00 WIB.
 */
export function mulaiPenjadwalBackup() {
  if (cronTask) return;

  // Pattern: 0 9 * * * -> Jam 09:00 WIB setiap hari
  cronTask = cron.schedule(
    '0 9 * * *',
    async () => {
      logger.info('[BACKUP] Menjalankan jadwal backup otomatis harian (09:00 WIB)...');
      await jalankanBackupDatabase();
    },
    {
      timezone: 'Asia/Jakarta',
    }
  );

  logger.info('📦 Penjadwal Backup Otomatis Database aktif (Setiap hari jam 09:00 WIB)');
}

/**
 * Menghentikan penjadwal backup.
 */
export function hentikanPenjadwalBackup() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
