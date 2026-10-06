import { prisma } from '../../lib/prisma.js';
import { NotFound } from '../../lib/errors.js';
import { tanggalKeKolomDate } from '../../lib/waktu.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';

/**
 * Seluruh laporan memakai raw SQL, bukan ORM.
 *
 * Alasannya bukan selera: `COUNT(*) FILTER (WHERE ...)`, `generate_series`,
 * dan `jsonb_object_agg` tidak punya padanan di query builder mana pun, dan
 * mengerjakannya di JavaScript berarti menarik ribuan baris ke memori untuk
 * dihitung ulang.
 *
 * Catatan penting: setiap COUNT di PostgreSQL menghasilkan `bigint`, yang oleh
 * Prisma dipetakan ke `BigInt` — dan `JSON.stringify` melempar pada BigInt.
 * Karena itu semua agregat di-cast `::int` di SQL-nya, bukan dikonversi di JS.
 */

const KODE_STATUS: Record<string, string> = {
  HADIR: 'H',
  TERLAMBAT: 'T',
  IZIN: 'I',
  SAKIT: 'S',
  ALPA: 'A',
};

type BarisHarian = {
  nis: string;
  nama: string;
  kelas: string | null;
  status: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  terlambat: number;
  titik_scan: string | null;
  catatan: string | null;
  diubah_manual: boolean;
  wa_status: string | null;
};

/** Laporan harian satu kelas (atau seluruh sekolah bila kelasId tidak diisi). */
export async function harianPerKelas(tanggal: string, kelasId?: string) {
  const tgl = tanggalKeKolomDate(tanggal);

  const baris = await prisma.$queryRaw<BarisHarian[]>`
    SELECT
      s.nis,
      s.full_name AS nama,
      c.name      AS kelas,
      COALESCE(a.status::text, 'BELUM')                                        AS status,
      to_char(a.check_in_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')            AS jam_masuk,
      to_char(a.check_out_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')           AS jam_pulang,
      COALESCE(a.late_minutes, 0)::int                                         AS terlambat,
      a.device_code                                                            AS titik_scan,
      a.note                                                                   AS catatan,
      (a.updated_by IS NOT NULL)                                               AS diubah_manual,
      (SELECT w.status::text FROM wa_messages w
        WHERE w.student_id = s.id AND w.created_at::date = ${tgl}::date
        ORDER BY w.created_at DESC LIMIT 1)                                    AS wa_status
    FROM students s
    LEFT JOIN classes    c ON c.id = s.class_id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = ${tgl}::date
    WHERE s.is_active
      AND (${kelasId ?? null}::uuid IS NULL OR s.class_id = ${kelasId ?? null}::uuid)
    ORDER BY c.name NULLS LAST, s.full_name
  `;

  const hitung = (st: string) => baris.filter((b) => b.status === st).length;
  const tercatat = baris.length - hitung('BELUM');
  const hadirTotal = hitung('HADIR') + hitung('TERLAMBAT');

  let kelas: { id: string; nama: string } | null = null;
  if (kelasId) {
    const k = await prisma.classes.findUnique({ where: { id: kelasId } });
    if (!k) throw NotFound('Kelas tidak ditemukan');
    kelas = { id: k.id, nama: k.name };
  }

  return {
    tanggal,
    kelas,
    ringkasan: {
      total: baris.length,
      hadir: hitung('HADIR'),
      terlambat: hitung('TERLAMBAT'),
      izin: hitung('IZIN'),
      sakit: hitung('SAKIT'),
      alpa: hitung('ALPA'),
      belum: hitung('BELUM'),
      persenHadir: tercatat > 0 ? Number(((hadirTotal / tercatat) * 100).toFixed(1)) : null,
    },
    baris,
  };
}

type BarisRekapKelas = {
  kelas_id: string | null;
  kelas: string | null;
  total: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  belum: number;
  persen_hadir: number | null;
};

