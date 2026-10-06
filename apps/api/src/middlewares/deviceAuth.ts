import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { Unauthorized } from '../lib/errors.js';

/**
 * Autentikasi Scanner Agent lewat header X-Api-Key.
 *
 * Agent tidak memakai JWT karena tidak mewakili seorang pengguna, dan tidak
 * boleh dipaksa login ulang tiap 12 jam — ia harus jalan tanpa dijaga siapa pun.
 *
 * Perbandingan memakai timingSafeEqual, bukan `===`. Perbandingan string biasa
 * berhenti di karakter pertama yang berbeda, dan selisih waktunya bisa dipakai
 * menebak kunci karakter demi karakter.
 */
export const wajibDeviceKey: RequestHandler = (req, _res, next) => {
  const kirim = req.headers['x-api-key'];
  if (typeof kirim !== 'string' || kirim.length === 0) {
    return next(Unauthorized('Header X-Api-Key tidak ada'));
  }

  const a = Buffer.from(kirim);
  const b = Buffer.from(env.SCANNER_API_KEY);

  // timingSafeEqual menuntut panjang sama; bedanya panjang sudah bocor lewat
  // pengecekan ini, tapi itu informasi yang jauh kurang berguna bagi penyerang.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(Unauthorized('X-Api-Key tidak dikenal'));
  }

  next();
};
