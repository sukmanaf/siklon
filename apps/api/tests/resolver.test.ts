import { describe, expect, it } from 'vitest';
import type { Presensi } from '@siklon/shared';
import { aturanUntukHari, sudahJamPulang, tentukanStatus } from '../src/modules/presensi/resolver.js';

const DASAR: Presensi = {
  jam_masuk: '07:00',
  toleransi_menit: 10,
  batas_alpa: '09:00',
  jam_pulang: '13:00',
  hari_sekolah: [1, 2, 3, 4, 5],
  khusus: {},
};

/** 8 Sep 2026 = Selasa (hari sekolah) */
const pada = (jam: string) => new Date(`2026-09-08T${jam}:00+07:00`);

describe('batas terlambat = jam_masuk + toleransi', () => {
  it('batasnya 07:10 dengan jam_masuk 07:00 dan toleransi 10', () => {
    expect(aturanUntukHari(DASAR, 2).batasTerlambatMenit).toBe(7 * 60 + 10);
  });

  it.each([
    ['06:20', 'HADIR', 0],
    ['06:59', 'HADIR', 0],
    ['07:00', 'HADIR', 0],
    ['07:08', 'HADIR', 0],
    ['07:10', 'HADIR', 0],   // tepat di batas masih HADIR
    ['07:11', 'TERLAMBAT', 1],
    ['07:22', 'TERLAMBAT', 12],
    ['08:00', 'TERLAMBAT', 50],
    ['09:30', 'TERLAMBAT', 140], // scan susulan lewat batas alpa tetap dihitung
  ])('scan %s -> %s (%i menit)', (jam, status, menit) => {
    const h = tentukanStatus(DASAR, pada(jam));
    expect(h.jenis).toBe('DITERIMA');
    if (h.jenis !== 'DITERIMA') return;
    expect(h.status).toBe(status);
    expect(h.terlambatMenit).toBe(menit);
  });

  it('menit terlambat dihitung dari BATAS, bukan dari jam masuk', () => {
    // Kalau dihitung dari jam_masuk, 07:11 akan tercatat terlambat 11 menit
    // dan toleransi jadi tidak ada artinya di laporan.
    const h = tentukanStatus(DASAR, pada('07:11'));
    expect(h.jenis === 'DITERIMA' && h.terlambatMenit).toBe(1);
  });

  it('toleransi 0 berarti lewat 1 menit sudah terlambat', () => {
    const p = { ...DASAR, toleransi_menit: 0 };
    expect(tentukanStatus(p, pada('07:00')).jenis === 'DITERIMA').toBe(true);
    const h = tentukanStatus(p, pada('07:01'));
    expect(h.jenis === 'DITERIMA' && h.status).toBe('TERLAMBAT');
    expect(h.jenis === 'DITERIMA' && h.terlambatMenit).toBe(1);
  });
});

describe('hari sekolah & hari libur', () => {
  it('Sabtu dan Minggu ditolak halus', () => {
    for (const tgl of ['2026-09-12', '2026-09-13']) {
      const h = tentukanStatus(DASAR, new Date(`${tgl}T07:00:00+07:00`));
      expect(h.jenis).toBe('HARI_LIBUR');
    }
  });

  it('tanggal libur nasional ditolak walau hari kerja', () => {
    const h = tentukanStatus(DASAR, pada('07:00'), { hariLibur: 'Hari Kemerdekaan RI' });
    expect(h.jenis).toBe('HARI_LIBUR');
    if (h.jenis === 'HARI_LIBUR') expect(h.alasan).toContain('Kemerdekaan');
  });

  it('hari libur diperiksa SEBELUM jam, jadi scan jam berapa pun tetap ditolak', () => {
    expect(tentukanStatus(DASAR, pada('06:00'), { hariLibur: 'X' }).jenis).toBe('HARI_LIBUR');
    expect(tentukanStatus(DASAR, pada('23:00'), { hariLibur: 'X' }).jenis).toBe('HARI_LIBUR');
  });
});

describe('override khusus per hari', () => {
  const dgnKhusus: Presensi = {
    ...DASAR,
    khusus: { '1': { jam_masuk: '06:45' } }, // Senin upacara
  };

  it('Senin memakai jam masuk 06:45, hari lain tetap 07:00', () => {
    expect(aturanUntukHari(dgnKhusus, 1).jamMasuk).toBe('06:45');
    expect(aturanUntukHari(dgnKhusus, 2).jamMasuk).toBe('07:00');
  });

  it('override hanya menimpa kunci yang ditulis; toleransi tetap ikut nilai utama', () => {
    const senin = aturanUntukHari(dgnKhusus, 1);
    expect(senin.toleransiMenit).toBe(10);
    expect(senin.batasTerlambatMenit).toBe(6 * 60 + 55); // 06:45 + 10
  });

  it('Senin 06:58 TERLAMBAT, padahal Selasa 06:58 masih HADIR', () => {
    const senin = tentukanStatus(dgnKhusus, new Date('2026-09-07T06:58:00+07:00'));
    const selasa = tentukanStatus(dgnKhusus, new Date('2026-09-08T06:58:00+07:00'));
    expect(senin.jenis === 'DITERIMA' && senin.status).toBe('TERLAMBAT');
    expect(selasa.jenis === 'DITERIMA' && selasa.status).toBe('HADIR');
  });
});

describe('sekolah dengan 6 hari sekolah', () => {
  it('Sabtu diterima bila dimasukkan ke hari_sekolah', () => {
    const p = { ...DASAR, hari_sekolah: [1, 2, 3, 4, 5, 6] };
    const h = tentukanStatus(p, new Date('2026-09-12T07:00:00+07:00'));
    expect(h.jenis).toBe('DITERIMA');
  });
});

describe('jam pulang', () => {
  it.each([
    ['07:05', false],
    ['12:59', false],
    ['13:00', true],   // tepat di jam pulang sudah dihitung pulang
    ['13:01', true],
    ['16:30', true],
  ])('scan %s -> sudah jam pulang: %s', (jam, harusnya) => {
    expect(sudahJamPulang(DASAR, pada(jam))).toBe(harusnya);
  });

  it('penimpa per hari berlaku untuk jam pulang', () => {
    // Jumat pulang lebih awal. 11 Sep 2026 = Jumat.
    const jumatPulangAwal: Presensi = { ...DASAR, khusus: { '5': { jam_pulang: '11:30' } } };
    const jumat = (jam: string) => new Date(`2026-09-11T${jam}:00+07:00`);

    expect(aturanUntukHari(jumatPulangAwal, 5).jamPulang).toBe('11:30');
    expect(sudahJamPulang(jumatPulangAwal, jumat('11:29'))).toBe(false);
    expect(sudahJamPulang(jumatPulangAwal, jumat('11:30'))).toBe(true);
    // Hari lain tetap memakai nilai utama.
    expect(sudahJamPulang(jumatPulangAwal, pada('11:30'))).toBe(false);
  });
});
