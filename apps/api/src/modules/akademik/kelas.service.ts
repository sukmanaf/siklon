import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { aktif as tahunAktif } from './tahunAjaran.service.js';

export async function daftar(opsi: { tahunId?: number; tingkat?: number } = {}) {
  const tahunId = opsi.tahunId ?? (await tahunAktif()).id;
  return prisma.classes.findMany({
    where: {
      academic_year_id: tahunId,
      ...(opsi.tingkat ? { grade_level: opsi.tingkat } : {}),
    },
    orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { students: true } } },
  });
}

export async function buat(data: {
  name: string;
  grade_level?: number;
  academic_year_id?: number;
}) {
  const tahunId = data.academic_year_id ?? (await tahunAktif()).id;
  const ada = await prisma.classes.findFirst({
    where: { academic_year_id: tahunId, name: data.name },
  });
  if (ada) throw Conflict(`Kelas "${data.name}" sudah ada di tahun ajaran ini`);

  return prisma.classes.create({
    data: {
      name: data.name,
      grade_level: data.grade_level ?? null,
      academic_year_id: tahunId,
    },
  });
}

export async function ubah(
  id: string,
  data: { name?: string; grade_level?: number; is_active?: boolean },
) {
  const kelas = await prisma.classes.findUnique({ where: { id } });
  if (!kelas) throw NotFound('Kelas tidak ditemukan');

  if (data.name && data.name !== kelas.name) {
    const bentrok = await prisma.classes.findFirst({
      where: { academic_year_id: kelas.academic_year_id, name: data.name, id: { not: id } },
    });
    if (bentrok) throw Conflict(`Kelas "${data.name}" sudah ada di tahun ajaran ini`);
  }

  return prisma.classes.update({ where: { id }, data });
}

export async function hapus(id: string) {
  const kelas = await prisma.classes.findUnique({
    where: { id },
    include: { _count: { select: { students: true, attendance: true } } },
  });
  if (!kelas) throw NotFound('Kelas tidak ditemukan');
  if (kelas._count.students > 0) {
    throw Conflict(
      `Kelas masih berisi ${kelas._count.students} siswa. Pindahkan siswanya dulu.`,
    );
  }
  if (kelas._count.attendance > 0) {
    // Menghapus kelas yang punya riwayat presensi akan membuat laporan lama
    // kehilangan nama kelasnya. Lebih baik dinonaktifkan.
    throw Conflict(
      `Kelas punya ${kelas._count.attendance} catatan presensi. Nonaktifkan saja, jangan dihapus, agar laporan lama tetap utuh.`,
    );
  }
  await prisma.classes.delete({ where: { id } });
  return { pesan: 'Kelas dihapus' };
}

export async function anggota(id: string) {
  const kelas = await prisma.classes.findUnique({ where: { id } });
  if (!kelas) throw NotFound('Kelas tidak ditemukan');
  return prisma.students.findMany({
    where: { class_id: id, is_active: true },
    orderBy: { full_name: 'asc' },
    select: {
      id: true, nis: true, full_name: true, photo_path: true,
      guardian_phone: true, notify: true,
    },
  });
}

/**
 * Salin struktur kelas dari satu tahun ajaran ke tahun lain.
 *
 * Kelas terikat ke tahun ajaran (`UNIQUE (academic_year_id, name)`), jadi
 * tahun baru selalu mulai tanpa kelas sama sekali. Tanpa penyalinan ini, admin
 * harus membuat enam kelas satu per satu tiap pergantian tahun — pekerjaan
 * berulang yang isinya persis sama tiap tahun.
 *
 * Yang disalin cuma KERANGKANYA: nama dan tingkat. Siswanya tidak ikut, karena
 * memindahkan siswa adalah keputusan terpisah (kenaikan kelas), dan seorang
 * siswa kelas VII tahun ini harusnya masuk VIII tahun depan — bukan VII lagi.
 */
export async function salinKeTahun(data: { dariTahunId?: number; keTahunId: number }) {
  const dariId = data.dariTahunId ?? (await tahunAktif()).id;
  if (dariId === data.keTahunId) {
    throw BadRequest('Tahun ajaran asal dan tujuan tidak boleh sama');
  }

  const [asal, tujuan] = await Promise.all([
    prisma.academic_years.findUnique({ where: { id: dariId } }),
    prisma.academic_years.findUnique({ where: { id: data.keTahunId } }),
  ]);
  if (!asal) throw NotFound('Tahun ajaran asal tidak ditemukan');
  if (!tujuan) throw NotFound('Tahun ajaran tujuan tidak ditemukan');

  const sumber = await prisma.classes.findMany({
    where: { academic_year_id: dariId, is_active: true },
    orderBy: [{ grade_level: 'asc' }, { name: 'asc' }],
    select: { name: true, grade_level: true },
  });
  if (sumber.length === 0) {
    throw BadRequest(`Tahun ajaran ${asal.name} belum punya kelas yang bisa disalin`);
  }

  // skipDuplicates bersandar pada UNIQUE (academic_year_id, name): menjalankan
  // penyalinan dua kali tidak menggandakan kelas, hanya melewatinya.
  const { count } = await prisma.classes.createMany({
    data: sumber.map((k) => ({
      academic_year_id: data.keTahunId,
      name: k.name,
      grade_level: k.grade_level,
    })),
    skipDuplicates: true,
  });

  return {
    tahunAsal: asal.name,
    tahunTujuan: tujuan.name,
    dibuat: count,
    dilewati: sumber.length - count,
  };
}

/**
 * Kenaikan kelas massal. Dijalankan dalam satu transaksi supaya tidak ada
 * keadaan setengah jadi — sebagian siswa naik, sebagian tidak.
 *
 * Catatan penting: baris `attendance` TIDAK ikut berubah, karena tabel itu
 * menyimpan class_id-nya sendiri saat presensi dicatat. Itulah yang membuat
 * laporan tahun lalu tetap benar setelah siswanya naik kelas.
 */
export async function naikkanKelas(pasangan: { dariKelasId: string; keKelasId: string }[]) {
  if (pasangan.length === 0) throw BadRequest('Tidak ada pasangan kelas yang dikirim');

  const semuaId = pasangan.flatMap((p) => [p.dariKelasId, p.keKelasId]);
  const kelas = await prisma.classes.findMany({ where: { id: { in: semuaId } } });
  const peta = new Map(kelas.map((k) => [k.id, k]));

  for (const p of pasangan) {
    if (!peta.has(p.dariKelasId)) throw NotFound(`Kelas asal ${p.dariKelasId} tidak ditemukan`);
    if (!peta.has(p.keKelasId)) throw NotFound(`Kelas tujuan ${p.keKelasId} tidak ditemukan`);
    if (p.dariKelasId === p.keKelasId) throw BadRequest('Kelas asal dan tujuan tidak boleh sama');
  }

  return prisma.$transaction(async (tx) => {
    const hasil: { dari: string; ke: string; jumlah: number }[] = [];
    for (const p of pasangan) {
      const { count } = await tx.students.updateMany({
        where: { class_id: p.dariKelasId, is_active: true },
        data: { class_id: p.keKelasId },
      });
      hasil.push({
        dari: peta.get(p.dariKelasId)!.name,
        ke: peta.get(p.keKelasId)!.name,
        jumlah: count,
      });
    }
    return hasil;
  });
}
