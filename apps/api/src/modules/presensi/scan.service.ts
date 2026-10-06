import type { HasilScan } from '@siklon/shared';
import { prisma } from '../../lib/prisma.js';
import { jamDetikLokal, jamLokal, tanggalKeKolomDate, tanggalLokal } from '../../lib/waktu.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { sudahJamPulang, tentukanStatus } from './resolver.js';
import { logger } from '../../config/logger.js';
import { antrekanAman } from '../whatsapp/antrean.service.js';

export type PermintaanScan = {
  /** Isi QR/barcode kartu = NIS siswa. */
  nis: string;
  /**
   * Kode titik scan bila diketahui. Boleh dikosongkan: scan dari kamera di
   * browser adalah scan yang sah, dan sistem ini tidak perlu mencatat siswa
   * absen lewat gerbang mana.
   */
  titikScan?: string | null;
  waktu: Date;
  /** MANUAL diisi admin lewat UI; catatan wajib ada supaya jejaknya jelas. */
  manual?: { olehUserId: string; catatan: string };
};

const fotoUrl = (id: string, punyaFoto: boolean) =>
  punyaFoto ? `/api/v1/students/${id}/foto` : null;

/**
 * Inti sistem: satu scan masuk, satu keputusan keluar.
 *
 * Selalu mengembalikan objek HasilScan, tidak pernah melempar untuk kasus
 * yang wajar (NIS tak dikenal, hari libur, sudah absen). Layar operator butuh
 * pesan yang bisa dibaca, bukan 500.
 */
export async function prosesScan(req: PermintaanScan): Promise<HasilScan> {
  const jam = jamDetikLokal(req.waktu);
  const dasar = { jam, titikScan: req.titikScan ?? null };

  const siswa = await prisma.students.findUnique({
    where: { nis: req.nis },
    select: {
      id: true,
      nis: true,
      full_name: true,
      is_active: true,
      photo_path: true,
      class_id: true,
      classes: { select: { name: true } },
    },
  });

  if (!siswa) {
    return { ok: false, kode: 'NIS_TIDAK_DITEMUKAN', pesan: `NIS ${req.nis} tidak terdaftar`, ...dasar };
  }

  const info = {
    id: siswa.id,
    nis: siswa.nis,
    nama: siswa.full_name,
    kelas: siswa.classes?.name ?? null,
    fotoUrl: fotoUrl(siswa.id, Boolean(siswa.photo_path)),
  };

  if (!siswa.is_active) {
    return { ok: false, kode: 'SISWA_NONAKTIF', pesan: `${siswa.full_name} tidak aktif`, siswa: info, ...dasar };
  }

  const tanggal = tanggalLokal(req.waktu);
  const presensi = await ambilSetting('presensi');

  const libur = await prisma.holidays.findUnique({ where: { holiday_date: tanggalKeKolomDate(tanggal) } });
  const hasil = tentukanStatus(presensi, req.waktu, { hariLibur: libur?.name ?? null });

  if (hasil.jenis === 'HARI_LIBUR') {
    return { ok: false, kode: 'HARI_LIBUR', pesan: hasil.alasan, siswa: info, ...dasar };
  }

  /*
   * Scan pertama hari itu yang SESUDAH jam pulang bukanlah kedatangan.
   *
   * Tanpa perlakuan khusus, siswa yang jam masuknya tidak sempat tercatat
   * (scanner mati pagi itu, atau kartunya ketinggalan) lalu menempel kartu
   * saat pulang akan tercatat "TERLAMBAT 457 menit" — angka yang jelas omong
   * kosong, dan menuduh siswa yang sebenarnya hadir sejak pagi.
   *
   * Yang dicatat: jam pulangnya saja. Jam masuk dibiarkan KOSONG, bukan
   * ditebak — laporan menampilkannya sebagai "—" sehingga jelas terlihat ada
   * yang perlu dilengkapi admin.
   *
   * Presensi manual dikecualikan: di situ admin memang sedang menyatakan
   * siswanya hadir, jam berapa pun ia menekannya.
   */
  const pulangSaja = !req.manual && sudahJamPulang(presensi, req.waktu);

  // Scan pertama hari itu yang menang. Tidak ada DO UPDATE, jadi status HADIR
  // tidak bisa berubah gara-gara siswa scan dua kali, dan IZIN/SAKIT yang
  // sudah diisi admin otomatis aman.
  const dibuat = await prisma.attendance.createMany({
    data: [
      {
        student_id: siswa.id,
        class_id: siswa.class_id,
        attendance_date: tanggalKeKolomDate(tanggal),
        status: pulangSaja ? 'HADIR' : hasil.status,
        check_in_at: pulangSaja ? null : req.waktu,
        check_out_at: pulangSaja ? req.waktu : null,
        late_minutes: pulangSaja ? 0 : hasil.terlambatMenit,
        device_code: req.manual ? 'MANUAL' : (req.titikScan ?? null),
        note: pulangSaja
          ? 'Jam masuk tidak tercatat — hanya scan pulang'
          : (req.manual?.catatan ?? null),
        updated_by: req.manual?.olehUserId ?? null,
      },
    ],
    skipDuplicates: true,
  });

  if (dibuat.count === 0) {
    return tanganiSudahAdaBaris(siswa.id, tanggal, info, dasar, hasil, req, presensi);
  }

  if (pulangSaja) {
    logger.info({ nis: siswa.nis, jam: jamLokal(req.waktu) }, 'Absen pulang tercatat tanpa jam masuk');
    const waDiantrekan = await antrekanAman({
      siswaId: siswa.id,
      kejadian: 'PULANG',
      waktu: req.waktu,
    });
    return {
      ok: true,
      jenis: 'PULANG',
      pesan: `Pulang pukul ${jamLokal(req.waktu)} — jam masuk tidak tercatat`,
      siswa: info,
      status: 'HADIR',
      jamPulang: jamLokal(req.waktu),
      waDiantrekan,
      ...dasar,
    };
  }

  logger.info(
    { nis: siswa.nis, status: hasil.status, titik: req.titikScan },
    'Presensi tercatat',
  );

  // Notifikasi diantrekan, tidak dikirim di sini: saat jam masuk ratusan siswa
  // scan dalam hitungan menit, dan jeda anti-blokir 3-8 detik per pesan akan
  // membuat layar operator menunggu. antrekanAman() tidak pernah melempar,
  // jadi kegagalan notifikasi tidak membatalkan presensi yang sudah tercatat.
  const waDiantrekan = await antrekanAman({
    siswaId: siswa.id,
    kejadian: hasil.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'MASUK',
    waktu: req.waktu,
    menitTerlambat: hasil.terlambatMenit,
  });

  return {
    ok: true,
    jenis: 'MASUK',
    pesan: hasil.pesan,
    siswa: info,
    status: hasil.status,
    terlambatMenit: hasil.terlambatMenit,
    waDiantrekan,
    ...dasar,
  };
}

