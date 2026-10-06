import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { BadRequest, Forbidden, Unauthorized } from '../../lib/errors.js';
import { buatToken } from '../../lib/jwt.js';

/** Pesan yang SAMA untuk username tidak ada maupun password salah. */
const PESAN_GAGAL = 'Username atau password salah';

export async function login(username: string, password: string, ip?: string) {
  const user = await prisma.users.findUnique({ where: { username } });

  // Tetap jalankan verifikasi walau user tidak ada, memakai hash palsu, supaya
  // waktu responsnya mirip. Tanpa ini, selisih waktu membocorkan username mana
  // yang terdaftar (timing attack).
  const hashUji = user?.password_hash ?? '$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFh$0000000000000000000000000000000000000000000';
  const cocok = await verifyPassword(hashUji, password);

  if (!user || !cocok) throw Unauthorized(PESAN_GAGAL);
  if (!user.is_active) throw Forbidden('Akun Anda dinonaktifkan. Hubungi Super Admin.');

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date(), last_login_ip: ip ?? null },
  });

  const token = buatToken({ sub: user.id, rol: user.role, tv: user.token_version });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      nama: user.full_name,
      peran: user.role,
      wajibGantiPassword: user.must_change_password,
    },
  };
}

export async function gantiPassword(userId: string, passwordLama: string, passwordBaru: string) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) throw Unauthorized();

  if (!(await verifyPassword(user.password_hash, passwordLama))) {
    throw BadRequest('Password lama salah');
  }

  // Menaikkan token_version membatalkan SEMUA token lama, termasuk milik
  // perangkat lain — perilaku yang memang diinginkan saat ganti password.
  const baru = await prisma.users.update({
    where: { id: userId },
    data: {
      password_hash: await hashPassword(passwordBaru),
      must_change_password: false,
      token_version: { increment: 1 },
    },
  });

  return buatToken({ sub: baru.id, rol: baru.role, tv: baru.token_version });
}

/** Keluar dari semua perangkat: cukup naikkan versi token. */
export async function cabutSemuaSesi(userId: string) {
  await prisma.users.update({
    where: { id: userId },
    data: { token_version: { increment: 1 } },
  });
}
