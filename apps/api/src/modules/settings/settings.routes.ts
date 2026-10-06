import { Router } from 'express';
import { z } from 'zod';
import { KUNCI_SETTING } from '@siklon/shared';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import * as svc from './settings.service.js';

export const settingsRouter = Router();
settingsRouter.use(...wajibMasukPenuh);

settingsRouter.get('/', ah(async (_req, res) => kirim(res, await svc.ambilSemua())));

const kunciParam = z.object({ kunci: z.enum(KUNCI_SETTING) });

settingsRouter.get(
  '/:kunci',
  ah(async (req, res) => {
    const { kunci } = kunciParam.parse(req.params);
    return kirim(res, await svc.ambil(kunci));
  }),
);

settingsRouter.put(
  '/:kunci',
  ah(async (req, res) => {
    const { kunci } = kunciParam.parse(req.params);
    return kirim(res, await svc.simpan(kunci, req.body, req.user!.id));
  }),
);