/**
 * Sudah ada baris untuk hari ini. Ada tiga kemungkinan, dan hanya satu yang
 * perlu tindakan: siswa yang sudah ditandai ALPA lalu ternyata datang.
 */
async function tanganiSudahAdaBaris(
  siswaId: string,
  tanggal: string,
  info: NonNullable<HasilScan['siswa']>,
  dasar: { jam: string; titikScan: string | null },
  hasil: Extract<ReturnType<typeof tentukanStatus>, { jenis: 'DITERIMA' }>,
  req: PermintaanScan,
  presensi: Awaited<ReturnType<typeof ambilSetting<'presensi'>>>,
): Promise<HasilScan> {
  const ada = await prisma.attendance.findUnique({
    where: { student_id_attendance_date: { student_id: siswaId, attendance_date: tanggalKeKolomDate(tanggal) } },
  });

  if (!ada) {
    // Sangat jarang: baris terhapus antara createMany dan pembacaan ini.
    return { ok: false, kode: 'GAGAL', pesan: 'Gagal mencatat presensi, coba lagi', siswa: info, ...dasar };
  }

  if (ada.status === 'IZIN' || ada.status === 'SAKIT') {
    return {
      ok: false,
      kode: 'SUDAH_IZIN',
      pesan: `${info.nama} tercatat ${ada.status} hari ini`,
      siswa: info,
      ...dasar,
    };
  }

  /*
   * Sampai sini berarti siswanya sudah punya baris presensi hari ini. Dulu
   * semua scan berikutnya ditolak sebagai "sudah absen". Sekarang ada satu
   * kemungkinan lagi: ini scan PULANG.
   *
   * Pembedanya jam, bukan urutan. Scan kedua pukul 09:30 hampir pasti kartu
   * yang tertempel dua kali; scan kedua pukul 13:05 hampir pasti siswa yang
   * pulang. Batasnya jam_pulang milik hari itu, jadi Jumat yang pulang lebih
   * awal ikut terbaca benar.
   */
  if (ada.check_out_at) {
    return {
      ok: false,
      kode: 'SUDAH_PULANG',
      pesan: `${info.nama} sudah absen pulang pukul ${jamLokal(ada.check_out_at)}`,
      siswa: info,
      jenis: 'PULANG',
      jamPulang: jamLokal(ada.check_out_at),
      status: ada.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR',
      ...dasar,
    };
  }

  if (!req.manual && sudahJamPulang(presensi, req.waktu)) {
    /*
     * Baris yang sudah ditandai ALPA tapi siswanya menempel kartu saat pulang
     * berarti ia memang hadir — hanya jam masuknya yang tidak tercatat.
     * Statusnya dikoreksi ke HADIR, dan jam masuk sengaja dibiarkan kosong
     * daripada ditebak dari jam pulang.
     */
    const alpaTerkoreksi = ada.status === 'ALPA';
    const baru = await prisma.attendance.update({
      where: { id: ada.id },
      data: {
        check_out_at: req.waktu,
        ...(alpaTerkoreksi
          ? {
              status: 'HADIR' as const,
              late_minutes: 0,
              note: 'Koreksi: hadir tapi jam masuk tidak tercatat, ketahuan dari scan pulang',
            }
          : {}),
      },
    });
    logger.info({ nis: info.nis, jam: jamLokal(req.waktu) }, 'Absen pulang tercatat');

    // Notifikasi pulang hanya terkirim bila 'PULANG' dimasukkan ke kirim_saat
    // di Pengaturan — bawaannya mati. Lihat catatan volume di docs/PLAN.md.
    const waDiantrekan = await antrekanAman({
      siswaId: info.id,
      kejadian: 'PULANG',
      waktu: req.waktu,
    });

    return {
      ok: true,
      jenis: 'PULANG',
      pesan: alpaTerkoreksi
        ? `Pulang pukul ${jamLokal(req.waktu)} — status ALPA dikoreksi jadi HADIR`
        : `Pulang pukul ${jamLokal(req.waktu)}`,
      siswa: info,
      status: baru.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR',
      jamPulang: jamLokal(baru.check_out_at!),
      waDiantrekan,
      ...dasar,
    };
  }

  if (ada.status === 'ALPA') {
    // Job pukul 09:00 sudah menandai alpa, tapi siswanya ternyata datang
    // (terlambat jauh, atau agent baru sinkron setelah offline). Status harus
    // dikoreksi, dan wali murid perlu dikabari kalau tadi sudah dikirimi
    // pesan "belum tercatat hadir".
    const baru = await prisma.attendance.update({
      where: { id: ada.id },
      data: {
        status: hasil.status,
        check_in_at: req.waktu,
        late_minutes: hasil.terlambatMenit,
        device_code: req.manual ? 'MANUAL' : (req.titikScan ?? null),
        note: req.manual?.catatan ?? 'Koreksi otomatis: siswa datang setelah ditandai alpa',
        updated_by: req.manual?.olehUserId ?? null,
      },
    });
    logger.info({ nis: info.nis, dari: 'ALPA', ke: baru.status }, 'Status alpa dikoreksi oleh scan susulan');

    // Wali murid tadi sudah dikabari "belum tercatat hadir", jadi koreksinya
    // wajib dikabarkan juga — kalau tidak, orang tua dibiarkan salah paham.
    const waDiantrekan = await antrekanAman({
      siswaId: info.id,
      kejadian: hasil.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'MASUK',
      waktu: req.waktu,
      menitTerlambat: hasil.terlambatMenit,
    });

    return {
      ok: true,
      jenis: 'MASUK',
      pesan: `${hasil.pesan} — status ALPA dikoreksi`,
      siswa: info,
      status: hasil.status,
      terlambatMenit: hasil.terlambatMenit,
      waDiantrekan,
      ...dasar,
    };
  }

  return {
    ok: false,
    kode: 'SUDAH_ABSEN',
    pesan: `${info.nama} sudah absen pukul ${ada.check_in_at ? jamLokal(ada.check_in_at) : '-'}`,
    siswa: info,
    jenis: 'MASUK',
    status: ada.status === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR',
    ...dasar,
  };
}