/** Rekap semua kelas dalam satu tabel + baris total sekolah. */
export async function rekapSemuaKelas(tanggal: string) {
  const tgl = tanggalKeKolomDate(tanggal);

  const baris = await prisma.$queryRaw<BarisRekapKelas[]>`
    SELECT
      c.id   AS kelas_id,
      c.name AS kelas,
      COUNT(s.id)::int                                              AS total,
      COUNT(*) FILTER (WHERE a.status = 'HADIR')::int               AS hadir,
      COUNT(*) FILTER (WHERE a.status = 'TERLAMBAT')::int           AS terlambat,
      COUNT(*) FILTER (WHERE a.status = 'IZIN')::int                AS izin,
      COUNT(*) FILTER (WHERE a.status = 'SAKIT')::int               AS sakit,
      COUNT(*) FILTER (WHERE a.status = 'ALPA')::int                AS alpa,
      COUNT(*) FILTER (WHERE a.id IS NULL)::int                     AS belum,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE a.status IN ('HADIR','TERLAMBAT'))
        / NULLIF(COUNT(*) FILTER (WHERE a.id IS NOT NULL), 0), 1
      )::float8                                                     AS persen_hadir
    FROM classes c
    JOIN students s ON s.class_id = c.id AND s.is_active
    LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = ${tgl}::date
    WHERE c.is_active
    GROUP BY c.id, c.name
    ORDER BY c.grade_level NULLS LAST, c.name
  `;

  const jumlah = (k: keyof BarisRekapKelas) =>
    baris.reduce((t, b) => t + (Number(b[k]) || 0), 0);

  const total = jumlah('total');
  const tercatat = total - jumlah('belum');
  const hadirTotal = jumlah('hadir') + jumlah('terlambat');

  return {
    tanggal,
    kelas: baris,
    totalSekolah: {
      total,
      hadir: jumlah('hadir'),
      terlambat: jumlah('terlambat'),
      izin: jumlah('izin'),
      sakit: jumlah('sakit'),
      alpa: jumlah('alpa'),
      belum: jumlah('belum'),
      persenHadir: tercatat > 0 ? Number(((hadirTotal / tercatat) * 100).toFixed(1)) : null,
    },
  };
}

/** Tanggal awal & akhir satu bulan dari 'YYYY-MM'. */
function rentangBulan(bulan: string) {
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    throw new Error(`Format bulan harus YYYY-MM, bukan "${bulan}"`);
  }
  const awal = `${bulan}-01`;
  const [th, bl] = bulan.split('-').map(Number);
  const akhirHari = new Date(Date.UTC(th!, bl!, 0)).getUTCDate();
  return { awal, akhir: `${bulan}-${String(akhirHari).padStart(2, '0')}`, jumlahHari: akhirHari };
}

type SelMatriks = {
  tanggal: number;
  kode: string;
  /** HH:MM, hanya untuk hari yang siswanya benar-benar scan. */
  jamMasuk?: string | null;
  jamPulang?: string | null;
};

/**
 * Matriks bulanan: siswa (baris) × tanggal (kolom).
 *
 * Hari libur dan akhir pekan ditandai 'L', bukan dihitung alpa. Ini penting:
 * kalau tidak dibedakan, persentase kehadiran tiap siswa akan turun sekitar 30%
 * hanya karena akhir pekan ikut dihitung.
 */
