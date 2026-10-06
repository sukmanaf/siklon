import { z } from 'zod';

/**
 * Validasi environment. Aplikasi sengaja DITOLAK START bila ada yang salah —
 * lebih baik gagal keras saat boot daripada error misterius jam 07:00 pagi
 * saat 600 siswa sedang mengantre.
 */
const skema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  TZ: z.string().default('Asia/Jakarta'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET minimal 32 karakter. Buat dengan: openssl rand -base64 48'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  SCANNER_API_KEY: z
    .string()
    .min(16, 'SCANNER_API_KEY minimal 16 karakter. Buat dengan: openssl rand -hex 24'),

  // dummy = hanya dicatat di log. Ini PENGAMAN KERAS: nilainya mengalahkan
  // setelan provider di database, supaya salah klik di halaman Pengaturan
  // tidak bisa membuat server development mengirim pesan sungguhan.
  WA_PROVIDER: z.enum(['dummy', 'baileys']).default('dummy'),
  WA_SESSION_PATH: z.string().default('./storage/wa-session'),
  /** Nomor yang boleh menerima pesan saat NODE_ENV bukan production. */
  WA_ALLOWLIST: z.string().default(''),

  STORAGE_PATH: z.string().default('./storage'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

const hasil = skema.safeParse(process.env);

if (!hasil.success) {
  const daftar = hasil.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // Jangan pakai logger di sini: logger sendiri butuh env yang valid.
  console.error(`\nKonfigurasi environment tidak valid:\n${daftar}\n`);
  console.error('Salin .env.example menjadi .env lalu sesuaikan nilainya.\n');
  process.exit(1);
}

export const env = hasil.data;
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';

/** Daftar origin yang diizinkan CORS. */
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
