import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { BadRequest } from '../../lib/errors.js';
import { kirim, kirimHalaman } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import * as svc from './siswa.service.js';
import { buatTemplate, importSiswa } from './import.service.js';
import { cetakKartuQr } from './qr.service.js';

/** 10 MB cukup untuk berkas Excel ribuan baris. */
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const uuid = z.object({ id: z.uuid('ID tidak valid') });
const boolOpsional = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

// ---------------- Siswa ----------------
export const siswaRouter = Router();
siswaRouter.use(...wajibMasukPenuh);

siswaRouter.get(
  '/ringkasan',
  ah(async (_req, res) => kirim(res, await svc.ringkasan())),
);

siswaRouter.get(
  '/',
  ah(async (req, res) => {
    const q = z
      .object({
        cari: z.string().trim().min(1).optional(),
        kelasId: z.uuid().optional(),
        aktif: boolOpsional,
        tanpaWali: boolOpsional,
        page: z.coerce.number().int().positive().optional(),
        perPage: z.coerce.number().int().positive().max(200).optional(),
      })
      .parse(req.query);

    // Default hanya siswa aktif — daftar yang bercampur siswa lulus/pindah
    // membingungkan dan membuat angka total keliru.
    const hasil = await svc.daftar({ aktif: q.aktif ?? true, ...q });
    return kirimHalaman(res, hasil.items, hasil.total, hasil.page, hasil.perPage);
  }),
);

siswaRouter.get(
  '/nis/:nis',
  ah(async (req, res) => {
    const { nis } = z.object({ nis: z.string().trim().min(1) }).parse(req.params);
    return kirim(res, await svc.cariByNis(nis));
  }),
);

const skemaSiswa = z.object({
  nis: z
    .string()
    .trim()
    .min(1, 'NIS wajib diisi')
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, 'NIS hanya boleh huruf dan angka — karakter lain menyulitkan pembacaan QR'),
  full_name: z.string().trim().min(1, 'Nama siswa wajib diisi').max(120),
  class_id: z.uuid().optional().nullable(),
  // Wali murid disimpan langsung di baris siswa. Nomor ganda tidak ditolak:
  // kakak-adik memang memakai nomor wali yang sama.
  guardian_phone: z.string().trim().max(25).optional().nullable(),
  notify: z.boolean().optional(),
});

siswaRouter.post(
  '/',
  ah(async (req, res) => kirim(res, await svc.buat(skemaSiswa.parse(req.body)), 201)),
);

siswaRouter.get(
  '/:id',
  ah(async (req, res) => kirim(res, await svc.detail(uuid.parse(req.params).id))),
);

siswaRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const data = skemaSiswa.partial().extend({ is_active: z.boolean().optional() }).parse(req.body);
    return kirim(res, await svc.ubah(uuid.parse(req.params).id, data));
  }),
);

siswaRouter.post(
  '/:id/nonaktifkan',
  ah(async (req, res) => kirim(res, await svc.nonaktifkan(uuid.parse(req.params).id))),
);

siswaRouter.delete(
  '/:id',
  ah(async (req, res) => kirim(res, await svc.hapus(uuid.parse(req.params).id))),
);

// ---------------- Import Excel & cetak QR ----------------
// Dipasang di bawah agar rute '/import' & '/print-qr' tidak tertangkap '/:id'.
siswaRouter.get(
  '/template/excel',
  ah(async (_req, res) => {
    const buf = await buatTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-siswa.xlsx"');
    res.send(buf);
  }),
);

siswaRouter.post(
  '/import',
  uploadExcel.single('berkas'),
  ah(async (req, res) => {
    if (!req.file) throw BadRequest('Tidak ada berkas. Kirim field bernama "berkas" berisi .xlsx');
    const hanyaPeriksa = req.query['periksa'] === 'true';
    const hasil = await importSiswa(req.file.buffer, { hanyaPeriksa });
    // 200 walau ada masalah baris: ini bukan error server, tapi laporan
    // pemeriksaan yang perlu ditampilkan operator baris per baris.
    return kirim(res, hasil);
  }),
);

siswaRouter.post(
  '/print-qr',
  ah(async (req, res) => {
    const q = z
      .object({
        kelasId: z.uuid().optional(),
        siswaIds: z.array(z.uuid()).max(500).optional(),
      })
      .parse(req.body);
    const pdf = await cetakKartuQr(q);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="kartu-qr-siswa.pdf"');
    res.send(pdf);
  }),
);
