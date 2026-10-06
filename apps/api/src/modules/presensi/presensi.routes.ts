import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { skemaScanners } from '@siklon/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import { wajibDeviceKey } from '../../middlewares/deviceAuth.js';
import { siarkanIdentify, siarkanScan } from '../../realtime/socket.js';
import { prosesScan } from './scan.service.js';
import * as presensi from './presensi.service.js';
import * as scanner from './scanner.service.js';
import { tanggalLokal } from '../../lib/waktu.js';

const tgl = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
/** Isi QR kartu siswa = NIS. */
const nis = z.string().trim().min(1).max(20);

// =====================================================================
// Endpoint untuk Scanner Agent (X-Api-Key, bukan JWT)
// =====================================================================
export const scanRouter = Router();

const skemaSatuScan = z.object({
  nis,
  /** Kode titik scan; boleh path port, akan dipetakan ke kode gerbang. */
  gate: z.string().trim().min(1).max(32).optional(),
  portPath: z.string().trim().min(1).max(64).optional(),
  scannedAt: z.iso.datetime({ offset: true }).optional(),
});

async function jalankanScan(input: z.infer<typeof skemaSatuScan>) {
  const waktu = input.scannedAt ? new Date(input.scannedAt) : new Date();

  // Selama mode identifikasi, scan hanya dipakai untuk mengenali scanner mana
  // yang ditempel — sengaja TIDAK dicatat sebagai presensi.
  if (scanner.modeIdentifikasiAktif() && input.portPath) {
    const kode = await scanner.kodeDariPort(input.portPath);
    siarkanIdentify(input.portPath, kode);
    return {
      ok: false as const,
      kode: 'MODE_IDENTIFIKASI',
      pesan: `Scanner ${input.portPath} teridentifikasi. Presensi tidak dicatat.`,
      jam: '',
      titikScan: input.portPath,
    };
  }

  const titikScan =
    input.gate ?? (input.portPath ? ((await scanner.kodeDariPort(input.portPath)) ?? 'TIDAK_DIKENAL') : 'TIDAK_DIKENAL');

  const hasil = await prosesScan({ nis: input.nis, titikScan, waktu });
  siarkanScan(hasil);
  return hasil;
}

scanRouter.post(
  '/scans',
  wajibDeviceKey,
  ah(async (req, res) => kirim(res, await jalankanScan(skemaSatuScan.parse(req.body)))),
);

scanRouter.post(
  '/scans/batch',
  wajibDeviceKey,
  ah(async (req, res) => {
    const { items } = z
      .object({ items: z.array(skemaSatuScan).min(1).max(200) })
      .parse(req.body);

    // Diproses berurutan, bukan paralel. Batch ini datang dari antrean offline
    // dan bisa memuat NIS yang sama dua kali; paralel akan membuat dua baris
    // lolos bersamaan sebelum kunci unik bekerja.
    const hasil = [];
    for (const item of items) hasil.push(await jalankanScan(item));

    return kirim(res, {
      diproses: hasil.length,
      berhasil: hasil.filter((h) => h.ok).length,
      ditolak: hasil.filter((h) => !h.ok).length,
      hasil,
    });
  }),
);

scanRouter.post(
  '/agent/hello',
  wajibDeviceKey,
  ah(async (req, res) => {
    const data = z
      .object({
        agentVersion: z.string().max(20).optional(),
        ports: z
          .array(
            z.object({
              path: z.string().min(1).max(64),
              serialNumber: z.string().max(64).nullish(),
              vendorId: z.string().max(16).nullish(),
              productId: z.string().max(16).nullish(),
              manufacturer: z.string().max(120).nullish(),
              locationId: z.string().max(64).nullish(),
            }),
          )
          .max(32),
      })
      .parse(req.body);
    return kirim(res, await scanner.laporanAgent(data));
  }),
);

// =====================================================================
// Endpoint untuk aplikasi web (JWT)
// =====================================================================
export const presensiRouter = Router();
presensiRouter.use(...wajibMasukPenuh);

