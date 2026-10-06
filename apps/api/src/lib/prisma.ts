import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Prisma 7 mewajibkan driver adapter; koneksi tidak lagi diambil dari
 * schema.prisma. Adapter pg juga memberi kita akses pool yang bisa diatur —
 * penting karena jam masuk sekolah adalah lonjakan trafik yang tajam.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  // WAJIB: Prisma mengirim timestamp sebagai waktu UTC TANPA offset, dengan
  // asumsi timezone sesi adalah UTC. PostgreSQL di mesin ini ber-timezone
  // Asia/Jakarta, sehingga string itu ditafsirkan sebagai waktu lokal dan
  // nilai tersimpan bergeser 7 jam.
  //
  // Round-trip lewat ORM tetap terlihat benar (salahnya dua kali dan saling
  // meniadakan), jadi bug ini TIDAK kelihatan sampai ada query raw SQL — dan
  // seluruh laporan proyek ini memakai raw SQL.
  //
  // Konversi ke waktu Jakarta dilakukan di lapisan aplikasi (src/lib/waktu.ts)
  // dan di query laporan lewat AT TIME ZONE eksplisit.
  options: '-c timezone=UTC',
});

export const prisma = new PrismaClient({
  adapter,
  log: isDev
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
});

if (isDev) {
  // Query lambat lebih berbahaya daripada query banyak; yang di atas 100 ms dicatat.
  prisma.$on('query', (e) => {
    if (e.duration >= 100) {
      logger.debug({ durasiMs: e.duration, query: e.query.slice(0, 200) }, 'Query lambat');
    }
  });
}

export async function cekKoneksiDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, 'Koneksi database gagal');
    return false;
  }
}

export async function tutupDb(): Promise<void> {
  await prisma.$disconnect();
}
