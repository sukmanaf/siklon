import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';

export const fotoRouter = Router();

const DIR_FOTO = resolve(env.STORAGE_PATH, 'siswa');

/**
 * Disimpan di memori dulu, bukan langsung ke disk, supaya isinya bisa
 * diperiksa sebelum ditulis. Batas 5 MB: foto paspor 3x4 jauh di bawah itu.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

/**
 * Periksa jenis berkas dari MAGIC BYTES, bukan dari header Content-Type.
 * Content-Type dikirim klien dan bisa dipalsukan; menyimpan berkas berbahaya
 * yang mengaku "image/jpeg" adalah lubang keamanan yang klasik.
 */
function deteksiGambar(buf: Buffer): '.jpg' | '.png' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) return '.png';
  return null;
}

const uuid = z.object({ id: z.uuid('ID siswa tidak valid') });

fotoRouter.post(
  '/:id/foto',
  ...wajibMasukPenuh,
  upload.single('foto'),
  ah(async (req, res) => {
    const { id } = uuid.parse(req.params);
    const berkas = req.file;
    if (!berkas) throw BadRequest('Tidak ada berkas yang diunggah. Kirim field bernama "foto".');

    const ext = deteksiGambar(berkas.buffer);
    if (!ext) {
      throw BadRequest(
        'Berkas bukan gambar JPG atau PNG. Jenis berkas diperiksa dari isinya, bukan dari namanya.',
      );
    }

    const siswa = await prisma.students.findUnique({ where: { id }, select: { photo_path: true } });
    if (!siswa) throw NotFound('Siswa tidak ditemukan');

    await mkdir(DIR_FOTO, { recursive: true });
    const namaBerkas = `${id}${ext}`;
    await writeFile(join(DIR_FOTO, namaBerkas), berkas.buffer);

    // Bila sebelumnya berformat lain (jpg -> png), berkas lama dibuang agar
    // tidak menumpuk sampah yang tidak pernah terpakai.
    if (siswa.photo_path && siswa.photo_path !== namaBerkas) {
      await unlink(join(DIR_FOTO, siswa.photo_path)).catch(() => undefined);
    }

    await prisma.students.update({ where: { id }, data: { photo_path: namaBerkas } });
    return kirim(res, { pesan: 'Foto tersimpan', url: `/api/v1/students/${id}/foto` });
  }),
);

/**
 * Penyaji foto. Butuh autentikasi — foto siswa adalah data pribadi anak,
 * jadi berkasnya disimpan di luar webroot dan tidak pernah punya URL publik.
 */
fotoRouter.get(
  '/:id/foto',
  ...wajibMasukPenuh,
  ah(async (req, res) => {
    const { id } = uuid.parse(req.params);
    const siswa = await prisma.students.findUnique({ where: { id }, select: { photo_path: true } });
    if (!siswa?.photo_path) throw NotFound('Siswa ini belum punya foto');

    // photo_path dibentuk server (id + ekstensi), tapi tetap divalidasi agar
    // nilai aneh di database tidak bisa dipakai keluar dari folder foto.
    if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(siswa.photo_path)) {
      throw NotFound('Nama berkas foto tidak valid');
    }

    const tipe = extname(siswa.photo_path) === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', tipe);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    createReadStream(join(DIR_FOTO, siswa.photo_path)).on('error', () => {
      if (!res.headersSent) res.status(404).end();
    }).pipe(res);
  }),
);

fotoRouter.delete(
  '/:id/foto',
  ...wajibMasukPenuh,
  ah(async (req, res) => {
    const { id } = uuid.parse(req.params);
    const siswa = await prisma.students.findUnique({ where: { id }, select: { photo_path: true } });
    if (!siswa?.photo_path) throw NotFound('Siswa ini belum punya foto');
    await unlink(join(DIR_FOTO, siswa.photo_path)).catch(() => undefined);
    await prisma.students.update({ where: { id }, data: { photo_path: null } });
    return kirim(res, { pesan: 'Foto dihapus' });
  }),
);