export async function bulananPerKelas(bulan: string, kelasId: string) {
  const { awal, akhir, jumlahHari } = rentangBulan(bulan);

  const kelas = await prisma.classes.findUnique({ where: { id: kelasId } });
  if (!kelas) throw NotFound('Kelas tidak ditemukan');

  const presensi = await ambilSetting('presensi');
  const hariSekolah = presensi.hari_sekolah;

  const [libur, siswa, catatan] = await Promise.all([
    prisma.holidays.findMany({
      where: {
        holiday_date: { gte: tanggalKeKolomDate(awal), lte: tanggalKeKolomDate(akhir) },
      },
    }),
    prisma.students.findMany({
      where: { class_id: kelasId, is_active: true },
      orderBy: { full_name: 'asc' },
      select: { id: true, nis: true, full_name: true },
    }),
    prisma.$queryRaw<
      {
        student_id: string;
        hari: number;
        status: string;
        terlambat: number;
        jam_masuk: string | null;
        jam_pulang: string | null;
      }[]
    >`
      SELECT student_id,
             EXTRACT(DAY FROM attendance_date)::int AS hari,
             status::text                          AS status,
             late_minutes::int                     AS terlambat,
             to_char(check_in_at  AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_masuk,
             to_char(check_out_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_pulang
      FROM attendance
      WHERE attendance_date BETWEEN ${tanggalKeKolomDate(awal)}::date AND ${tanggalKeKolomDate(akhir)}::date
        AND class_id = ${kelasId}::uuid
    `,
  ]);

  const petaLibur = new Map(
    libur.map((h) => [h.holiday_date.getUTCDate(), h.name]),
  );

  // Daftar hari efektif: hari sekolah yang bukan hari libur.
  const hariEfektif: number[] = [];
  for (let d = 1; d <= jumlahHari; d++) {
    const dow = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1, d)).getUTCDay();
    if (hariSekolah.includes(dow) && !petaLibur.has(d)) hariEfektif.push(d);
  }

  const petaCatatan = new Map<
    string,
    Map<number, { status: string; terlambat: number; jamMasuk: string | null; jamPulang: string | null }>
  >();
  for (const c of catatan) {
    if (!petaCatatan.has(c.student_id)) petaCatatan.set(c.student_id, new Map());
    petaCatatan.get(c.student_id)!.set(c.hari, {
      status: c.status,
      terlambat: c.terlambat,
      jamMasuk: c.jam_masuk,
      jamPulang: c.jam_pulang,
    });
  }

  const baris = siswa.map((s) => {
    const milik = petaCatatan.get(s.id) ?? new Map();
    const sel: SelMatriks[] = [];
    const n = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, belum: 0 };
    let totalMenitTerlambat = 0;

    for (let d = 1; d <= jumlahHari; d++) {
      if (!hariEfektif.includes(d)) {
        sel.push({ tanggal: d, kode: 'L' });
        continue;
      }
      const c = milik.get(d);
      if (!c) {
        sel.push({ tanggal: d, kode: '-' });
        n.belum++;
        continue;
      }
      sel.push({
        tanggal: d,
        kode: KODE_STATUS[c.status] ?? '?',
        jamMasuk: c.jamMasuk,
        jamPulang: c.jamPulang,
      });
      totalMenitTerlambat += c.terlambat;
      switch (c.status) {
        case 'HADIR': n.hadir++; break;
        case 'TERLAMBAT': n.terlambat++; break;
        case 'IZIN': n.izin++; break;
        case 'SAKIT': n.sakit++; break;
        case 'ALPA': n.alpa++; break;
      }
    }

    const tercatat = hariEfektif.length - n.belum;
    return {
      siswaId: s.id,
      nis: s.nis,
      nama: s.full_name,
      sel,
      ...n,
      totalMenitTerlambat,
      persenHadir:
        tercatat > 0 ? Number((((n.hadir + n.terlambat) / tercatat) * 100).toFixed(1)) : null,
    };
  });

  return {
    bulan,
    kelas: { id: kelas.id, nama: kelas.name },
    jumlahHari,
    hariEfektif,
    hariLibur: [...petaLibur.entries()].map(([tanggal, nama]) => ({ tanggal, nama })),
    legenda: { H: 'Hadir', T: 'Terlambat', I: 'Izin', S: 'Sakit', A: 'Alpa', L: 'Libur', '-': 'Tidak ada data' },
    baris,
  };
}

