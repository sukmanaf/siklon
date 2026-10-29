import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 memindahkan URL datasource dari schema.prisma ke berkas ini, dan
 * TIDAK lagi memuat .env otomatis — jadi kita muat sendiri.
 * process.loadEnvFile bawaan Node, tanpa perlu paket dotenv.
 */
if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * Catatan penting: `database/schema.sql` adalah SUMBER KEBENARAN skema, bukan
 * schema.prisma. Alurnya introspeksi (`db pull`), bukan `migrate dev`.
 * View laporan, trigger, dan partial index dikelola manual lewat SQL.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/presensi_sekolah',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
});
