import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { jamLokal, menitDalamHari, tanggalKeKolomDate, tanggalLokal } from '../../lib/waktu.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { antrekanBanyak } from '../whatsapp/antrean.service.js';
import { aturanUntukTanggal } from './resolver.js';

let cronTask: ScheduledTask | null = null;
let terakhirDijalankanTanggal: string | null = null;

export type HasilAutoAlpa = {
  ok: boolean;
  tanggal: string;
  totalBelum: number;
  ditandaiAlpa: number;
  waDiantrekan: number;
  alasan?: string;
  pesan?: string;
};

/**
 * Eksekusi penandaan ALPA untuk semua siswa yang belum tercatat presensi.
 */
export async function jalankanAutoAlpa(opsi?: { tanggal?: string; paksa?: boolean }): Promise<HasilAutoAlpa> {
  const waktu = new Date();
  const tglStr = opsi?.tanggal ?? tanggalLokal(waktu);
  const tglDate = tanggalKeKolomDate(tglStr);

  // 1. Cek hari libur kalender (kecuali jika opsi paksa diaktifkan)
  if (!opsi?.paksa) {
    const libur = await prisma.holidays.findUnique({
      where: { holiday_date: tglDate },
    });
    if (libur) {
      logger.info({ tanggal: tglStr, libur: libur.name }, '[AUTO_ALPA] Hari libur, penandaan ALPA dilewati');
      return { ok: false, tanggal: tglStr, totalBelum: 0, ditandaiAlpa: 0, waDiantrekan: 0, alasan: `Hari libur: ${libur.name}` };
    }
  }

  // 2. Ambil aturan presensi
  const presensi = await ambilSetting('presensi');
  const aturan = aturanUntukTanggal(presensi, waktu);

  // 3. Cek saklar aktif dan hari sekolah (kecuali jika opsi paksa diaktifkan)
  if (!opsi?.paksa) {
    if (presensi.auto_alpa_aktif === false) {
      logger.debug('[AUTO_ALPA] Fitur auto ALPA dinonaktifkan di Pengaturan');
      return { ok: false, tanggal: tglStr, totalBelum: 0, ditandaiAlpa: 0, waDiantrekan: 0, alasan: 'Auto ALPA dinonaktifkan di Pengaturan' };
    }

    if (!aturan.hariSekolah) {
      logger.info({ tanggal: tglStr, hari: aturan.hari }, '[AUTO_ALPA] Bukan hari sekolah, penandaan ALPA dilewati');
      return { ok: false, tanggal: tglStr, totalBelum: 0, ditandaiAlpa: 0, waDiantrekan: 0, alasan: 'Bukan hari sekolah' };
    }
  }

  // 4. Cari semua siswa aktif yang BELUM memiliki catatan presensi hari ini
  // (Siswa yang sudah HADIR, TERLAMBAT, IZIN, atau SAKIT tidak akan disentuh)
  const siswaBelumAbsen = await prisma.students.findMany({
    where: {
      is_active: true,
      attendance: {
        none: {
          attendance_date: tglDate,
        },
      },
    },
    select: {
      id: true,
      class_id: true,
      full_name: true,
      guardian_phone: true,
      notify: true,
    },
  });

  if (siswaBelumAbsen.length === 0) {
    logger.info({ tanggal: tglStr }, '[AUTO_ALPA] Semua siswa sudah memiliki catatan presensi (0 siswa alpa)');
    terakhirDijalankanTanggal = tglStr;
    return { ok: true, tanggal: tglStr, totalBelum: 0, ditandaiAlpa: 0, waDiantrekan: 0, pesan: 'Semua siswa sudah tercatat presensi' };
  }

  // 5. Simpan presensi ALPA ke database
  const catatan = `Ditandai otomatis: tidak hadir hingga batas alpa (${aturan.batasAlpa})`;
  const dibuat = await prisma.attendance.createMany({
    data: siswaBelumAbsen.map((s) => ({
      student_id: s.id,
      class_id: s.class_id,
      attendance_date: tglDate,
      status: 'ALPA' as const,
      device_code: 'AUTO_ALPA',
      note: catatan,
    })),
    skipDuplicates: true,
  });

  // 6. Masukkan ke antrean notifikasi WhatsApp
  // (antrekanBanyak otomatis memeriksa apakah kejadian 'ALPA' diaktifkan di Pengaturan WhatsApp kirim_saat)
  const antreanList = siswaBelumAbsen.map((s) => ({
    siswaId: s.id,
    kejadian: 'ALPA' as const,
    waktu,
    catatan: 'Tidak ada keterangan hadir hingga batas waktu',
  }));

  const hasilWa = await antrekanBanyak(antreanList);

  terakhirDijalankanTanggal = tglStr;

  logger.info(
    {
      tanggal: tglStr,
      totalBelum: siswaBelumAbsen.length,
      ditandaiAlpa: dibuat.count,
      waDiantrekan: hasilWa.berhasil,
      waDilewati: hasilWa.gagal.length,
    },
    '[AUTO_ALPA] Penandaan ALPA otomatis selesai',
  );

  return {
    ok: true,
    tanggal: tglStr,
    totalBelum: siswaBelumAbsen.length,
    ditandaiAlpa: dibuat.count,
    waDiantrekan: hasilWa.berhasil,
  };
}

