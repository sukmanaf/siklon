import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { tanggalKeKolomDate } from '../src/lib/waktu.js';
import { prosesScan } from '../src/modules/presensi/scan.service.js';
import { kosongkanCache } from '../src/modules/settings/settings.service.js';

const NIS = 'UJI900001';
let siswaId = '';
let kelasId: string | null = null;

const bersihkan = async () => {
  const s = await prisma.students.findUnique({ where: { nis: NIS } });
  if (s) {
    await prisma.attendance.deleteMany({ where: { student_id: s.id } });
    await prisma.students.delete({ where: { id: s.id } });
  }
};

beforeAll(async () => {
  kosongkanCache();
  await bersihkan();
  const k = await prisma.classes.findFirst({ where: { name: 'VII-A' } });
  kelasId = k?.id ?? null;
  const s = await prisma.students.create({
    data: { nis: NIS, full_name: 'Siswa Uji Presensi', class_id: kelasId },
  });
  siswaId = s.id;
});
afterAll(async () => {
  await bersihkan();
  await prisma.$disconnect();
});

const hapusPresensi = () => prisma.attendance.deleteMany({ where: { student_id: siswaId } });
const pada = (iso: string) => new Date(iso);

describe('REGRESI: timestamptz tidak boleh bergeser', () => {
  it('nilai yang dibaca raw SQL sama dengan yang dibaca ORM', async () => {
    await hapusPresensi();
    const waktu = pada('2026-09-08T07:22:00+07:00');
    await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu });

    const lewatOrm = await prisma.attendance.findFirst({ where: { student_id: siswaId } });
    const lewatSql = await prisma.$queryRaw<{ ep: number }[]>`
      SELECT extract(epoch from check_in_at) * 1000 AS ep
      FROM attendance WHERE student_id = ${siswaId}::uuid`;

    // Bug yang pernah terjadi: Prisma mengirim timestamp sebagai waktu UTC tanpa
    // offset sementara sesi Postgres ber-timezone Asia/Jakarta. ORM terlihat
    // benar karena salahnya dua kali, tapi raw SQL — dan seluruh laporan —
    // membaca nilai yang bergeser 7 jam.
    expect(Number(lewatSql[0]!.ep)).toBe(lewatOrm!.check_in_at!.getTime());
    expect(lewatOrm!.check_in_at!.toISOString()).toBe('2026-09-08T00:22:00.000Z');
  });

  it('attendance_date tercatat di tanggal lokal yang benar, bukan bergeser sehari', async () => {
    await hapusPresensi();
    // 00:30 WIB: tanggal UTC-nya masih 7 September — jebakan klasik.
    await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu: pada('2026-09-08T00:30:00+07:00') });
    const a = await prisma.attendance.findFirst({ where: { student_id: siswaId } });
    const tglSql = await prisma.$queryRaw<{ t: string }[]>`
      SELECT attendance_date::text AS t FROM attendance WHERE student_id = ${siswaId}::uuid`;
    expect(tglSql[0]!.t).toBe('2026-09-08');
    expect(a!.attendance_date.toISOString().slice(0, 10)).toBe('2026-09-08');
  });
});

describe('REGRESI: hari libur nasional harus ditolak', () => {
  it('scan pada 17 Agustus ditolak, bukan tercatat terlambat', async () => {
    await hapusPresensi();
    const h = await prosesScan({
      nis: NIS,
      titikScan: 'GATE-A',
      waktu: pada('2026-08-17T07:00:00+07:00'),
    });
    // Pernah lolos karena pencarian holidays memakai tengah malam LOKAL,
    // sementara kolom DATE dipetakan Prisma ke tengah malam UTC.
    expect(h.ok).toBe(false);
    expect(h.kode).toBe('HARI_LIBUR');
    expect(h.pesan).toContain('Kemerdekaan');
    expect(await prisma.attendance.count({ where: { student_id: siswaId } })).toBe(0);
  });
});

describe('alur scan', () => {
  it('scan pertama tercatat, scan kedua diabaikan tanpa mengubah status', async () => {
    await hapusPresensi();
    const pertama = await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu: pada('2026-09-08T07:22:00+07:00') });
    expect(pertama.ok).toBe(true);
    expect(pertama.status).toBe('TERLAMBAT');
    expect(pertama.terlambatMenit).toBe(12);

    // Scan kedua jam 06:50 (yang akan menghasilkan HADIR) TIDAK boleh
    // menurunkan status yang sudah TERLAMBAT.
    const kedua = await prosesScan({ nis: NIS, titikScan: 'GATE-B', waktu: pada('2026-09-08T07:50:00+07:00') });
    expect(kedua.ok).toBe(false);
    expect(kedua.kode).toBe('SUDAH_ABSEN');

    const semua = await prisma.attendance.findMany({ where: { student_id: siswaId } });
    expect(semua).toHaveLength(1);
    expect(semua[0]!.status).toBe('TERLAMBAT');
    expect(semua[0]!.device_code).toBe('GATE-A');
  });

  it('NIS tidak terdaftar dijawab halus, bukan melempar', async () => {
    const h = await prosesScan({ nis: 'TIDAKADA999', titikScan: 'GATE-A', waktu: new Date() });
    expect(h.ok).toBe(false);
    expect(h.kode).toBe('NIS_TIDAK_DITEMUKAN');
  });

  it('siswa nonaktif ditolak', async () => {
    await prisma.students.update({ where: { id: siswaId }, data: { is_active: false } });
    const h = await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu: pada('2026-09-08T07:00:00+07:00') });
    expect(h.kode).toBe('SISWA_NONAKTIF');
    await prisma.students.update({ where: { id: siswaId }, data: { is_active: true } });
  });

  it('status IZIN yang diisi admin tidak bisa ditimpa scan', async () => {
    await hapusPresensi();
    await prisma.attendance.create({
      data: {
        student_id: siswaId,
        class_id: kelasId,
        attendance_date: tanggalKeKolomDate('2026-09-08'),
        status: 'IZIN',
        note: 'Acara keluarga',
      },
    });

    const h = await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu: pada('2026-09-08T07:00:00+07:00') });
    expect(h.ok).toBe(false);
    expect(h.kode).toBe('SUDAH_IZIN');

    const a = await prisma.attendance.findFirst({ where: { student_id: siswaId } });
    expect(a!.status).toBe('IZIN');
    expect(a!.note).toBe('Acara keluarga');
  });

  it('siswa yang sudah ditandai ALPA lalu datang: status dikoreksi otomatis', async () => {
    await hapusPresensi();
    await prisma.attendance.create({
      data: {
        student_id: siswaId,
        class_id: kelasId,
        attendance_date: tanggalKeKolomDate('2026-09-08'),
        status: 'ALPA',
      },
    });

    const h = await prosesScan({ nis: NIS, titikScan: 'GATE-A', waktu: pada('2026-09-08T09:30:00+07:00') });
    expect(h.ok).toBe(true);
    expect(h.status).toBe('TERLAMBAT');
    expect(h.pesan).toContain('dikoreksi');

    const a = await prisma.attendance.findFirst({ where: { student_id: siswaId } });
    expect(a!.status).toBe('TERLAMBAT');
    expect(a!.check_in_at).not.toBeNull();
    expect(a!.note).toContain('Koreksi otomatis');
  });
});
