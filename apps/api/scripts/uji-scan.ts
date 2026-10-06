/**
 * Alat uji manual endpoint scan — meniru apa yang dilakukan Scanner Agent.
 *
 * Dipakai untuk memastikan backend siap sebelum ada scanner fisik dan sebelum
 * halaman Konsol Scan dibuat.
 *
 * Pemakaian:
 *   pnpm --filter @siklon/api uji:scan 2026071
 *   pnpm --filter @siklon/api uji:scan 2026071 --jam 07:22
 *   pnpm --filter @siklon/api uji:scan 2026071 --gate GATE-B
 *   pnpm --filter @siklon/api uji:scan --daftar        lihat NIS yang tersedia
 *   pnpm --filter @siklon/api uji:scan --rekap         lihat presensi hari ini
 *   pnpm --filter @siklon/api uji:scan --bersihkan     hapus presensi hari ini
 */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const API = process.env['UJI_API'] ?? 'http://localhost:4000';
const KEY = process.env['SCANNER_API_KEY'] ?? '';

const argv = process.argv.slice(2);
const opsi = (nama: string) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ada = (nama: string) => argv.includes(`--${nama}`);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']!, options: '-c timezone=UTC' }),
});

const W = '\x1b[0m';
const hijau = (t: string) => `\x1b[32m${t}${W}`;
const kuning = (t: string) => `\x1b[33m${t}${W}`;
const merah = (t: string) => `\x1b[31m${t}${W}`;
const redup = (t: string) => `\x1b[90m${t}${W}`;

const jamWib = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);

async function daftarSiswa() {
  const s = await prisma.students.findMany({
    where: { is_active: true },
    select: {
      nis: true,
      full_name: true,
      guardian_phone: true,
      notify: true,
      classes: { select: { name: true } },
    },
    orderBy: { nis: 'asc' },
  });

  console.log(`\nNIS yang bisa dipakai menguji (${s.length} siswa aktif):\n`);
  for (const x of s) {
    const wa = !x.guardian_phone
      ? redup('tanpa nomor wali')
      : x.notify
        ? hijau('notifikasi ON')
        : redup('notifikasi off');
    console.log(`  ${x.nis.padEnd(10)} ${x.full_name.padEnd(18)} ${(x.classes?.name ?? '-').padEnd(8)} ${wa}`);
  }
  console.log();
}

async function rekapHariIni() {
  const hari = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const baris = await prisma.$queryRaw<
    { nis: string; nama: string; kelas: string | null; status: string; jam: string | null; telat: number; titik: string | null }[]
  >`
    SELECT s.nis, s.full_name AS nama, c.name AS kelas,
           COALESCE(a.status::text,'BELUM') AS status,
           to_char(a.check_in_at AT TIME ZONE 'Asia/Jakarta','HH24:MI:SS') AS jam,
           COALESCE(a.late_minutes,0)::int AS telat,
           a.device_code AS titik
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = ${hari}::date
    WHERE s.is_active ORDER BY s.nis`;

  console.log(`\nPresensi ${hari}:\n`);
  console.log(redup('  NIS        NAMA               KELAS    STATUS      JAM       TELAT  TITIK'));
  for (const b of baris) {
    const warna = b.status === 'HADIR' ? hijau : b.status === 'TERLAMBAT' ? kuning : b.status === 'BELUM' ? redup : merah;
    console.log(
      `  ${b.nis.padEnd(10)} ${b.nama.padEnd(18)} ${(b.kelas ?? '-').padEnd(8)} ` +
        `${warna(b.status.padEnd(11))} ${(b.jam ?? '-').padEnd(9)} ${String(b.telat).padEnd(6)} ${b.titik ?? '-'}`,
    );
  }
  console.log();
}

async function bersihkan() {
  const hari = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const r = await prisma.$executeRaw`DELETE FROM attendance WHERE attendance_date = ${hari}::date`;
  console.log(`\n${r} baris presensi hari ini dihapus. Siap diuji ulang.\n`);
}

async function kirimScan(nis: string) {
  if (!KEY) {
    console.error('\nSCANNER_API_KEY belum ada di environment. Jalankan lewat: pnpm --filter @siklon/api uji:scan\n');
    process.exit(1);
  }

  // --jam 07:22 menguji penentuan status tanpa harus menunggu jam segitu.
  const jam = opsi('jam');
  let waktu = new Date();
  if (jam) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jam)) {
      console.error(`\nFormat --jam salah: "${jam}". Harus HH:MM, contoh 07:22\n`);
      process.exit(1);
    }
    const hari = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    waktu = new Date(`${hari}T${jam}:00+07:00`);
  }

  const gate = opsi('gate') ?? 'GATE-A';
  console.log(`\n  ${redup('kirim')}  NIS ${nis}  ·  ${gate}  ·  ${jamWib(waktu)} WIB${jam ? redup(' (waktu dipalsukan)') : ''}`);

  const res = await fetch(`${API}/api/v1/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': KEY },
    body: JSON.stringify({ nis, gate, scannedAt: waktu.toISOString() }),
  }).catch((e) => {
    console.error(`\n  ${merah('GAGAL')} tidak bisa menghubungi ${API} — apakah server jalan?`);
    console.error(`  ${(e as Error).message}\n`);
    process.exit(1);
  });

  const isi = (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } };

  if (!isi.ok) {
    console.log(`  ${merah('DITOLAK')} ${isi.error?.message}\n`);
    return;
  }

  const d = isi.data as {
    ok: boolean;
    kode?: string;
    pesan: string;
    status?: string;
    terlambatMenit?: number;
    waDiantrekan?: boolean;
    siswa?: { nama: string; kelas: string | null };
  };

  const tanda = d.ok ? hijau('✓ DITERIMA') : kuning('✗ ' + (d.kode ?? 'DITOLAK'));
  console.log(`  ${tanda}  ${d.siswa ? `${d.siswa.nama} (${d.siswa.kelas ?? '-'})` : ''}`);
  console.log(`          ${d.pesan}`);
  if (d.status) console.log(`          status: ${d.status}${d.terlambatMenit ? `, terlambat ${d.terlambatMenit} menit` : ''}`);
  console.log(`          notifikasi WA: ${d.waDiantrekan ? hijau('diantrekan') : redup('tidak (WA dimatikan / notify off)')}`);
  console.log();
}

async function main() {
  if (ada('daftar')) return daftarSiswa();
  if (ada('rekap')) return rekapHariIni();
  if (ada('bersihkan')) return bersihkan();

  const nis = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--jam' && argv[argv.indexOf(a) - 1] !== '--gate');
  if (!nis) {
    console.log(`
Alat uji scan SIKLON

  uji:scan <NIS>                    kirim satu scan sekarang
  uji:scan <NIS> --jam 07:22        kirim dengan waktu dipalsukan
  uji:scan <NIS> --gate GATE-B      pakai titik scan lain
  uji:scan --daftar                 lihat NIS yang tersedia
  uji:scan --rekap                  lihat presensi hari ini
  uji:scan --bersihkan              hapus presensi hari ini
`);
    return;
  }

  await kirimScan(nis);
  await rekapHariIni();
}

main()
  .catch((e) => {
    console.error('Gagal:', (e as Error).message);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