presensiRouter.get(
  '/',
  ah(async (req, res) => {
    const q = z
      .object({ tanggal: tgl.optional(), kelasId: z.uuid().optional() })
      .parse(req.query);
    return kirim(res, await presensi.harian(q.tanggal ?? tanggalLokal(), q.kelasId));
  }),
);

/**
 * Scan dari browser (kamera webcam / kamera HP).
 *
 * Ini scan yang SUNGGUHAN, setara dengan yang datang dari pemindai serial:
 * lewat resolver status yang sama, memicu notifikasi WhatsApp yang sama, dan
 * TIDAK ditandai sebagai koreksi manual.
 *
 * Dipisah dari `POST /scans` hanya karena autentikasinya berbeda: /scans
 * dijaga X-Api-Key milik Scanner Agent, dan kunci itu tidak boleh ada di
 * browser (variabel NEXT_PUBLIC_* ikut terkirim ke klien dan bisa dibaca
 * siapa pun). Di sini penjaganya sesi pengguna yang sudah masuk.
 *
 * Titik scan sengaja tidak diminta: sistem ini tidak perlu mencatat siswa
 * absen lewat gerbang mana.
 */
presensiRouter.post(
  '/scan',
  ah(async (req, res) => {
    const data = z
      .object({ nis, waktu: z.iso.datetime({ offset: true }).optional() })
      .parse(req.body);

    const hasil = await prosesScan({
      nis: data.nis,
      waktu: data.waktu ? new Date(data.waktu) : new Date(),
    });
    siarkanScan(hasil);
    return kirim(res, hasil);
  }),
);

presensiRouter.post(
  '/manual',
  ah(async (req, res) => {
    const data = z
      .object({
        nis,
        catatan: z.string().trim().min(1, 'Catatan wajib diisi (mis. kartu tertinggal di rumah)'),
        waktu: z.iso.datetime({ offset: true }).optional(),
      })
      .parse(req.body);

    const hasil = await prosesScan({
      nis: data.nis,
      titikScan: 'MANUAL',
      waktu: data.waktu ? new Date(data.waktu) : new Date(),
      manual: { olehUserId: req.user!.id, catatan: data.catatan },
    });
    siarkanScan(hasil);
    return kirim(res, hasil);
  }),
);


presensiRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    return kirim(res, await presensi.hapusPresensi(id, req.user!.id));
  }),
);
presensiRouter.post(
  '/:id/update',
  ah(async (req, res) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    const data = z
      .object({
        status: z.enum(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA']),
        catatan: z.string().trim().min(1, 'Catatan wajib diisi saat mengubah status'),
        jamMasuk: z.string().optional(),
        jamPulang: z.string().optional(),
      })
      .parse(req.body);
    const result = await presensi.ubahStatus(id, data, req.user!.id);
    return kirim(res, result);
  }),
);

presensiRouter.post(
  '/tandai',
  ah(async (req, res) => {
    const data = z
      .object({
        siswaId: z.uuid(),
        tanggal: tgl,
        status: z.enum(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALPA']),
        catatan: z.string().trim().min(1, 'Catatan wajib diisi'),
        jamMasuk: z.string().optional(),
        jamPulang: z.string().optional(),
      })
      .parse(req.body);
    return kirim(
      res,
      await presensi.tandaiTanpaScan(data.siswaId, data.tanggal, data, req.user!.id),
    );
  }),
);

presensiRouter.get(
  '/siswa/:id',
  ah(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const q = z.object({ dari: tgl, sampai: tgl }).parse(req.query);
    return kirim(res, await presensi.riwayatSiswa(id, q.dari, q.sampai));
  }),
);

// =====================================================================
// Lampiran presensi (mis. foto surat izin/sakit) — pola sama seperti
// foto siswa (lihat modules/siswa/foto.routes.ts): disimpan di memori dulu,
// jenis berkas diperiksa dari isinya, disajikan lewat endpoint ber-otentikasi.
// =====================================================================
const DIR_LAMPIRAN = resolve(env.STORAGE_PATH, 'presensi');
const uploadLampiran = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const idPresensi = z.object({ id: z.coerce.bigint() });

