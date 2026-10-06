import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import { Conflict } from '../../lib/errors.js';
import { tanggalKeKolomDate } from '../../lib/waktu.js';

export const liburRouter = Router();
liburRouter.use(...wajibMasukPenuh);

const tgl = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

liburRouter.get(
  '/',
  ah(async (req, res) => {
    const { tahun } = z.object({ tahun: z.coerce.number().int().optional() }).parse(req.query);
    const where = tahun
      ? { holiday_date: { gte: tanggalKeKolomDate(`${tahun}-01-01`), lte: tanggalKeKolomDate(`${tahun}-12-31`) } }
      : {};
    return kirim(res, await prisma.holidays.findMany({ where, orderBy: { holiday_date: 'asc' } }));
  }),
);

liburRouter.post(
  '/',
  ah(async (req, res) => {
    const data = z
      .object({ holiday_date: tgl, name: z.string().trim().min(1, 'Nama hari libur wajib diisi').max(120) })
      .parse(req.body);
    const ada = await prisma.holidays.findUnique({
      where: { holiday_date: tanggalKeKolomDate(data.holiday_date) },
    });
    if (ada) throw Conflict(`Tanggal ${data.holiday_date} sudah terdaftar sebagai "${ada.name}"`);
    return kirim(
      res,
      await prisma.holidays.create({ data: { holiday_date: tanggalKeKolomDate(data.holiday_date), name: data.name } }),
      201,
    );
  }),
);

liburRouter.delete(
  '/:tanggal',
  ah(async (req, res) => {
    const { tanggal } = z.object({ tanggal: tgl }).parse(req.params);
    await prisma.holidays.delete({ where: { holiday_date: tanggalKeKolomDate(tanggal) } });
    return kirim(res, { pesan: `Hari libur ${tanggal} dihapus` });
  }),
);
