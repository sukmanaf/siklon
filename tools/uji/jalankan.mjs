#!/usr/bin/env node
/**
 * Pelari seluruh suite uji.
 *
 *   node tools/uji/jalankan.mjs            # semua suite
 *   node tools/uji/jalankan.mjs kelas scan # hanya yang namanya cocok
 *
 * Tiap suite dijalankan sebagai proses terpisah. Itu disengaja: satu suite yang
 * menggantung atau melempar tidak boleh menjatuhkan yang lain, dan kebocoran
 * keadaan antar suite jadi mustahil.
 */

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_UJI, API } from './bersama.mjs';

const DIR_SUITE = join(DIR_UJI, 'suite');

async function serverHidup() {
  try {
    const res = await fetch(`${API}/auth/me`, { signal: AbortSignal.timeout(4000) });
    // 401 pun berarti server menjawab — yang dicek cuma hidup atau tidak.
    return res.status > 0;
  } catch {
    return false;
  }
}

const saring = process.argv.slice(2);
const suite = readdirSync(DIR_SUITE)
  .filter((f) => f.endsWith('.mjs'))
  .sort()
  .filter((f) => saring.length === 0 || saring.some((s) => f.includes(s)));

if (suite.length === 0) {
  console.error(`Tidak ada suite yang cocok dengan: ${saring.join(', ')}`);
  process.exit(1);
}

if (!(await serverHidup())) {
  console.error(
    `Server tidak menjawab di ${API}.\n` +
      'Jalankan dulu:  pnpm dev  di apps/api dan apps/web.\n' +
      'Kalau pakai nvm, pastikan node ada di PATH.',
  );
  process.exit(1);
}

const mulai = Date.now();
const hasil = [];

for (const berkas of suite) {
  console.log(`\n${'='.repeat(70)}\n${berkas}\n${'='.repeat(70)}`);
  const kode = await new Promise((selesai) => {
    const anak = spawn(process.execPath, [join(DIR_SUITE, berkas)], {
      stdio: 'inherit',
      env: process.env,
    });
    anak.on('close', selesai);
  });
  hasil.push({ berkas, lulus: kode === 0 });
}

const detik = ((Date.now() - mulai) / 1000).toFixed(0);
console.log(`\n${'='.repeat(70)}`);
for (const h of hasil) console.log(`${h.lulus ? '✓' : '✗'} ${h.berkas}`);
const gagal = hasil.filter((h) => !h.lulus);
console.log(
  `\n${hasil.length - gagal.length}/${hasil.length} suite lulus dalam ${detik} detik`,
);
process.exit(gagal.length ? 1 : 0);
