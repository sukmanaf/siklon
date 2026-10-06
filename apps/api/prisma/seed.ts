/**
 * Seeder. Menjalankan database/schema.sql tidak termasuk tugas berkas ini —
 * yang dilakukan di sini hanya mengisi data awal yang butuh logika aplikasi,
 * terutama hash password yang tidak bisa dibuat dari SQL murni.
 *
 * Aman dijalankan berulang (idempoten).
 */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/lib/password.js';

const AKUN_AWAL = [
  { username: 'superadmin', full_name: 'Super Administrator', role: 'SUPER_ADMIN' as const },
  { username: 'admin', full_name: 'Admin Tata Usaha', role: 'ADMIN' as const },
];

/** Password awal. WAJIB diganti saat login pertama. */
const PASSWORD_AWAL = process.env.SEED_PASSWORD ?? 'siklon123';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  console.log('Menyiapkan akun awal...');
  const password_hash = await hashPassword(PASSWORD_AWAL);

  for (const akun of AKUN_AWAL) {
    const ada = await prisma.users.findUnique({ where: { username: akun.username } });

    if (!ada) {
      await prisma.users.create({ data: { ...akun, password_hash } });
      console.log(`  + ${akun.username} (${akun.role}) dibuat`);
      continue;
    }

    // Perbaiki hash placeholder dari seed.sql agar akunnya benar-benar bisa dipakai login.
    if (!ada.password_hash.startsWith('$argon2id$') || ada.password_hash.includes('GANTI')) {
      await prisma.users.update({
        where: { username: akun.username },
        data: { password_hash, must_change_password: true },
      });
      console.log(`  ~ ${akun.username} hash placeholder diperbaiki`);
    } else {
      console.log(`  = ${akun.username} sudah ada, dilewati`);
    }
  }

  const jml = await prisma.users.count();
  console.log(`\nSelesai. Total ${jml} pengguna.`);
  console.log(`Login: superadmin / ${PASSWORD_AWAL}  (wajib ganti password saat masuk)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Seed gagal:', e);
  process.exit(1);
});
