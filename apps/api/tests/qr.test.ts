import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { createRequire } from 'node:module';
import type { QRCode as HasilQr } from 'jsqr';

// jsqr adalah paket CJS. Di berkas ESM, createRequire adalah cara paling lurus
// memuatnya tanpa mengakali tipe interop.
const require = createRequire(import.meta.url);
const jsQR = require('jsqr') as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => HasilQr | null;
import { PNG } from 'pngjs';

/**
 * Kriteria selesai BE-028 adalah "hasil cetaknya benar-benar terbaca".
 * Membuktikan PDF-nya terbentuk saja tidak cukup — QR-nya harus bisa
 * didekode kembali menjadi NIS yang sama.
 */
async function bacaBalik(isi: string, width: number): Promise<string | null> {
  const png = await QRCode.toBuffer(isi, { errorCorrectionLevel: 'M', margin: 0, width, type: 'png' });
  const img = PNG.sync.read(png);
  const hasil = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  return hasil?.data ?? null;
}

describe('QR kartu siswa', () => {
  it('NIS dapat didekode kembali dari QR yang dihasilkan', async () => {
    for (const nis of ['2026001', '2026900', '20260010001', 'A1B2C3']) {
      expect(await bacaBalik(nis, 240), `gagal pada NIS ${nis}`).toBe(nis);
    }
  });

  it('masih terbaca pada resolusi kecil seperti yang dicetak di kartu', async () => {
    // 46 poin PDF ~ 130 px pada 200 dpi. Diuji di 128 px.
    expect(await bacaBalik('2026001', 128)).toBe('2026001');
  });
});
