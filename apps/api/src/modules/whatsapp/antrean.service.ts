import type { KejadianWa } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { susunPesan } from './template.js';

export type PermintaanAntre = {
  siswaId: string;
  kejadian: KejadianWa;
  waktu: Date;
  menitTerlambat?: number;
  catatan?: string | null;
  presensiId?: bigint | null;
  /** Bila true (misal dari ubah status manual), abaikan filter kirim_saat di settings */
  abaikanKirimSaat?: boolean;
};

export type HasilAntre =
  | { diantrekan: true; pesanId: string }
  | { diantrekan: false; alasan: string };

/**
 * Masukkan satu notifikasi ke antrean.
 *
 * Sengaja TIDAK mengirim langsung. Saat jam masuk, 600 siswa scan dalam
 * hitungan menit; mengirim di dalam permintaan HTTP akan membuat layar
 * operator menunggu jeda anti-blokir 3–8 detik per siswa.
 */
export async function antrekan(req: PermintaanAntre): Promise<HasilAntre> {
  const wa = await ambilSetting('whatsapp');

  if (!req.abaikanKirimSaat && !wa.kirim_saat.includes(req.kejadian)) {
    return { diantrekan: false, alasan: `Kejadian ${req.kejadian} tidak diaktifkan di Pengaturan` };
  }

  const siswa = await prisma.students.findUnique({
    where: { id: req.siswaId },
    select: {
      full_name: true,
      guardian_phone: true,
      notify: true,
      classes: { select: { name: true } },
    },
  });

  if (!siswa) return { diantrekan: false, alasan: 'Siswa tidak ditemukan' };

  if (!siswa.guardian_phone) {
    // Ini kegagalan senyap yang paling berbahaya: siswa hadir, presensi
    // tercatat, tapi tidak ada yang dikabari. Dicatat sebagai peringatan
    // supaya muncul di laporan "nomor bermasalah".
    logger.warn(
      { siswa: siswa.full_name },
      'Siswa belum punya nomor wali — tidak ada yang dikabari',
    );
    return { diantrekan: false, alasan: 'Siswa belum punya nomor wali murid' };
  }
  if (!siswa.notify) {
    return { diantrekan: false, alasan: `Notifikasi untuk wali ${siswa.full_name} dimatikan` };
  }

  const isi = await susunPesan({
    kejadian: req.kejadian,
    namaSiswa: siswa.full_name,
    kelas: siswa.classes?.name ?? null,
    waktu: req.waktu,
    menitTerlambat: req.menitTerlambat,
    catatan: req.catatan,
  });

  const baris = await prisma.wa_messages.create({
    data: {
      student_id: req.siswaId,
      phone: siswa.guardian_phone,
      body: isi,
      event: req.kejadian,
      status: 'QUEUED',
    },
    select: { id: true },
  });

  return { diantrekan: true, pesanId: baris.id.toString() };
}

/**
 * Versi yang tidak pernah melempar. Dipakai di jalur scan: kegagalan
 * mengantrekan notifikasi TIDAK boleh membatalkan presensi yang sudah tercatat.
 */
export async function antrekanAman(req: PermintaanAntre): Promise<boolean> {
  try {
    const h = await antrekan(req);
    if (!h.diantrekan) logger.debug({ alasan: h.alasan }, 'Notifikasi tidak diantrekan');
    return h.diantrekan;
  } catch (err) {
    logger.error({ err, siswaId: req.siswaId }, 'Gagal mengantrekan notifikasi WhatsApp');
    return false;
  }
}

/** Antrekan banyak sekaligus — dipakai job penanda ALPA dan rekap mingguan. */
export async function antrekanBanyak(daftar: PermintaanAntre[]) {
  let berhasil = 0;
  const gagal: { siswaId: string; alasan: string }[] = [];

  for (const req of daftar) {
    try {
      const h = await antrekan(req);
      if (h.diantrekan) berhasil++;
      else gagal.push({ siswaId: req.siswaId, alasan: h.alasan });
    } catch (err) {
      gagal.push({ siswaId: req.siswaId, alasan: (err as Error).message });
    }
  }
  return { berhasil, gagal };
}