/** Rekap bulanan satu siswa: kalender + ringkasan + rata-rata jam datang. */
export async function bulananPerSiswa(bulan: string, siswaId: string) {
  const { awal, akhir, jumlahHari } = rentangBulan(bulan);

  const siswa = await prisma.students.findUnique({
    where: { id: siswaId },
    select: {
      id: true,
      nis: true,
      full_name: true,
      classes: { select: { name: true } },
      notify: true,
    },
  });
  if (!siswa) throw NotFound('Siswa tidak ditemukan');

  const presensi = await ambilSetting('presensi');

  const [libur, catatan, agregat] = await Promise.all([
    prisma.holidays.findMany({
      where: { holiday_date: { gte: tanggalKeKolomDate(awal), lte: tanggalKeKolomDate(akhir) } },
    }),
    prisma.$queryRaw<
      {
        hari: number;
        status: string;
        jam_masuk: string | null;
        jam_pulang: string | null;
        terlambat: number;
        catatan: string | null;
      }[]
    >`
      SELECT EXTRACT(DAY FROM attendance_date)::int                     AS hari,
             status::text                                               AS status,
             to_char(check_in_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_masuk,
             to_char(check_out_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_pulang,
             late_minutes::int                                          AS terlambat,
             note                                                       AS catatan
      FROM attendance
      WHERE student_id = ${siswaId}::uuid
        AND attendance_date BETWEEN ${tanggalKeKolomDate(awal)}::date AND ${tanggalKeKolomDate(akhir)}::date
      ORDER BY attendance_date
    `,
    prisma.$queryRaw<{ rata_menit: number | null }[]>`
      SELECT AVG(
               EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'Asia/Jakarta') * 60
             + EXTRACT(MINUTE FROM check_in_at AT TIME ZONE 'Asia/Jakarta')
             )::float8 AS rata_menit
      FROM attendance
      WHERE student_id = ${siswaId}::uuid
        AND check_in_at IS NOT NULL
        AND attendance_date BETWEEN ${tanggalKeKolomDate(awal)}::date AND ${tanggalKeKolomDate(akhir)}::date
    `,
  ]);

  const petaLibur = new Map(libur.map((h) => [h.holiday_date.getUTCDate(), h.name]));
  const petaCatatan = new Map(catatan.map((c) => [c.hari, c]));

  const kalender: {
    tanggal: number;
    hariSekolah: boolean;
    libur: string | null;
    status: string | null;
    jamMasuk: string | null;
    jamPulang: string | null;
    terlambat: number;
    catatan: string | null;
  }[] = [];

  let hariEfektif = 0;
  for (let d = 1; d <= jumlahHari; d++) {
    const dow = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1, d)).getUTCDay();
    const namaLibur = petaLibur.get(d) ?? null;
    const sekolah = presensi.hari_sekolah.includes(dow) && !namaLibur;
    if (sekolah) hariEfektif++;
    const c = petaCatatan.get(d);
    kalender.push({
      tanggal: d,
      hariSekolah: sekolah,
      libur: namaLibur,
      status: c?.status ?? null,
      jamMasuk: c?.jam_masuk ?? null,
      jamPulang: c?.jam_pulang ?? null,
      terlambat: c?.terlambat ?? 0,
      catatan: c?.catatan ?? null,
    });
  }

  const hitung = (st: string) => catatan.filter((c) => c.status === st).length;
  const tercatat = catatan.length;
  const rataMenit = agregat[0]?.rata_menit ?? null;

  return {
    bulan,
    siswa: {
      id: siswa.id,
      nis: siswa.nis,
      nama: siswa.full_name,
      kelas: siswa.classes?.name ?? null,
      notifikasiAktif: siswa.notify,
    },
    hariEfektif,
    ringkasan: {
      hadir: hitung('HADIR'),
      terlambat: hitung('TERLAMBAT'),
      izin: hitung('IZIN'),
      sakit: hitung('SAKIT'),
      alpa: hitung('ALPA'),
      belumTercatat: hariEfektif - tercatat,
      totalMenitTerlambat: catatan.reduce((t, c) => t + c.terlambat, 0),
      rataJamDatang:
        rataMenit === null
          ? null
          : `${String(Math.floor(rataMenit / 60)).padStart(2, '0')}:${String(Math.round(rataMenit % 60)).padStart(2, '0')}`,
      persenHadir:
        tercatat > 0
          ? Number((((hitung('HADIR') + hitung('TERLAMBAT')) / tercatat) * 100).toFixed(1))
          : null,
    },
    kalender,
  };
}

/** Peringkat siswa yang perlu perhatian dalam satu rentang tanggal. */
export async function perluPerhatian(dari: string, sampai: string, minimalAlpa = 1) {
  return prisma.$queryRaw<
    {
      nis: string;
      nama: string;
      kelas: string | null;
      alpa: number;
      terlambat: number;
      total_menit_terlambat: number;
      persen_hadir: number | null;
      notifikasi_aktif: boolean | null;
    }[]
  >`
    SELECT s.nis, s.full_name AS nama, c.name AS kelas,
           COUNT(*) FILTER (WHERE a.status = 'ALPA')::int       AS alpa,
           COUNT(*) FILTER (WHERE a.status = 'TERLAMBAT')::int  AS terlambat,
           COALESCE(SUM(a.late_minutes), 0)::int                AS total_menit_terlambat,
           ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('HADIR','TERLAMBAT'))
                 / NULLIF(COUNT(a.id), 0), 1)::float8           AS persen_hadir,
           s.notify        AS notifikasi_aktif
    FROM students s
    LEFT JOIN classes   c ON c.id = s.class_id
    JOIN attendance a ON a.student_id = s.id
      AND a.attendance_date BETWEEN ${tanggalKeKolomDate(dari)}::date AND ${tanggalKeKolomDate(sampai)}::date
    WHERE s.is_active
    GROUP BY s.id, s.nis, s.full_name, c.name, s.notify
    HAVING COUNT(*) FILTER (WHERE a.status = 'ALPA') >= ${minimalAlpa}
    ORDER BY alpa DESC, terlambat DESC
    LIMIT 100
  `;
}
