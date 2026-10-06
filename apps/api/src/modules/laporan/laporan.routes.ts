import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { kirim } from '../../lib/respons.js';
import { ah } from '../../middlewares/asyncHandler.js';
import { wajibMasukPenuh } from '../../middlewares/auth.js';
import { tanggalLokal } from '../../lib/waktu.js';
import * as lap from './laporan.service.js';
import * as xls from './excel.js';
import * as pdf from './pdf.js';
import { dashboard } from './dashboard.service.js';

export const laporanRouter = Router();
laporanRouter.use(...wajibMasukPenuh);

const tgl = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const bln = z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM');

/** Nama berkas unduhan yang langsung jelas isinya saat menumpuk di folder Unduhan. */
function namaBerkas(bagian: (string | null | undefined)[], ext: string) {
  const bersih = bagian
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9\-_.]/g, '_');
  return `${bersih}.${ext}`;
}

/*
 * PDF dibuka DI TAB BARU, bukan langsung diunduh.
 *
 * `inline` menyuruh browser menampilkannya di penampil PDF bawaan, sehingga
 * hasil cetaknya bisa diperiksa dulu — dan kalau memang mau disimpan, tombol
 * unduh penampil itu sudah ada. Excel tidak bisa ditampilkan browser, jadi
 * tetap `attachment`. `filename` tetap disertakan supaya nama berkasnya benar
 * saat pengguna menekan simpan dari penampil.
 */
function kirimBerkas(res: import('express').Response, buf: Buffer, nama: string, tipe: string) {
  const caraTampil = tipe === 'application/pdf' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', tipe);
  res.setHeader('Content-Disposition', `${caraTampil}; filename="${nama}"`);
  res.setHeader('Content-Length', String(buf.length));
  res.send(buf);
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ---------------- Harian ----------------

laporanRouter.get(
  '/harian',
  ah(async (req, res) => {
    const q = z.object({ tanggal: tgl.optional(), kelasId: z.uuid().optional() }).parse(req.query);
    return kirim(res, await lap.harianPerKelas(q.tanggal ?? tanggalLokal(), q.kelasId));
  }),
);

laporanRouter.get(
  '/harian/rekap',
  ah(async (req, res) => {
    const q = z.object({ tanggal: tgl.optional() }).parse(req.query);
    return kirim(res, await lap.rekapSemuaKelas(q.tanggal ?? tanggalLokal()));
  }),
);

laporanRouter.get(
  '/harian.xlsx',
  ah(async (req, res) => {
    const q = z.object({ tanggal: tgl.optional(), kelasId: z.uuid().optional() }).parse(req.query);
    const tanggal = q.tanggal ?? tanggalLokal();
    const buf = await xls.harianKeExcel(tanggal, q.kelasId);
    kirimBerkas(res, buf, namaBerkas(['presensi-harian', tanggal], 'xlsx'), XLSX);
  }),
);

laporanRouter.get(
  '/harian.pdf',
  ah(async (req, res) => {
    const q = z.object({ tanggal: tgl.optional(), kelasId: z.uuid().optional() }).parse(req.query);
    const tanggal = q.tanggal ?? tanggalLokal();
    const buf = await pdf.harianKePdf(tanggal, q.kelasId);
    kirimBerkas(res, buf, namaBerkas(['presensi-harian', tanggal], 'pdf'), 'application/pdf');
  }),
);

// ---------------- Bulanan per kelas ----------------

laporanRouter.get(
  '/bulanan/kelas',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, kelasId: z.uuid() }).parse(req.query);
    return kirim(res, await lap.bulananPerKelas(q.bulan, q.kelasId));
  }),
);

laporanRouter.get(
  '/bulanan/kelas.xlsx',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, kelasId: z.uuid() }).parse(req.query);
    const buf = await xls.bulananKelasKeExcel(q.bulan, q.kelasId);
    kirimBerkas(res, buf, namaBerkas(['rekap-bulanan', q.bulan], 'xlsx'), XLSX);
  }),
);

laporanRouter.get(
  '/bulanan/kelas.pdf',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, kelasId: z.uuid() }).parse(req.query);
    const buf = await pdf.bulananKelasKePdf(q.bulan, q.kelasId);
    kirimBerkas(res, buf, namaBerkas(['rekap-bulanan', q.bulan], 'pdf'), 'application/pdf');
  }),
);

// ---------------- Bulanan per siswa ----------------

laporanRouter.get(
  '/bulanan/siswa',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, siswaId: z.uuid() }).parse(req.query);
    return kirim(res, await lap.bulananPerSiswa(q.bulan, q.siswaId));
  }),
);

laporanRouter.get(
  '/bulanan/siswa.xlsx',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, siswaId: z.uuid() }).parse(req.query);
    const siswa = await prisma.students.findUnique({
      where: { id: q.siswaId },
      select: { nis: true },
    });
    const buf = await xls.bulananSiswaKeExcel(q.bulan, q.siswaId);
    kirimBerkas(res, buf, namaBerkas(['rekap', siswa?.nis, q.bulan], 'xlsx'), XLSX);
  }),
);

laporanRouter.get(
  '/bulanan/siswa.pdf',
  ah(async (req, res) => {
    const q = z.object({ bulan: bln, siswaId: z.uuid() }).parse(req.query);
    // NIS diambil terpisah dengan query ringan, bukan dengan menjalankan
    // seluruh laporan dua kali hanya untuk mendapatkan nama berkasnya.
    const siswa = await prisma.students.findUnique({
      where: { id: q.siswaId },
      select: { nis: true },
    });
    const buf = await pdf.bulananSiswaKePdf(q.bulan, q.siswaId);
    kirimBerkas(res, buf, namaBerkas(['rekap', siswa?.nis, q.bulan], 'pdf'), 'application/pdf');
  }),
);

// ---------------- Perlu perhatian ----------------

laporanRouter.get(
  '/perlu-perhatian',
  ah(async (req, res) => {
    const q = z
      .object({ dari: tgl, sampai: tgl, minimalAlpa: z.coerce.number().int().min(1).max(50).optional() })
      .parse(req.query);
    return kirim(res, await lap.perluPerhatian(q.dari, q.sampai, q.minimalAlpa ?? 1));
  }),
);

// ---------------- Dashboard ----------------
export const dashboardRouter = Router();
dashboardRouter.use(...wajibMasukPenuh);

dashboardRouter.get(
  '/',
  ah(async (req, res) => {
    const q = z.object({ tanggal: tgl.optional() }).parse(req.query);
    return kirim(res, await dashboard(q.tanggal));
  }),
);
