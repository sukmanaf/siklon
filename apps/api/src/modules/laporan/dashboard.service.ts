import { prisma } from '../../lib/prisma.js';
import { tanggalKeKolomDate, tanggalLokal } from '../../lib/waktu.js';
import { ambil as ambilSetting } from '../settings/settings.service.js';
import { statusAntrean } from '../whatsapp/dispatcher.js';
import { ambilProvider } from '../whatsapp/pengirim.js';
import { agentTersambung } from '../../realtime/socket.js';

/**
 * Dashboard dikumpulkan dalam SATU permintaan HTTP.
 *
 * Kalau dipecah jadi enam endpoint, halaman depan akan menembak enam query
 * bersamaan setiap kali dibuka — dan halaman inilah yang paling sering
 * di-refresh operator saat jam masuk, justru ketika database sedang paling sibuk.
 */
export async function dashboard(tanggal?: string) {
  const hari = tanggal ?? tanggalLokal();
  const tgl = tanggalKeKolomDate(hari);

  const [hariIni, tren, kelasTerendah, aktivitas, siswaAktif, presensi] = await Promise.all([
    prisma.$queryRaw<
      { hadir: number; terlambat: number; izin: number; sakit: number; alpa: number; tercatat: number }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'HADIR')::int     AS hadir,
        COUNT(*) FILTER (WHERE status = 'TERLAMBAT')::int AS terlambat,
        COUNT(*) FILTER (WHERE status = 'IZIN')::int      AS izin,
        COUNT(*) FILTER (WHERE status = 'SAKIT')::int     AS sakit,
        COUNT(*) FILTER (WHERE status = 'ALPA')::int      AS alpa,
        COUNT(*)::int                                     AS tercatat
      FROM attendance WHERE attendance_date = ${tgl}::date
    `,

    // Tren 14 hari. Hanya hari yang punya data yang muncul, jadi akhir pekan
    // tidak menghasilkan titik 0% yang membuat grafiknya menyesatkan.
    prisma.$queryRaw<{ tanggal: string; persen: number | null; tercatat: number }[]>`
      SELECT attendance_date::text AS tanggal,
             ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('HADIR','TERLAMBAT'))
                   / NULLIF(COUNT(*), 0), 1)::float8 AS persen,
             COUNT(*)::int AS tercatat
      FROM attendance
      WHERE attendance_date > ${tgl}::date - INTERVAL '21 days'
        AND attendance_date <= ${tgl}::date
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
      LIMIT 14
    `,

    prisma.$queryRaw<
      { kelas: string; total: number; alpa: number; persen: number | null }[]
    >`
      SELECT c.name AS kelas,
             COUNT(a.id)::int                                     AS total,
             COUNT(*) FILTER (WHERE a.status = 'ALPA')::int        AS alpa,
             ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('HADIR','TERLAMBAT'))
                   / NULLIF(COUNT(a.id), 0), 1)::float8           AS persen
      FROM classes c
      JOIN students s   ON s.class_id = c.id AND s.is_active
      JOIN attendance a ON a.student_id = s.id AND a.attendance_date = ${tgl}::date
      WHERE c.is_active
      GROUP BY c.id, c.name
      HAVING COUNT(a.id) > 0
      ORDER BY persen ASC NULLS LAST
      LIMIT 5
    `,

    prisma.$queryRaw<
      { nis: string; nama: string; kelas: string | null; status: string; jam: string; titik: string | null }[]
    >`
      SELECT s.nis, s.full_name AS nama, c.name AS kelas, a.status::text AS status,
             to_char(a.check_in_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam,
             a.device_code AS titik
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN classes c ON c.id = a.class_id
      WHERE a.attendance_date = ${tgl}::date AND a.check_in_at IS NOT NULL
      ORDER BY a.check_in_at DESC
      LIMIT 10
    `,

    prisma.students.count({ where: { is_active: true } }),
    ambilSetting('presensi'),
  ]);

  const h = hariIni[0] ?? { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0, tercatat: 0 };
  const hadirTotal = h.hadir + h.terlambat;

  const [tanpaWali, notifikasiMati] = await Promise.all([
    prisma.students.count({ where: { is_active: true, guardian_phone: null } }),
    prisma.students.count({ where: { is_active: true, notify: false } }),
  ]);

  const p = ambilProvider();

  return {
    tanggal: hari,
    jamMasuk: presensi.jam_masuk,
    batasTerlambat: presensi.jam_masuk,
    siswaAktif,
    hariIni: {
      ...h,
      belum: siswaAktif - h.tercatat,
      persenHadir: h.tercatat > 0 ? Number(((hadirTotal / h.tercatat) * 100).toFixed(1)) : null,
    },
    // Dikembalikan urut naik agar frontend tidak perlu membalik sendiri.
    tren: [...tren].reverse(),
    kelasPerluPerhatian: kelasTerendah,
    aktivitasTerakhir: aktivitas,
    /**
     * "Lubang" data. Siswa tanpa wali atau dengan notifikasi mati tetap
     * tercatat presensinya, tapi orang tuanya tidak pernah dikabari — dan itu
     * kegagalan senyap untuk sistem yang tujuannya justru mengabari orang tua.
     */
    perluDibenahi: { siswaTanpaWali: tanpaWali, notifikasiMati },
    sistem: {
      scannerAgentOnline: agentTersambung(),
      whatsapp: { provider: p.nama, tersambung: p.siap() },
      antrean: await statusAntrean(),
    },
  };
}
