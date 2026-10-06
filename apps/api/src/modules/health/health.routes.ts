import { Router } from 'express';
import { cekKoneksiDb } from '../../lib/prisma.js';
import { kirim, kirimError } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();

const mulai = Date.now();

healthRouter.get(
  '/health',
  ah(async (_req, res) => {
    const db = await cekKoneksiDb();
    const data = {
      status: db ? 'sehat' : 'bermasalah',
      db: db ? 'tersambung' : 'terputus',
      uptimeDetik: Math.floor((Date.now() - mulai) / 1000),
      versi: '1.0.0',
      env: env.NODE_ENV,
      waktu: new Date().toISOString(),
    };
    // 503 saat DB mati supaya load balancer / monitoring tahu, bukan 200 palsu.
    return db ? kirim(res, data) : kirimError(res, 503, 'DB_TERPUTUS', 'Database tidak dapat dihubungi', data);
  }),
);
