/**
 * Menaikkan seorang Admin menjadi Super Admin.
 *
 * Sengaja HANYA lewat CLI di server, bukan lewat web. Kalau bisa lewat web,
 * seorang Super Admin yang akunnya dibajak bisa membuat Super Admin lain dan
 * penyerang tetap punya pintu masuk walau akun aslinya dinonaktifkan.
 *
 * Pemakaian:
 *   pnpm --filter @siklon/api user:promote <username>
 *   pnpm --filter @siklon/api user:promote <username> --turunkan
 */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const username = process.argv[2];
const turunkan = process.argv.includes('--turunkan');

if (!username || username.startsWith('--')) {
  console.error('Pemakaian: pnpm --filter @siklon/api user:promote <username> [--turunkan]');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const user = await prisma.users.findUnique({ where: { username } });
  if (!user) {
    console.error(`Pengguna "${username}" tidak ditemukan.`);
    process.exit(1);
  }

  const peranBaru = turunkan ? 'ADMIN' : 'SUPER_ADMIN';

  if (user.role === peranBaru) {
    console.log(`"${username}" sudah berperan ${peranBaru}. Tidak ada perubahan.`);
    return;
  }

  // Menurunkan Super Admin terakhir akan mengunci semua orang dari halaman Pengguna.
  if (turunkan) {
    const jumlah = await prisma.users.count({ where: { role: 'SUPER_ADMIN', is_active: true } });
    if (jumlah <= 1) {
      console.error('Ditolak: ini Super Admin aktif terakhir. Harus ada minimal satu.');
      process.exit(1);
    }
  }

  await prisma.users.update({
    where: { username },
    // Naik/turun peran mengubah hak akses, jadi seluruh token lama dibatalkan
    // supaya perubahannya langsung berlaku, bukan menunggu token kedaluwarsa.
    data: { role: peranBaru, token_version: { increment: 1 } },
  });

  console.log(`"${username}": ${user.role} -> ${peranBaru}`);
  console.log('Seluruh sesi pengguna ini dicabut; ia perlu masuk ulang.');
}

main()
  .catch((e) => {
    console.error('Gagal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
