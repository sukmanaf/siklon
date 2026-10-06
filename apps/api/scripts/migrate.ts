/**
 * Penjalan migrasi SQL sederhana.
 *
 * Sengaja tidak memakai `prisma migrate` karena sumber kebenaran skema proyek ini
 * adalah database/schema.sql, dan beberapa objek yang dipakai (partial unique index,
 * view, trigger, index GIN) tidak bisa dimodelkan Prisma.
 *
 * Pemakaian:
 *   tsx scripts/migrate.ts            jalankan migrasi yang belum pernah dijalankan
 *   tsx scripts/migrate.ts --status   tampilkan status tanpa mengubah apa pun
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from 'pg';

const DIR = resolve(import.meta.dirname, '../../../database/migrations');
const hanyaStatus = process.argv.includes('--status');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL belum diset. Jalankan lewat: pnpm --filter @siklon/api migrate');
    process.exit(1);
  }

  const db = new Client({ connectionString: url });
  await db.connect();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nama         TEXT PRIMARY KEY,
      checksum     TEXT NOT NULL,
      dijalankan_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const berkas = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await db.query<{ nama: string; checksum: string }>(
    'SELECT nama, checksum FROM schema_migrations',
  );
  const sudah = new Map(rows.map((r) => [r.nama, r.checksum]));

  let dijalankan = 0;

  for (const nama of berkas) {
    const sql = readFileSync(join(DIR, nama), 'utf8');
    const cs = sha(sql);
    const csLama = sudah.get(nama);

    if (csLama) {
      // Migrasi yang sudah dijalankan lalu diedit adalah sumber bug yang sulit dilacak:
      // database lain akan punya skema berbeda. Peringatkan keras, jangan diam-diam.
      if (csLama !== cs) {
        console.error(`  ! ${nama} SUDAH dijalankan tapi isinya BERUBAH (${csLama} -> ${cs})`);
        console.error(`    Jangan mengedit migrasi yang sudah jalan. Buat berkas migrasi baru.`);
      } else if (hanyaStatus) {
        console.log(`  = ${nama}`);
      }
      continue;
    }

    if (hanyaStatus) {
      console.log(`  + ${nama}  (belum dijalankan)`);
      continue;
    }

    // Satu migrasi = satu transaksi. Gagal di tengah berarti tidak ada yang tersimpan.
    try {
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (nama, checksum) VALUES ($1, $2)', [nama, cs]);
      await db.query('COMMIT');
      console.log(`  + ${nama} berhasil`);
      dijalankan++;
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`  x ${nama} GAGAL:`, (err as Error).message);
      console.error('    Tidak ada perubahan yang tersimpan (transaksi di-rollback).');
      await db.end();
      process.exit(1);
    }
  }

  if (!hanyaStatus) {
    console.log(
      dijalankan === 0
        ? 'Tidak ada migrasi baru. Skema sudah mutakhir.'
        : `Selesai. ${dijalankan} migrasi dijalankan.`,
    );
  }

  await db.end();
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
