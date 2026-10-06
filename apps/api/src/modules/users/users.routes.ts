import { Router } from 'express';
import { z } from 'zod';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh, wajibSuperAdmin } from '../../middlewares/auth.js';
import { skemaBuatUser, skemaResetPassword, skemaUbahUser } from './users.schema.js';
import * as svc from './users.service.js';

export const usersRouter = Router();

// Seluruh modul ini khusus Super Admin.
usersRouter.use(...wajibMasukPenuh, wajibSuperAdmin);

const idParam = z.object({ id: z.uuid('ID pengguna tidak valid') });

usersRouter.get('/', ah(async (_req, res) => kirim(res, await svc.daftar())));

usersRouter.post(
  '/',
  ah(async (req, res) => kirim(res, await svc.buat(skemaBuatUser.parse(req.body)), 201)),
);

usersRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    return kirim(res, await svc.ubah(id, req.user!.id, skemaUbahUser.parse(req.body)));
  }),
);

usersRouter.post(
  '/:id/reset-password',
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { passwordBaru } = skemaResetPassword.parse(req.body);
    return kirim(res, await svc.resetPassword(id, req.user!.id, passwordBaru));
  }),
);

usersRouter.post(
  '/:id/revoke-sessions',
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    return kirim(res, await svc.cabutSesi(id, req.user!.id));
  }),
);

usersRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const { id } = idParam.parse(req.params);
    return kirim(res, await svc.nonaktifkan(id, req.user!.id));
  }),
);
