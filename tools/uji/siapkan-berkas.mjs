#!/usr/bin/env node
/**
 * Membuat berkas umpan yang dibutuhkan suite uji.
 *
 *   node tools/uji/siapkan-berkas.mjs
 *
 * Dijalankan otomatis oleh suite yang membutuhkannya, jadi biasanya tidak perlu
 * dipanggil sendiri. Hasilnya masuk `berkas/` dan tidak ikut Git — berkas biner
 * yang bisa dibuat ulang tidak perlu disimpan di repo.
 *
 * Yang dibuat:
 *  - qr.png / qr.y4m : kartu siswa berisi NIS, untuk menguji pemindaian kamera.
 *    Y4M dipakai Chrome lewat `--use-file-for-fake-video-capture`, sehingga
 *    pendekode QR benar-benar diuji — bukan sekadar "pustakanya terpilih".
 *  - impor-bersih.xlsx / impor-rusak.xlsx : berkas impor siswa.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import { DIR_UJI } from './bersama.mjs';

export const DIR_BERKAS = join(DIR_UJI, 'berkas');
export const NIS_QR = '2026071';

export const BERKAS = {
  qrPng: join(DIR_BERKAS, 'qr.png'),
  qrY4m: join(DIR_BERKAS, 'qr.y4m'),
  imporBersih: join(DIR_BERKAS, 'impor-bersih.xlsx'),
  imporRusak: join(DIR_BERKAS, 'impor-rusak.xlsx'),
};

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

async function buatQr() {
  await QRCode.toFile(BERKAS.qrPng, NIS_QR, { width: 420, margin: 3 });

  /*
   * QR ditempel di tengah bingkai 640x480 berlatar putih. Latar putih penting:
   * umpan palsu Chrome tidak punya pencahayaan, dan QR di atas latar gelap
   * sering gagal didekode.
   */
  execFileSync(
    FFMPEG,
    [
      '-y', '-loglevel', 'error',
      '-loop', '1', '-i', BERKAS.qrPng,
      '-t', '4', '-r', '10',
      '-vf', 'scale=360:360,pad=640:480:(ow-iw)/2:(oh-ih)/2:white',
      '-pix_fmt', 'yuv420p',
      BERKAS.qrY4m,
    ],
    { stdio: 'inherit' },
  );
}

async function buatExcelImpor() {
  // --- Berkas bersih: dua siswa, satu nomor dipakai berdua (kakak-adik) ---
  const bersih = new ExcelJS.Workbook();
  const wsB = bersih.addWorksheet('Data Siswa');
  wsB.addRow(['NIS', 'Nama', 'Kelas', 'Nomor HP']);
  wsB.addRow(['9101', 'Impor Bersih Satu', 'VII-A', '081299000001']);
  // Tulisan nomornya berbeda tapi nomornya sama — harus dihitung SATU nomor.
  wsB.addRow(['9102', 'Impor Bersih Dua', 'VII-A', '0812 9900 0001']);
  await bersih.xlsx.writeFile(BERKAS.imporBersih);

  // --- Berkas rusak: satu baris benar, sisanya tiap baris satu jenis masalah ---
  const rusak = new ExcelJS.Workbook();
  const wsR = rusak.addWorksheet('Data Siswa');
  wsR.addRow(['NIS', 'Nama', 'Kelas', 'Nomor HP']);
  wsR.addRow(['9001', 'Uji Satu', 'VII-A', '081234000001']);       // baik
  wsR.addRow(['', 'Uji Dua', 'VII-A', '081234000002']);            // NIS kosong
  wsR.addRow(['9003', '', 'VII-A', '081234000003']);               // nama kosong
  wsR.addRow(['9004', 'Uji Empat', 'KELAS-HANTU', '081234000004']); // kelas tidak ada
  wsR.addRow(['9005', 'Uji Lima', 'VII-A', 'bukan-nomor']);        // nomor ngawur
  wsR.addRow(['9001', 'Uji Enam', 'VII-A', '081234000006']);       // NIS dobel
  await rusak.xlsx.writeFile(BERKAS.imporRusak);
}

/** Buat berkas yang belum ada. `paksa` membuat ulang semuanya. */
export async function siapkanBerkas({ paksa = false } = {}) {
  mkdirSync(DIR_BERKAS, { recursive: true });
  const lengkap = Object.values(BERKAS).every((f) => existsSync(f));
  if (lengkap && !paksa) return BERKAS;

  await buatQr();
  await buatExcelImpor();
  return BERKAS;
}

// Dijalankan langsung dari terminal.
if (import.meta.url === `file://${process.argv[1]}`) {
  await siapkanBerkas({ paksa: true });
  console.log('Berkas umpan dibuat di', DIR_BERKAS);
  for (const [nama, jalur] of Object.entries(BERKAS)) console.log(` - ${nama}: ${jalur}`);
}
