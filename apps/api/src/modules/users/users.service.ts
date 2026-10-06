import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/errors.js';

const PILIH = {
  id: true,
  username: true,
  full_name: true,
  role: true,
  is_active: true,
  must_change_password: true,
  last_login_at: true,
  last_login_ip: true,
  created_at: true,
} as const;

export const daftar = () =>
  prisma.users.findMany({ select: PILIH, orderBy: [{ role: 'asc' }, { username: 'asc' }] });

export async function buat(data: { username: string; full_name: string; password: string }) {
  const ada = await prisma.users.findUnique({ where: { username: data.username } });
  if (ada) throw Conflict(`Username "${data.username}" sudah dipakai`);

  return prisma.users.create({
    data: {
      username: data.username,
      full_name: data.full_name,
      password_hash: await hashPassword(data.password),
      role: 'ADMIN', // dipaksa server, tidak bisa dititip dari klien
      must_change_password: true,
    },
    select: PILIH,
  });
}

/** Ambil target sambil menegakkan aturan siapa yang boleh disentuh. */
async function ambilTarget(id: string, aktorId: string) {
  const target = await prisma.users.findUnique({ where: { id } });
  if (!target) throw NotFound('Pengguna tidak ditemukan');

  // Super Admin lain tidak bisa diutak-atik lewat web. Ini mencegah dua Super
  // Admin saling menonaktifkan, dan memaksa perubahan peran lewat CLI server.
  if (target.role === 'SUPER_ADMIN' && target.id !== aktorId) {
    throw Forbidden('Akun Super Admin lain hanya dapat diubah lewat CLI di server');
  }
  return target;
}

/** Menolak bila tindakan ini akan menghabiskan Super Admin aktif terakhir. */
async function pastikanBukanSuperAdminTerakhir(target: { id: string; role: string }) {
  if (target.role !== 'SUPER_ADMIN') return;
  const jumlah = await prisma.users.count({ where: { role: 'SUPER_ADMIN', is_active: true } });
  if (jumlah <= 1) {
    throw Conflict('Minimal harus ada satu Super Admin aktif. Tindakan dibatalkan.');
  }
}

export async function ubah(
  id: string,
  aktorId: string,
  data: { full_name?: string; is_active?: boolean },
) {
  const target = await ambilTarget(id, aktorId);

  if (data.is_active === false) {
    if (target.id === aktorId) throw BadRequest('Anda tidak dapat menonaktifkan akun sendiri');
    await pastikanBukanSuperAdminTerakhir(target);
  }

  return prisma.users.update({ where: { id }, data, select: PILIH });
}

export async function resetPassword(id: string, aktorId: string, passwordBaru: string) {
  await ambilTarget(id, aktorId);
  await prisma.users.update({
    where: { id },
    data: {
      password_hash: await hashPassword(passwordBaru),
      must_change_password: true,
      // Batalkan semua sesi lama: kalau passwordnya di-reset karena akun
      // dicurigai bocor, sesi penyerang harus ikut mati.
      token_version: { increment: 1 },
    },
  });
  return { pesan: 'Password direset. Pengguna wajib menggantinya saat masuk.' };
}

export async function cabutSesi(id: string, aktorId: string) {
  await ambilTarget(id, aktorId);
  await prisma.users.update({ where: { id }, data: { token_version: { increment: 1 } } });
  return { pesan: 'Semua sesi pengguna ini telah dicabut' };
}

/** Nonaktifkan (soft delete). Akun tidak pernah benar-benar dihapus agar jejak audit utuh. */
export async function nonaktifkan(id: string, aktorId: string) {
  const target = await ambilTarget(id, aktorId);
  if (target.id === aktorId) throw BadRequest('Anda tidak dapat menonaktifkan akun sendiri');
  await pastikanBukanSuperAdminTerakhir(target);

  await prisma.users.update({
    where: { id },
    data: { is_active: false, token_version: { increment: 1 } },
  });
  return { pesan: 'Akun dinonaktifkan dan seluruh sesinya dicabut' };
}