/** Sama seperti foto.routes.ts: jenis berkas dari magic bytes, bukan Content-Type. */
function deteksiGambarLampiran(buf: Buffer): '.jpg' | '.png' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) return '.png';
  return null;
}

presensiRouter.post(
  '/:id/lampiran',
  uploadLampiran.single('lampiran'),
  ah(async (req, res) => {
    const { id } = idPresensi.parse(req.params);
    const berkas = req.file;
    if (!berkas) throw BadRequest('Tidak ada berkas yang diunggah. Kirim field bernama "lampiran".');

    const ext = deteksiGambarLampiran(berkas.buffer);
    if (!ext) {
      throw BadRequest(
        'Berkas bukan gambar JPG atau PNG. Jenis berkas diperiksa dari isinya, bukan dari namanya.',
      );
    }

    const ada = await prisma.attendance.findUnique({ where: { id }, select: { attachment_path: true } });
    if (!ada) throw NotFound('Data presensi tidak ditemukan');

    await mkdir(DIR_LAMPIRAN, { recursive: true });
    const namaBerkas = `${id}${ext}`;
    await writeFile(join(DIR_LAMPIRAN, namaBerkas), berkas.buffer);

    if (ada.attachment_path && ada.attachment_path !== namaBerkas) {
      await unlink(join(DIR_LAMPIRAN, ada.attachment_path)).catch(() => undefined);
    }

    await prisma.attendance.update({ where: { id }, data: { attachment_path: namaBerkas } });
    return kirim(res, { pesan: 'Lampiran tersimpan', url: `/api/v1/attendance/${id}/lampiran` });
  }),
);

/** Butuh autentikasi — surat izin/sakit adalah data pribadi anak. */
presensiRouter.get(
  '/:id/lampiran',
  ah(async (req, res) => {
    const { id } = idPresensi.parse(req.params);
    const ada = await prisma.attendance.findUnique({ where: { id }, select: { attachment_path: true } });
    if (!ada?.attachment_path) throw NotFound('Presensi ini belum punya lampiran');

    // attachment_path dibentuk server (id + ekstensi), tapi tetap divalidasi
    // supaya nilai aneh di database tidak bisa dipakai keluar dari folder lampiran.
    if (!/^\d+\.(jpg|png)$/.test(ada.attachment_path)) {
      throw NotFound('Nama berkas lampiran tidak valid');
    }

    const tipe = extname(ada.attachment_path) === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', tipe);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    createReadStream(join(DIR_LAMPIRAN, ada.attachment_path)).on('error', () => {
      if (!res.headersSent) res.status(404).end();
    }).pipe(res);
  }),
);

presensiRouter.delete(
  '/:id/lampiran',
  ah(async (req, res) => {
    const { id } = idPresensi.parse(req.params);
    const ada = await prisma.attendance.findUnique({ where: { id }, select: { attachment_path: true } });
    if (!ada?.attachment_path) throw NotFound('Presensi ini belum punya lampiran');
    await unlink(join(DIR_LAMPIRAN, ada.attachment_path)).catch(() => undefined);
    await prisma.attendance.update({ where: { id }, data: { attachment_path: null } });
    return kirim(res, { pesan: 'Lampiran dihapus' });
  }),
);

// =====================================================================
// Pengelolaan titik scan (JWT)
// =====================================================================
export const scannerRouter = Router();
scannerRouter.use(...wajibMasukPenuh);

scannerRouter.get('/', ah(async (_req, res) => kirim(res, await scanner.daftarScanner())));

scannerRouter.put(
  '/',
  ah(async (req, res) => {
    const { scanners } = z.object({ scanners: skemaScanners }).parse(req.body);
    return kirim(res, await scanner.simpanPemetaan(scanners, req.user!.id));
  }),
);

scannerRouter.post('/identify', ah(async (_req, res) => kirim(res, scanner.mulaiIdentifikasi())));
scannerRouter.delete('/identify', ah(async (_req, res) => kirim(res, scanner.hentikanIdentifikasi())));
