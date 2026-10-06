import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { kirimError } from '../lib/respons.js';
import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

/** Rute tidak dikenal — dipasang setelah semua router. */
export const notFoundHandler: RequestHandler = (req, res) =>
  kirimError(res, 404, 'ROUTE_NOT_FOUND', `Endpoint ${req.method} ${req.path} tidak ada`);

/**
 * Penerjemah error terpusat. Semua error berakhir di sini dan keluar
 * dalam bentuk yang sama: { ok:false, error:{ code, message } }.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Error aplikasi yang memang kita lempar sendiri
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
    return kirimError(res, err.status, err.code, err.message, err.detail);
  }

  // 2. Validasi Zod -> daftar field yang salah
  if (err instanceof ZodError) {
    const detail = err.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      pesan: i.message,
    }));
    return kirimError(res, 400, 'VALIDASI_GAGAL', 'Data yang dikirim tidak valid', detail);
  }

  // 3. Error Prisma yang punya arti bisnis jelas
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.['target'] as string[] | undefined)?.join(', ') ?? 'data';
      return kirimError(res, 409, 'DUPLIKAT', `${target} sudah dipakai`);
    }
    if (err.code === 'P2025') {
      return kirimError(res, 404, 'NOT_FOUND', 'Data tidak ditemukan');
    }
    if (err.code === 'P2003') {
      return kirimError(res, 409, 'MASIH_DIPAKAI', 'Data masih dipakai oleh data lain');
    }
    logger.error({ err, code: err.code, path: req.path }, 'Prisma error tak tertangani');
    return kirimError(res, 500, 'DATABASE_ERROR', 'Terjadi kesalahan pada database');
  }

  // 4. JSON body rusak
  if (err instanceof SyntaxError && 'body' in err) {
    return kirimError(res, 400, 'JSON_RUSAK', 'Body permintaan bukan JSON yang valid');
  }

  // 5. Sisanya: tak terduga. Log lengkap di server, pesan generik ke klien.
  logger.error({ err, path: req.path, method: req.method }, 'Error tak tertangani');
  return kirimError(
    res,
    500,
    'INTERNAL_ERROR',
    'Terjadi kesalahan pada server',
    isProd ? undefined : { pesan: (err as Error)?.message, stack: (err as Error)?.stack },
  );
};
