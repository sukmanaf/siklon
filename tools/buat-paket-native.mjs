#!/usr/bin/env node
/**
 * Paket deploy NATIVE (tanpa Docker) — Node.js + PostgreSQL + NSSM langsung
 * di Windows, bukan lewat container. Hidup BERDAMPINGAN dengan
 * tools/buat-paket-deploy.mjs (Docker) — dua metode deploy terpisah total,
 * tidak saling menimpa berkas.
 *
 * PRASYARAT sebelum menjalankan skrip ini:
 *   - apps/api/dist sudah di-build:      pnpm --filter @siklon/api build
 *   - apps/web/.next/standalone sudah dibuild dengan URL API produksi:
 *       cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1 pnpm exec next build
 *   - apps/scanner-agent/dist sudah di-build (lihat tools/buat-paket-deploy.mjs)
 *   - packages/shared/dist sudah di-build
 *   - Tiga installer ada di data/: node-*.msi, postgresql-*.exe, nssm-2.24/
 *
 * Jalankan: node tools/buat-paket-native.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'presensee_build');
const DATA_DIR = path.join(ROOT_DIR, 'data');

function gagal(pesan) {
  console.error(`\n❌ ${pesan}\n`);
  process.exit(1);
}

function copyAsCrlf(src, dest) {
  const isi = fs.readFileSync(src, 'utf-8');
  const crlf = isi.split('\r\n').join('\n').split('\n').join('\r\n');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, crlf, 'utf-8');
}

function copyDir(src, dest, opts = {}) {
  fs.cpSync(src, dest, { recursive: true, ...opts });
}

console.log('📦 Membuat paket deploy NATIVE (tanpa Docker)...\n');

// ---------------------------------------------------------------------
// 0. Periksa prasyarat
// ---------------------------------------------------------------------
console.log('🔍 [0/6] Memeriksa prasyarat...');

const apiDist = path.join(ROOT_DIR, 'apps/api/dist');
const webStandalone = path.join(ROOT_DIR, 'apps/web/.next/standalone');
const webStatic = path.join(ROOT_DIR, 'apps/web/.next/static');
const sharedDist = path.join(ROOT_DIR, 'packages/shared/dist');
const agentDist = path.join(ROOT_DIR, 'apps/scanner-agent/dist');

for (const [label, p] of [
  ['apps/api/dist', apiDist],
  ['apps/web/.next/standalone', webStandalone],
  ['apps/web/.next/static', webStatic],
  ['packages/shared/dist', sharedDist],
  ['apps/scanner-agent/dist', agentDist],
]) {
  if (!fs.existsSync(p)) gagal(`${label} tidak ada. Build dulu sebelum menjalankan skrip ini.`);
}

const nodeMsi = fs.readdirSync(DATA_DIR).find((f) => /^node-.*\.msi$/i.test(f));
const pgExe = fs.readdirSync(DATA_DIR).find((f) => /^postgresql-.*\.exe$/i.test(f));
const nssmExe = path.join(DATA_DIR, 'nssm-2.24/win64/nssm.exe');
if (!nodeMsi) gagal('Installer Node.js (.msi) tidak ditemukan di data/');
if (!pgExe) gagal('Installer PostgreSQL (.exe) tidak ditemukan di data/');
if (!fs.existsSync(nssmExe)) gagal(`nssm.exe tidak ditemukan di ${nssmExe}`);
console.log(`   [OK] Node.js: ${nodeMsi}`);
console.log(`   [OK] PostgreSQL: ${pgExe}`);
console.log(`   [OK] NSSM: ${nssmExe}`);

// ---------------------------------------------------------------------
// 1. Bersihkan & siapkan folder output
// ---------------------------------------------------------------------
console.log('\n🧹 [1/6] Menyiapkan folder presensee_build/...');
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------
// 2. packages/shared
// ---------------------------------------------------------------------
console.log('📂 [2/6] Menyalin packages/shared...');
copyDir(sharedDist, path.join(OUT_DIR, 'shared/dist'));
fs.writeFileSync(
  path.join(OUT_DIR, 'shared/package.json'),
  JSON.stringify(
    {
      name: '@siklon/shared',
      version: '1.0.0',
      private: true,
      type: 'module',
      main: './dist/index.js',
      exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    },
    null,
    2,
  ),
  'utf-8',
);

// ---------------------------------------------------------------------
// 3. apps/api
// ---------------------------------------------------------------------
console.log('📂 [3/6] Menyalin apps/api...');
copyDir(apiDist, path.join(OUT_DIR, 'apps/api/dist'));

const apiPkgAsli = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'apps/api/package.json'), 'utf-8'));
const apiPkgNative = {
  name: apiPkgAsli.name,
  version: apiPkgAsli.version,
  private: true,
  type: apiPkgAsli.type,
  scripts: { start: 'node --env-file=.env dist/server.js' },
  // @siklon/shared: "workspace:*" diganti file: — npm biasa (bukan pnpm)
  // tidak mengerti protokol workspace: pnpm. Paket sungguhan dibundel di
  // folder shared/ tepat di sebelah apps/, dirujuk relatif dari sini.
  dependencies: { ...apiPkgAsli.dependencies, '@siklon/shared': 'file:../../shared' },
};
fs.writeFileSync(path.join(OUT_DIR, 'apps/api/package.json'), JSON.stringify(apiPkgNative, null, 2), 'utf-8');

// ---------------------------------------------------------------------
// 4. apps/web — seluruh isi .next/standalone dipindah APA ADANYA (jangan
// diubah strukturnya — Next menjejaki path node_modules relatif terhadap
// server.js, memindah sebagian akan merusak resolusi modulnya).
// .next/static TIDAK ikut di standalone secara default, disalin manual ke
// lokasi yang Next harapkan (apps/web/.next/static).
// ---------------------------------------------------------------------
console.log('📂 [4/6] Menyalin apps/web (standalone)...');
copyDir(webStandalone, path.join(OUT_DIR, 'apps/web'));
copyDir(webStatic, path.join(OUT_DIR, 'apps/web/apps/web/.next/static'));

// ---------------------------------------------------------------------
// 5. apps/scanner-agent — pola sama seperti tools/buat-paket-deploy.mjs
// ---------------------------------------------------------------------
console.log('📂 [5/6] Menyalin apps/scanner-agent...');
const agentFiles = [
  'package.json',
  'config.example.json',
  'install-service.bat',
  'uninstall-service.bat',
  'README.md',
];
const deployAgentDir = path.join(OUT_DIR, 'apps/scanner-agent');
fs.mkdirSync(deployAgentDir, { recursive: true });
for (const f of agentFiles) {
  const src = path.join(ROOT_DIR, 'apps/scanner-agent', f);
  if (!fs.existsSync(src)) continue;
  if (f.endsWith('.bat')) copyAsCrlf(src, path.join(deployAgentDir, f));
  else fs.copyFileSync(src, path.join(deployAgentDir, f));
}
copyDir(agentDist, path.join(deployAgentDir, 'dist'));
fs.writeFileSync(
  path.join(deployAgentDir, 'config.json'),
  JSON.stringify({ apiUrl: 'http://localhost:5000', apiKey: 'presensee-scanner-api-key-2026' }, null, 2) + '\n',
  'utf-8',
);

// ---------------------------------------------------------------------
// 6. database, installer, skrip .bat, dokumentasi
// ---------------------------------------------------------------------
console.log('📂 [6/6] Menyalin database, installer, dan skrip pemasangan...');
fs.mkdirSync(path.join(OUT_DIR, 'database/migrations'), { recursive: true });
for (const f of ['schema.sql', 'seed.sql', 'seed-esensial.sql', 'contoh-multi-kelas.sql']) {
  fs.copyFileSync(path.join(ROOT_DIR, 'database', f), path.join(OUT_DIR, 'database', f));
}
for (const f of fs.readdirSync(path.join(ROOT_DIR, 'database/migrations'))) {
  if (f.endsWith('.sql')) {
    fs.copyFileSync(path.join(ROOT_DIR, 'database/migrations', f), path.join(OUT_DIR, 'database/migrations', f));
  }
}

fs.mkdirSync(path.join(OUT_DIR, 'installer'), { recursive: true });
fs.copyFileSync(path.join(DATA_DIR, nodeMsi), path.join(OUT_DIR, `installer/${nodeMsi}`));
fs.copyFileSync(path.join(DATA_DIR, pgExe), path.join(OUT_DIR, `installer/${pgExe}`));
fs.copyFileSync(nssmExe, path.join(OUT_DIR, 'installer/nssm.exe'));

for (const f of ['install.bat', 'jalankan.bat', 'hentikan.bat', 'uninstall.bat']) {
  copyAsCrlf(path.join(__dirname, 'native-deploy', f), path.join(OUT_DIR, f));
}
fs.copyFileSync(
  path.join(__dirname, 'native-deploy/PANDUAN-INSTALL-WINDOWS.md'),
  path.join(OUT_DIR, 'PANDUAN-INSTALL-WINDOWS.md'),
);

const APP_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')).version;
fs.writeFileSync(
  path.join(OUT_DIR, 'VERSION.txt'),
  `PresenSee Version: ${APP_VERSION} (native, tanpa Docker)\nGenerated At: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`,
  'utf-8',
);

console.log('\n====================================================================');
console.log('✨ [BERHASIL] presensee_build/ siap.');
console.log('====================================================================');
console.log(`📁 Lokasi: ${OUT_DIR}`);
console.log('📋 Langkah client: salin seluruh folder presensee_build ke PC Windows,');
console.log('   klik kanan install.bat → Run as administrator.');
console.log('====================================================================\n');
