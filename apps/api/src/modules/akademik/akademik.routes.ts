import { Router } from 'express';
import { z } from 'zod';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import * as thn from './tahunAjaran.service.js';
import * as kls from './kelas.service.js';

const tgl = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const uuid = z.object({ id: z.uuid('ID tidak valid') });
const idAngka = z.object({ id: z.coerce.number().int().positive() });

// ---------------- Tahun Ajaran ----------------
export const tahunAjaranRouter = Router();
tahunAjaranRouter.use(...wajibMasukPenuh);

tahunAjaranRouter.get('/', ah(async (_q, res) => kirim(res, await thn.daftar())));
tahunAjaranRouter.get('/aktif', ah(async (_q, res) => kirim(res, await thn.aktif())));

tahunAjaranRouter.post(
  '/',
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().regex(/^\d{4}\/\d{4}$/, 'Format nama harus 2026/2027'),
        start_date: tgl,
        end_date: tgl,
      })
      .parse(req.body);
    return kirim(res, await thn.buat(data), 201);
  }),
);

tahunAjaranRouter.post(
  '/:id/aktifkan',
  ah(async (req, res) => kirim(res, await thn.aktifkan(idAngka.parse(req.params).id))),
);

tahunAjaranRouter.delete(
  '/:id',
  ah(async (req, res) => kirim(res, await thn.hapus(idAngka.parse(req.params).id))),
);

// ---------------- Kelas ----------------
export const kelasRouter = Router();
kelasRouter.use(...wajibMasukPenuh);

kelasRouter.get(
  '/',
  ah(async (req, res) => {
    const q = z
      .object({
        tahunId: z.coerce.number().int().positive().optional(),
        tingkat: z.coerce.number().int().min(1).max(12).optional(),
      })
      .parse(req.query);
    return kirim(res, await kls.daftar(q));
  }),
);

kelasRouter.post(
  '/',
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1, 'Nama kelas wajib diisi').max(30),
        grade_level: z.coerce.number().int().min(1).max(12).optional(),
        academic_year_id: z.coerce.number().int().positive().optional(),
      })
      .parse(req.body);
    return kirim(res, await kls.buat(data), 201);
  }),
);

kelasRouter.get(
  '/:id/anggota',
  ah(async (req, res) => kirim(res, await kls.anggota(uuid.parse(req.params).id))),
);

kelasRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(30).optional(),
        grade_level: z.coerce.number().int().min(1).max(12).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);
    return kirim(res, await kls.ubah(uuid.parse(req.params).id, data));
  }),
);

kelasRouter.delete(
  '/:id',
  ah(async (req, res) => kirim(res, await kls.hapus(uuid.parse(req.params).id))),
);

kelasRouter.post(
  '/salin',
  ah(async (req, res) => {
    const data = z
      .object({
        dariTahunId: z.coerce.number().int().positive().optional(),
        keTahunId: z.coerce.number().int().positive(),
      })
      .parse(req.body);
    return kirim(res, await kls.salinKeTahun(data));
  }),
);

kelasRouter.post(
  '/promote',
  ah(async (req, res) => {
    const { pasangan } = z
      .object({
        pasangan: z
          .array(z.object({ dariKelasId: z.uuid(), keKelasId: z.uuid() }))
          .min(1, 'Minimal satu pasangan kelas'),
      })
      .parse(req.body);
    return kirim(res, await kls.naikkanKelas(pasangan));
  }),
);
