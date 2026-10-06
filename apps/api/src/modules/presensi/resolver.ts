import type { Presensi } from '@siklon/shared';
import { hariLokal, jamKeMenit, menitDalamHari, menitKeJam } from '../../lib/waktu.js';

/** Aturan yang berlaku untuk satu hari tertentu, sesudah override `khusus` diterapkan. */
export type AturanHari = {
  hari: number;
  hariSekolah: boolean;
  jamMasuk: string;
  toleransiMenit: number;
  batasAlpa: string;
  jamPulang: string;
  /** Menit sejak tengah malam — batas akhir masih dihitung HADIR. */
  batasTerlambatMenit: number;
  batasAlpaMenit: number;
  jamPulangMenit: number;
};

/**
 * Terapkan override `khusus` untuk hari tertentu di atas aturan utama.
 * Hanya kunci yang ditulis di `khusus` yang menimpa; sisanya ikut nilai utama.
 */
export function aturanUntukHari(presensi: Presensi, hari: number): AturanHari {
  const khusus = presensi.khusus[String(hari)] ?? {};
  const jamMasuk = khusus.jam_masuk ?? presensi.jam_masuk;
  const toleransiMenit = khusus.toleransi_menit ?? presensi.toleransi_menit;
  const batasAlpa = khusus.batas_alpa ?? presensi.batas_alpa;
  const jamPulang = khusus.jam_pulang ?? presensi.jam_pulang;

  return {
    hari,
    hariSekolah: presensi.hari_sekolah.includes(hari),
    jamMasuk,
    toleransiMenit,
    batasAlpa,
    jamPulang,
    batasTerlambatMenit: jamKeMenit(jamMasuk) + toleransiMenit,
    batasAlpaMenit: jamKeMenit(batasAlpa),
    jamPulangMenit: jamKeMenit(jamPulang),
  };
}

export const aturanUntukTanggal = (presensi: Presensi, waktu: Date): AturanHari =>
  aturanUntukHari(presensi, hariLokal(waktu));

export type HasilResolver =
  | { jenis: 'HARI_LIBUR'; alasan: string }
  | { jenis: 'DITERIMA'; status: 'HADIR' | 'TERLAMBAT'; terlambatMenit: number; pesan: string };

/**
 * Menentukan status dari satu waktu scan.
 *
 * Batas terlambat = jam_masuk + toleransi_menit. Dengan 07:00 + 10 menit:
 *   <= 07:10  -> HADIR
 *   >  07:10  -> TERLAMBAT, selisihnya dihitung dari batas (bukan dari jam masuk)
 *
 * Selisih sengaja dihitung dari BATAS, bukan dari jam_masuk. Kalau dihitung dari
 * jam_masuk, siswa yang datang 07:08 (masih HADIR) dan 07:11 (TERLAMBAT) akan
 * tercatat terlambat 8 dan 11 menit — padahal yang pertama tidak terlambat sama
 * sekali. Toleransi jadi kehilangan artinya di laporan.
 */
export function tentukanStatus(
  presensi: Presensi,
  waktu: Date,
  opsi: { hariLibur?: string | null } = {},
): HasilResolver {
  const aturan = aturanUntukTanggal(presensi, waktu);

  if (opsi.hariLibur) {
    return { jenis: 'HARI_LIBUR', alasan: `Hari ini libur: ${opsi.hariLibur}` };
  }
  if (!aturan.hariSekolah) {
    return { jenis: 'HARI_LIBUR', alasan: 'Hari ini bukan hari sekolah' };
  }

  const menit = menitDalamHari(waktu);

  if (menit <= aturan.batasTerlambatMenit) {
    return { jenis: 'DITERIMA', status: 'HADIR', terlambatMenit: 0, pesan: 'Hadir' };
  }

  const terlambatMenit = menit - aturan.batasTerlambatMenit;
  return {
    jenis: 'DITERIMA',
    status: 'TERLAMBAT',
    terlambatMenit,
    pesan: `Terlambat ${terlambatMenit} menit (batas ${menitKeJam(aturan.batasTerlambatMenit)})`,
  };
}

/**
 * Apakah scan pada waktu ini sudah masuk jam pulang?
 *
 * Dipakai untuk membedakan scan kedua yang berarti "pulang" dari scan kedua
 * yang cuma kartu tertempel dua kali. Batasnya jam_pulang milik hari itu —
 * Jumat yang pulang lebih awal ikut terbaca benar lewat `khusus`.
 */
export function sudahJamPulang(presensi: Presensi, waktu: Date): boolean {
  const aturan = aturanUntukTanggal(presensi, waktu);
  return menitDalamHari(waktu) >= aturan.jamPulangMenit;
}