/**
 * Evaluasi berkala yang dijalankan setiap menit.
 */
export async function evaluasiAutoAlpa() {
  try {
    const sekarang = new Date();
    const tglStr = tanggalLokal(sekarang);
    const tglDate = tanggalKeKolomDate(tglStr);

    // Cek cache memori
    if (terakhirDijalankanTanggal === tglStr) {
      return;
    }

    const presensi = await ambilSetting('presensi');
    if (presensi.auto_alpa_aktif === false) {
      return;
    }

    const aturan = aturanUntukTanggal(presensi, sekarang);
    if (!aturan.hariSekolah) {
      return;
    }

    const menitSekarang = menitDalamHari(sekarang);
    const menitBatas = aturan.batasAlpaMenit;
    const menitPulang = aturan.jamPulangMenit;

    // Batas waktu ALPA harus sudah tercapai dan sebelum jam pulang
    if (menitSekarang < menitBatas || menitSekarang >= menitPulang) {
      return;
    }

    // Cek apakah hari ini sudah pernah ada eksekusi AUTO_ALPA di database
    // (misal server direstart sesudah pukul batas alpa)
    const sudahPernah = await prisma.attendance.findFirst({
      where: {
        attendance_date: tglDate,
        device_code: 'AUTO_ALPA',
      },
      select: { id: true },
    });

    if (sudahPernah) {
      terakhirDijalankanTanggal = tglStr;
      return;
    }

    logger.info(
      { jamSekarang: jamLokal(sekarang), batasAlpa: aturan.batasAlpa },
      '[AUTO_ALPA] Batas waktu alpa tercapai, memulai eksekusi penandaan ALPA...',
    );

    await jalankanAutoAlpa();
  } catch (err) {
    logger.error({ err }, '[AUTO_ALPA] Gagal saat evaluasi berkala');
  }
}

/**
 * Memulai penjadwal otomatis ALPA (evaluasi tiap menit di zona Asia/Jakarta).
 */
export function mulaiPenjadwalAlpa() {
  if (cronTask) return;

  // Berjalan setiap menit untuk mengevaluasi waktu terhadap aturan presensi yang dinamis
  cronTask = cron.schedule(
    '* * * * *',
    () => {
      void evaluasiAutoAlpa();
    },
    {
      timezone: 'Asia/Jakarta',
    },
  );

  logger.info('⏰ Penjadwal Otomatis ALPA aktif (Memeriksa batas_alpa setiap menit)');
}

/**
 * Menghentikan penjadwal otomatis ALPA.
 */
export function hentikanPenjadwalAlpa() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
