import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { NAMA_COOKIE, opsiCookie } from '../../lib/jwt.js';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasuk } from '../../middlewares/auth.js';
import { skemaGantiPassword, skemaLogin } from './auth.schema.js';
import * as svc from './auth.service.js';

export const authRouter = Router();

/**
 * Rate limit login: 5 percobaan gagal / 15 menit.
 * Kunci gabungan IP + username supaya satu penyerang tidak bisa mengunci
 * seluruh sekolah hanya dengan menyerang satu akun dari banyak IP, dan
 * sebaliknya satu IP tidak bisa membombardir banyak username.
 */
const batasLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const username = String((req.body as { username?: string } | undefined)?.username ?? '').toLowerCase();
    // ipKeyGenerator menormalkan IPv6 ke prefix /64. Tanpa ini, satu pengguna
    // IPv6 bisa berpindah alamat dalam subnet yang sama dan melewati batas.
    return `${ipKeyGenerator(req.ip ?? '')}|${username}`;
  },
  handler: (_req, res) =>
    res.status(429).json({
      ok: false,
      error: {
        code: 'TERLALU_BANYAK_PERCOBAAN',
        message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
      },
    }),
});

authRouter.post(
  '/login',
  batasLogin,
  ah(async (req, res) => {
    const { username, password } = skemaLogin.parse(req.body);
    const hasil = await svc.login(username, password, req.ip);
    res.cookie(NAMA_COOKIE, hasil.token, opsiCookie);
    return kirim(res, { user: hasil.user, token: hasil.token });
  }),
);

authRouter.get(
  '/me',
  wajibMasuk,
  ah(async (req, res) => kirim(res, req.user)),
);

authRouter.post(
  '/change-password',
  wajibMasuk,
  ah(async (req, res) => {
    const { passwordLama, passwordBaru } = skemaGantiPassword.parse(req.body);
    const token = await svc.gantiPassword(req.user!.id, passwordLama, passwordBaru);
    // Token lama sudah batal; kirim yang baru agar pengguna tidak terlempar keluar.
    res.cookie(NAMA_COOKIE, token, opsiCookie);
    return kirim(res, { pesan: 'Password berhasil diganti', token });
  }),
);

authRouter.post(
  '/logout',
  ah(async (_req, res) => {
    res.clearCookie(NAMA_COOKIE, { path: '/' });
    return kirim(res, { pesan: 'Anda telah keluar' });
  }),
);

authRouter.post(
  '/logout-all',
  wajibMasuk,
  ah(async (req, res) => {
    await svc.cabutSemuaSesi(req.user!.id);
    res.clearCookie(NAMA_COOKIE, { path: '/' });
    return kirim(res, { pesan: 'Anda telah keluar dari semua perangkat' });
  }),
);
