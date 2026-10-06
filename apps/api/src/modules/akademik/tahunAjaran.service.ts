import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';

export const daftar = () =>
  prisma.academic_years.findMany({
    orderBy: { start_date: 'desc' },
    include: { _count: { select: { classes: true } } },
  });

export async function aktif() {
  const th = await prisma.academic_years.findFirst({ where: { is_active: true } });
  if (!th) throw NotFound('Belum ada tahun ajaran yang aktif. Aktifkan satu di Pengaturan.');
  return th;
}

export async function buat(data: { name: string; start_date: string; end_date: string }) {
  const mulai = new Date(data.start_date);
  const selesai = new Date(data.end_date);
  if (selesai <= mulai) throw BadRequest('Tanggal selesai harus setelah tanggal mulai');

  const ada = await prisma.academic_years.findUnique({ where: { name: data.name } });
  if (ada) throw Conflict(`Tahun ajaran "${data.name}" sudah ada`);

  return prisma.academic_years.create({
    data: { name: data.name, start_date: mulai, end_date: selesai, is_active: false },
  });
}

/**
 * Mengaktifkan satu tahun ajaran = menonaktifkan semua yang lain.
 * WAJIB satu transaksi: database punya partial unique index yang melarang dua
 * tahun ajaran aktif, jadi kalau tidak dalam transaksi, UPDATE ini akan gagal
 * di tengah dan meninggalkan keadaan tanpa tahun ajaran aktif sama sekali.
 */
export async function aktifkan(id: number) {
  const th = await prisma.academic_years.findUnique({ where: { id } });
  if (!th) throw NotFound('Tahun ajaran tidak ditemukan');
  if (th.is_active) return th;

  return prisma.$transaction(async (tx) => {
    await tx.academic_years.updateMany({ where: { is_active: true }, data: { is_active: false } });
    return tx.academic_years.update({ where: { id }, data: { is_active: true } });
  });
}

export async function hapus(id: number) {
  const th = await prisma.academic_years.findUnique({
    where: { id },
    include: { _count: { select: { classes: true, attendance: true } } },
  });
  if (!th) throw NotFound('Tahun ajaran tidak ditemukan');
  if (th.is_active) throw BadRequest('Tahun ajaran yang sedang aktif tidak dapat dihapus');
  if (th._count.classes > 0) {
    throw Conflict(`Masih ada ${th._count.classes} kelas di tahun ajaran ini`);
  }
  await prisma.academic_years.delete({ where: { id } });
  return { pesan: 'Tahun ajaran dihapus' };
}
