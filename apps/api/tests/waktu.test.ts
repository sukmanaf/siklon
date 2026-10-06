import { describe, expect, it } from 'vitest';
import {
  hariLokal, jamKeMenit, jamLokal, menitDalamHari, menitKeJam,
  rentangHari, tanggalKeDate, tanggalLokal,
} from '../src/lib/waktu.js';

describe('tanggal & jam lokal Jakarta', () => {
  it('scan pagi 06:30 WIB tercatat di tanggal yang benar', () => {
    const d = new Date('2026-09-08T06:30:00+07:00');
    expect(tanggalLokal(d)).toBe('2026-09-08');
    expect(jamLokal(d)).toBe('06:30');
  });

  it('JEBAKAN UTC: 00:30 WIB tetap tanggal 8, bukan 7', () => {
    const d = new Date('2026-09-08T00:30:00+07:00');
    // toISOString() akan bilang 2026-09-07 — inilah bug yang dihindari.
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-07');
    expect(tanggalLokal(d)).toBe('2026-09-08');
  });

  it('JEBAKAN UTC: 23:45 WIB tetap tanggal 8, bukan 9', () => {
    const d = new Date('2026-09-08T23:45:00+07:00');
    expect(tanggalLokal(d)).toBe('2026-09-08');
    expect(jamLokal(d)).toBe('23:45');
  });

  it('menit sejak tengah malam', () => {
    expect(menitDalamHari(new Date('2026-09-08T07:22:00+07:00'))).toBe(7 * 60 + 22);
    expect(menitDalamHari(new Date('2026-09-08T00:00:00+07:00'))).toBe(0);
    expect(menitDalamHari(new Date('2026-09-08T23:59:00+07:00'))).toBe(23 * 60 + 59);
  });

  it('hari dalam seminggu: 8 September 2026 adalah Selasa', () => {
    expect(hariLokal(new Date('2026-09-08T07:00:00+07:00'))).toBe(2);
    expect(hariLokal(new Date('2026-09-06T07:00:00+07:00'))).toBe(0); // Minggu
    expect(hariLokal(new Date('2026-09-12T07:00:00+07:00'))).toBe(6); // Sabtu
  });

  it('hari tetap benar walau waktunya lewat tengah malam UTC', () => {
    // 07:00 WIB = 00:00 UTC hari yang sama; 06:00 WIB = 23:00 UTC hari sebelumnya
    expect(hariLokal(new Date('2026-09-08T06:00:00+07:00'))).toBe(2);
  });
});

describe('konversi jam', () => {
  it('jam <-> menit', () => {
    expect(jamKeMenit('07:00')).toBe(420);
    expect(jamKeMenit('07:10')).toBe(430);
    expect(jamKeMenit('00:00')).toBe(0);
    expect(jamKeMenit('23:59')).toBe(1439);
    expect(menitKeJam(430)).toBe('07:10');
    expect(menitKeJam(0)).toBe('00:00');
  });

  it('menolak format jam yang salah', () => {
    for (const j of ['25:00', '07:60', '7:00', 'pagi', '', '07:00:00']) {
      expect(() => jamKeMenit(j), `seharusnya melempar: "${j}"`).toThrow();
    }
  });
});

describe('rentang hari untuk query', () => {
  it('tengah malam Jakarta = 17:00 UTC hari sebelumnya', () => {
    expect(tanggalKeDate('2026-09-08').toISOString()).toBe('2026-09-07T17:00:00.000Z');
  });

  it('rentang satu hari tepat 24 jam dan tidak menyentuh hari berikutnya', () => {
    const { awal, akhir } = rentangHari('2026-09-08');
    expect(akhir.getTime() - awal.getTime()).toBe(24 * 3600 * 1000);
    expect(tanggalLokal(awal)).toBe('2026-09-08');
    // Akhir rentang bersifat eksklusif: sudah masuk tanggal 9.
    expect(tanggalLokal(akhir)).toBe('2026-09-09');
    // Scan pukul 23:59 WIB harus masih di dalam rentang.
    const malam = new Date('2026-09-08T23:59:59+07:00');
    expect(malam >= awal && malam < akhir).toBe(true);
  });
});
