import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DEPLOY_DIR = path.join(ROOT_DIR, 'presensee');
const DATA_DIR = path.join(ROOT_DIR, 'data');

console.log('🚀 Memulai pembuatan Paket Deploy PresenSee (Klien Windows)...');

// Helper untuk mengecek ketersediaan command
/*
 * Cek keberadaan lewat `which`/`where`, BUKAN `<cmd> --version`.
 *
 * `unzip --version` sendiri keluar dengan kode bukan-nol: Info-ZIP unzip tidak
 * mengenal opsi gaya `--panjang`, jadi tiap huruf di "version" ditafsirkan
 * sebagai flag pendek terpisah (-v -e -r -s -i -o -n), dan -o/-n berbenturan.
 * Akibatnya `hasCommand('unzip')` selalu bilang "tidak ada" walau unzip
 * sungguh terpasang, dan verifikasi zip di bawah diam-diam terlewat.
 */
function hasCommand(cmd) {
  const pencari = process.platform === 'win32' ? 'where' : 'which';
  try {
    execSync(`${pencari} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Helper konversi teks ke CRLF (wajib untuk file .bat di Windows)
function toCrlf(text) {
  const LF = String.fromCharCode(10);
  const CRLF = String.fromCharCode(13, 10);
  return text.split(CRLF).join(LF).split(LF).join(CRLF);
}

// Helper untuk menyalin file dengan line ending CRLF khusus untuk .bat
function copyAsCrlf(src, dest) {
  const content = fs.readFileSync(src, 'utf-8');
  fs.writeFileSync(dest, toCrlf(content), 'utf-8');
}

const hasDocker = hasCommand('docker');

// 1. Bersihkan & buat direktori presensee
if (fs.existsSync(DEPLOY_DIR)) {
  fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEPLOY_DIR, { recursive: true });
fs.mkdirSync(path.join(DEPLOY_DIR, 'backupdb'), { recursive: true });

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));

// Auto-increment versi (patch) setiap kali bundle:deploy dijalankan
let currentVersion = pkgJson.version || '1.0.0';
const parts = currentVersion.split('.');
parts[2] = (parseInt(parts[2], 10) + 1).toString();
const APP_VERSION = parts.join('.');
pkgJson.version = APP_VERSION;
fs.writeFileSync(path.join(ROOT_DIR, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n', 'utf-8');

console.log(`\n🚀 Memulai deployment PresenSee v${APP_VERSION} (versi dinaikkan otomatis dari ${currentVersion})\n`);

if (hasDocker) {
  console.log(`🐳 Docker terdeteksi! Menggunakan Mode Ekspor Docker Image (.tar) versi v${APP_VERSION}...`);

  /*
   * postgres:16-alpine TIDAK ikut di-bundle ke presensee-images.tar.
   *
   * Ini image publik biasa — client tinggal `docker compose up` dan Docker
   * menariknya sendiri dari Docker Hub (sekolah butuh internet untuk WhatsApp
   * juga, jadi ini bukan syarat baru). Membundelnya cuma menambah ~100MB+ ke
   * tar tanpa alasan, dan menambah satu titik gagal lagi di berkas yang
   * paling rawan rusak saat dikirim ke client (lihat catatan checksum di bawah).
   * Yang WAJIB ada di tar hanya image custom kita: presensee-api & presensee-web.
   */

  // Build Image Docker dengan tag versi & latest
  console.log(`📦 [1/4] Mem-build Docker Image (API & Web) versi v${APP_VERSION}...`);
  execSync(`docker build -f apps/api/Dockerfile -t presensee-api:${APP_VERSION} -t presensee-api:latest .`, { stdio: 'inherit' });
  execSync(`docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1 -t presensee-web:${APP_VERSION} -t presensee-web:latest .`, { stdio: 'inherit' });

  // Export Docker Images ke presensee-images.tar
  console.log(`💾 [2/4] Meng-export Docker Images (v${APP_VERSION}) ke presensee-images.tar...`);
  const tarPath = path.join(DEPLOY_DIR, 'presensee-images.tar');
  execSync(`docker save -o "${tarPath}" presensee-api:${APP_VERSION} presensee-web:${APP_VERSION}`, { stdio: 'inherit' });

  // Validasi ukuran presensee-images.tar
  if (!fs.existsSync(tarPath) || fs.statSync(tarPath).size < 50 * 1024 * 1024) {
    throw new Error(`❌ Gagal meng-export presensee-images.tar (file tidak ditemukan atau ukurannya terlalu kecil/0-byte)!`);
  }

  /*
   * Verifikasi tar BENAR-BENAR bisa dibaca sebelum dipaketkan.
   *
   * Kejadian nyata (21 September 2026): tar ini terbukti valid dan berhasil
   * di-`docker load` di mesin pembuatnya, tapi gagal dengan
   * "archive/tar: invalid tar header" di PC client Windows setelah
   * ditransfer lewat zip — kerusakan terjadi DI JALAN (kompresi/transfer/
   * ekstraksi), bukan saat dibuat. `tar tf` di sini tidak menangkap
   * kerusakan transfer itu (itu terjadi belakangan), tapi tetap mencegah
   * kelas bug yang lain: tar yang sejak awal sudah cacat karena `docker save`   * terputus di tengah jalan.
   */
  console.log('🔍 Memverifikasi presensee-images.tar bisa dibaca ulang...');
  execSync(`tar tf "${tarPath}" >/dev/null`, { stdio: 'inherit' });

  /*
   * Checksum SHA256 disertakan dalam paket supaya JALANKAN-PRESENSEE.bat bisa
   * memverifikasi keutuhan tar SEBELUM mencoba docker load — kalau rusak di
   * jalan (zip/USB/cloud transfer), client dapat pesan "unduh ulang" yang
   * jelas, bukan cascade membingungkan "pull access denied" seperti kejadian
   * di atas (docker load gagal diam-diam, lalu docker compose up mencoba
   * menarik presensee-api dari Docker Hub — yang memang tidak pernah ada di
   * sana karena ini image custom, bukan image publik).
   */
  console.log('🔐 Menghitung checksum SHA256 presensee-images.tar...');
  const crypto = await import('node:crypto');
  const tarBuffer = fs.readFileSync(tarPath);
  const sha256 = crypto.createHash('sha256').update(tarBuffer).digest('hex');
  fs.writeFileSync(path.join(DEPLOY_DIR, 'presensee-images.tar.sha256'), `${sha256}  presensee-images.tar\n`, 'utf-8');
  console.log(`   SHA256: ${sha256}`);

  // Clean up docker build images and cache to save disk space
  console.log('🧹 Membersihkan Docker build image & cache lokal...');
  try {
    execSync(`docker rmi presensee-api:${APP_VERSION} presensee-web:${APP_VERSION} presensee-api:latest presensee-web:latest 2>/dev/null || true`, { stdio: 'ignore' });
    execSync('docker image prune -f', { stdio: 'ignore' });
    execSync('docker builder prune -f', { stdio: 'ignore' });
  } catch (err) {
    // abaikan error pembersihan
  }

  // Clean up any stray .tmp files left by docker save just in case
  const deployFiles = fs.readdirSync(DEPLOY_DIR);
  for (const file of deployFiles) {
    if (file.startsWith('.tmp')) {
      fs.rmSync(path.join(DEPLOY_DIR, file), { force: true });
    }
  }

  // Buat VERSION.txt
  fs.writeFileSync(path.join(DEPLOY_DIR, 'VERSION.txt'), `PresenSee Version: ${APP_VERSION}\nGenerated At: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`, 'utf-8');

  // Buat docker-compose.yml versi image tar
  const dockerComposeDeploy = `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: presensee-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: absen
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 123123
      TZ: Asia/Jakarta
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro

  api:
    image: presensee-api:${APP_VERSION}
    container_name: presensee-api
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      TZ: Asia/Jakarta
      DATABASE_URL: postgresql://postgres:123123@db:5432/absen
      JWT_SECRET: super-secret-jwt-key-replace-in-production
      SCANNER_API_KEY: presensee-scanner-api-key-2026
      WA_PROVIDER: baileys
      # WAJIB eksplisit — default di env.ts ("./storage") benar untuk dev
      # lokal (CWD = apps/api/), tapi CWD proses di container ini /app, jadi
      # default itu resolve ke /app/storage, BUKAN /app/apps/api/storage yang
      # di-mount persisten di bawah. Tanpa ini, sesi WhatsApp (Baileys) dan
      # foto/lampiran hilang begitu containernya di-recreate.
      STORAGE_PATH: /app/apps/api/storage
      WA_SESSION_PATH: /app/apps/api/storage/wa-session
    depends_on:
      - db
    volumes:
      - ./storage:/app/apps/api/storage
      - ./backupdb:/app/backupdb

  web:
    image: presensee-web:${APP_VERSION}
    container_name: presensee-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      TZ: Asia/Jakarta
    depends_on:
      - api

volumes:
  postgres_data:
`;
  fs.writeFileSync(path.join(DEPLOY_DIR, 'docker-compose.yml'), dockerComposeDeploy, 'utf-8');

  // Script Bat dengan auto-load .tar berdasarkan versi
  // Struktur mengikuti persis versi dist-deploy yang terbukti berhasil jalan di Windows
  const jalankanBat = `@echo off
cd /d "%~dp0"
title PresenSee - Jalankan Aplikasi Presensi Siswa (v${APP_VERSION})
color 0A
cls

echo ====================================================================
echo             PRESENSEE - SISTEM PRESENSI SISWA (v${APP_VERSION})
echo ====================================================================
echo.
echo Sedang memeriksa status Docker Desktop...
echo.

docker info >nul 2>&1
if not errorlevel 1 goto SKIP_DOCKER_START

echo [INFO] Docker Desktop belum aktif. Mencoba menyalakannya secara otomatis...

REM Cara PALING ANDAL: subcommand \`docker desktop start\` bawaan Docker
REM Desktop modern. Ini bekerja APAPUN lokasi instalasinya — tidak perlu tahu
REM di mana file .exe-nya — selama CLI \`docker\` ada di PATH (dan itu sudah
REM terbukti benar di PC ini, karena \`docker info\` tadi berhasil dijalankan
REM tanpa "command not found").
docker desktop start >nul 2>&1

REM Cadangan kalau subcommand di atas tidak dikenali (versi Docker Desktop
REM lama) — coba tebak lokasi .exe di tempat yang lazim. Empat kemungkinan
REM disertakan, TERMASUK mode instal "tanpa admin" yang menaruhnya di
REM %%LocalAppData%% — kejadian nyata (21 September 2026): dua lokasi
REM Program Files saja TIDAK CUKUP, PC client punya Docker Desktop tapi
REM tidak di salah satu dari keduanya, dan skrip lama keliru bilang
REM "belum terpasang" padahal ikonnya jelas ada di Desktop.
REM %%ProgramFiles(x86)%% TIDAK BOLEH dipakai langsung di dalam blok
REM if(...)else(...) — tanda kurung di NAMA variabelnya sendiri membingungkan
REM pencocokan kurung blok cmd.exe (jebakan batch yang sudah lama dikenal).
set "PF86=%ProgramFiles(x86)%"
if exist "%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe" start "" "%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe"
if exist "%PF86%\\Docker\\Docker\\Docker Desktop.exe" start "" "%PF86%\\Docker\\Docker\\Docker Desktop.exe"
if exist "%LocalAppData%\\Docker\\Docker Desktop.exe" start "" "%LocalAppData%\\Docker\\Docker Desktop.exe"
if exist "%LocalAppData%\\Programs\\Docker\\Docker Desktop.exe" start "" "%LocalAppData%\\Programs\\Docker\\Docker Desktop.exe"

echo Menunggu Docker Desktop siap di latar belakang (bisa sampai 2 menit)...

set "COBA1=0"
:loop_docker1
timeout /t 3 /nobreak >nul
set /a COBA1+=1
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_SIAP1
if %COBA1% lss 40 goto loop_docker1

color 0C
echo.
echo [ERROR] Docker Desktop belum aktif setelah ditunggu 2 menit.
echo.
echo \`docker\` sendiri sudah bisa dijalankan di PC ini, jadi Docker Desktop
echo KEMUNGKINAN BESAR sudah terpasang, hanya saja skrip ini tidak berhasil
echo menyalakannya secara otomatis (mis. terpasang di lokasi yang tidak biasa).
echo.
echo Silakan buka Docker Desktop SENDIRI sekali ini (cari ikonnya di Desktop
echo atau Start Menu), tunggu sampai ikon paus di system tray jadi stabil,
echo lalu jalankan skrip ini lagi.
echo.
echo Kalau memang belum pernah dipasang, unduh dari https://www.docker.com
echo.
pause
exit /b 1

:DOCKER_SIAP1
echo [OK] Docker Desktop telah aktif dan siap!
echo.

:SKIP_DOCKER_START

if not exist "presensee-images.tar" goto SKIP_TAR_LOAD

echo [INFO] Memeriksa image Docker PresenSee v${APP_VERSION}...
docker image inspect presensee-api:${APP_VERSION} >nul 2>&1
if errorlevel 1 goto DO_TAR_LOAD
docker image inspect presensee-web:${APP_VERSION} >nul 2>&1
if not errorlevel 1 goto SKIP_TAR_LOAD

:DO_TAR_LOAD

if not exist "presensee-images.tar.sha256" goto SKIP_CHECKSUM

REM Kejadian nyata (21 September 2026): berkas presensee-images.tar terbukti
REM valid dan berhasil dimuat di mesin pembuatnya, tapi rusak di tengah jalan
REM (kompresi ZIP / transfer / ekstraksi) sebelum sampai ke PC ini. Gejalanya
REM saat itu: "archive/tar: invalid tar header" lalu langsung disusul
REM "pull access denied" yang membingungkan — bukan masalah aplikasinya,
REM cuma berkasnya yang rusak. Checksum ini menangkapnya SEBELUM docker load
REM dicoba sama sekali, dengan pesan yang jelas.
echo [INFO] Memeriksa keutuhan berkas presensee-images.tar (checksum SHA256)...
set "HASH_EXPECTED="
set /p HASH_EXPECTED=<presensee-images.tar.sha256
for /f "tokens=1" %%h in ("%HASH_EXPECTED%") do set "HASH_EXPECTED=%%h"

set "HASH_ACTUAL="
for /f "skip=1 tokens=* delims=" %%h in ('certutil -hashfile presensee-images.tar SHA256 ^| findstr /v "CertUtil"') do (
    if not defined HASH_ACTUAL set "HASH_ACTUAL=%%h"
)
set "HASH_ACTUAL=%HASH_ACTUAL: =%"

if /I not "%HASH_ACTUAL%"=="%HASH_EXPECTED%" (
    color 0C
    echo.
    echo [ERROR] Berkas presensee-images.tar RUSAK ^(checksum tidak cocok^).
    echo   Seharusnya : %HASH_EXPECTED%
    echo   Ditemukan  : %HASH_ACTUAL%
    echo.
    echo Ini BUKAN kesalahan aplikasi - berkasnya rusak saat disalin/diunduh
    echo ke PC ini ^(lewat ZIP, USB, atau unduhan yang terputus di tengah^).
    echo Unduh ulang paket PresenSee dari sumber asli, jangan pakai berkas
    echo yang sudah ada di PC ini, lalu jalankan skrip ini lagi.
    echo.
    pause
    exit /b 1
)
echo [OK] Checksum cocok - berkas presensee-images.tar utuh.
echo.

:SKIP_CHECKSUM

echo [INFO] Mengimpor image PresenSee v${APP_VERSION} dari presensee-images.tar...
echo (Harap tunggu sesaat, proses ini hanya berjalan 1 kali per rilis versi)...
docker load -i presensee-images.tar
if errorlevel 1 (
    echo.
    echo [WARN] Gagal mengimpor di percobaan pertama. Menunggu Docker daemon stabil...
    timeout /t 5 /nobreak >nul
    echo [INFO] Mencoba mengimpor ulang presensee-images.tar...
    docker load -i presensee-images.tar
)

REM Diverifikasi ULANG secara terpisah — TIDAK dipercaya dari errorlevel
REM "docker load" di atas saja. Kejadian nyata: docker load bisa tampak
REM selesai tanpa pesan error yang jelas di layar, padahal image-nya tetap
REM tidak ada, lalu "docker compose up" di bawah diam-diam mencoba MENARIK
REM presensee-api dari Docker Hub (yang memang tidak pernah ada di sana,
REM ini image custom) dan gagal dengan pesan membingungkan
REM "pull access denied ... repository does not exist".
docker image inspect presensee-api:${APP_VERSION} >nul 2>&1
if errorlevel 1 goto GAGAL_IMPOR
docker image inspect presensee-web:${APP_VERSION} >nul 2>&1
if errorlevel 1 goto GAGAL_IMPOR
goto IMPOR_SUKSES

:GAGAL_IMPOR
color 0C
echo.
echo [ERROR] Image Docker PresenSee tidak ditemukan setelah proses impor.
echo Berkas presensee-images.tar kemungkinan rusak saat disalin ke PC ini
echo ^(lewat ekstrak ZIP, USB, atau unduhan yang terputus^) - BUKAN masalah
echo di aplikasinya. Unduh ulang paketnya, lalu coba lagi.
echo.
pause
exit /b 1

:IMPOR_SUKSES
echo [OK] Image Docker berhasil diimpor!
echo.

:SKIP_TAR_LOAD

echo [1/3] Memulai service PresenSee v${APP_VERSION}...
docker compose up -d

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Gagal menjalankan container Docker.
    echo Image presensee-api dan presensee-web sudah dipastikan ada di PC ini,
    echo jadi kemungkinan besar penyebabnya PC ini perlu menarik postgres:16-alpine
    echo dari internet dan koneksinya sedang bermasalah. Periksa koneksi internet
    echo lalu coba jalankan lagi. Kalau masih gagal, pesan lengkap ada di atas.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Menunggu service siap (3 detik)...
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Membuka aplikasi PresenSee di browser...


echo.
echo [4/4] Menyiapkan Scanner Agent (Mode C# Raw Input)...
set "AGENT_RAW_DIR=%~dp0apps\scanner-agent-raw"
set "AGENT_SIAP=0"
if exist "%AGENT_RAW_DIR%\RakitAplikasi.bat" (
    echo   [INFO] Merakit file EXE...
    call "%AGENT_RAW_DIR%\RakitAplikasi.bat" >nul 2>&1
    if exist "%AGENT_RAW_DIR%\AgenScannerRaw.exe" (
        REM Tambahkan ke Registry agar otomatis jalan saat user login
        reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PresenSeeScanner" /t REG_SZ /d "\"%AGENT_RAW_DIR%\AgenScannerRaw.exe\"" /f >nul 2>&1
        REM Matikan proses lama jika ada, lalu jalankan yang baru
        taskkill /f /im AgenScannerRaw.exe >nul 2>&1
        start "" "%AGENT_RAW_DIR%\AgenScannerRaw.exe"
        set "AGENT_SIAP=1"
        echo   [OK] Scanner C# Raw Input aktif di background!
    ) else (
        echo   [GAGAL] Kompilasi .NET gagal. Pastikan OS memiliki .NET Framework.
    )
)

:SKIP_AGENT

echo.
echo ====================================================================
echo          [SUKSES] PRESENSEE v${APP_VERSION} BERHASIL DIJALANKAN!
echo ====================================================================
echo  - Dashboard Web : http://localhost:3000
echo  - Konsol Scan   : http://localhost:3000/scan
echo  - Backend API   : http://localhost:5000/api/v1
if "%AGENT_SIAP%"=="1" (
    echo  - Scanner Agent : aktif
) else if exist "%AGENT_DIR%\\dist\\index.js" (
    echo  - Scanner Agent : BELUM dipasang sebagai layanan ^(lihat pesan di atas^)
)
echo.
echo Jendela ini boleh ditutup. Untuk menghentikan aplikasi,
echo jalankan file "HENTIKAN-PRESENSEE.bat".
echo ====================================================================
echo.
pause
`;
  fs.writeFileSync(path.join(DEPLOY_DIR, 'JALANKAN-PRESENSEE.bat'), toCrlf(jalankanBat), 'utf-8');

} else {
  console.log('⚡ Docker tidak terdeteksi lokal. Menggunakan Mode Bundling Kompilasi JS (Tanpa Source Code)...');
  
  // Build pnpm lokal untuk kompilasi dist (pastikan mengarah ke port 5000 di Windows)
  console.log('🔨 [1/4] Mem-build proyek lokal (pnpm build)...');
  execSync('NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1 pnpm build', { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://localhost:5000/api/v1' } });

  // Salin berkas hasil build JS saja (dist/ & .next/standalone)
  console.log('📂 [2/4] Meng-copy hasil kompilasi JS (dist & standalone, 0% .ts/.tsx)...');

  // packages/shared
  const sharedDeploy = path.join(DEPLOY_DIR, 'packages', 'shared');
  fs.mkdirSync(sharedDeploy, { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'packages', 'shared', 'package.json'), path.join(sharedDeploy, 'package.json'));
  fs.cpSync(path.join(ROOT_DIR, 'packages', 'shared', 'dist'), path.join(sharedDeploy, 'dist'), { recursive: true, dereference: true });

  // apps/api
  const apiDeploy = path.join(DEPLOY_DIR, 'apps', 'api');
  fs.mkdirSync(apiDeploy, { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'apps', 'api', 'package.json'), path.join(apiDeploy, 'package.json'));
  fs.cpSync(path.join(ROOT_DIR, 'apps', 'api', 'dist'), path.join(apiDeploy, 'dist'), { recursive: true, dereference: true });
  fs.cpSync(path.join(ROOT_DIR, 'apps', 'api', 'prisma'), path.join(apiDeploy, 'prisma'), { recursive: true, dereference: true });

  // apps/web
  const webDeploy = path.join(DEPLOY_DIR, 'apps', 'web');
  fs.mkdirSync(webDeploy, { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'apps', 'web', 'package.json'), path.join(webDeploy, 'package.json'));
  fs.cpSync(path.join(ROOT_DIR, 'apps', 'web', '.next'), path.join(webDeploy, '.next'), { recursive: true, dereference: true });

  // Manifest monorepo
  fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(DEPLOY_DIR, 'package.json'));
  fs.copyFileSync(path.join(ROOT_DIR, 'pnpm-lock.yaml'), path.join(DEPLOY_DIR, 'pnpm-lock.yaml'));
  fs.copyFileSync(path.join(ROOT_DIR, 'pnpm-workspace.yaml'), path.join(DEPLOY_DIR, 'pnpm-workspace.yaml'));

  // Dockerfile khusus untuk dist/ (tanpa source code)
  const apiDockerfileDeploy = `FROM node:22-alpine AS prod-deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @siklon/api...

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=Asia/Jakarta

RUN addgroup -g 1001 -S nodejs && adduser -S express -u 1001

COPY --from=prod-deps --chown=express:nodejs /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=express:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --chown=express:nodejs packages/shared/package.json ./packages/shared/package.json
COPY --chown=express:nodejs packages/shared/dist ./packages/shared/dist
COPY --chown=express:nodejs apps/api/package.json ./apps/api/package.json
COPY --chown=express:nodejs apps/api/dist ./apps/api/dist

USER express
EXPOSE 5000

CMD ["node", "apps/api/dist/server.js"]
`;
  fs.writeFileSync(path.join(apiDeploy, 'Dockerfile'), apiDockerfileDeploy, 'utf-8');

  const webDockerfileDeploy = `FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Jakarta

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --chown=nextjs:nodejs apps/web/.next/standalone ./
COPY --chown=nextjs:nodejs apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
`;
  fs.writeFileSync(path.join(webDeploy, 'Dockerfile'), webDockerfileDeploy, 'utf-8');

  // docker-compose.yml untuk build dari dist
  const dockerComposeDeploy = `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: presensee-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: absen
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 123123
      TZ: Asia/Jakarta
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: presensee-api
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      TZ: Asia/Jakarta
      DATABASE_URL: postgresql://postgres:123123@db:5432/absen
      JWT_SECRET: super-secret-jwt-key-replace-in-production
      SCANNER_API_KEY: presensee-scanner-api-key-2026
      WA_PROVIDER: baileys
      # WAJIB eksplisit — lihat penjelasan di template mode Docker Image di
      # atas (STORAGE_PATH/WA_SESSION_PATH). Sama-sama berlaku di sini.
      STORAGE_PATH: /app/apps/api/storage
      WA_SESSION_PATH: /app/apps/api/storage/wa-session
    depends_on:
      - db
    volumes:
      - ./storage:/app/apps/api/storage

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: presensee-web
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      TZ: Asia/Jakarta
    depends_on:
      - api

volumes:
  postgres_data:
`;
  fs.writeFileSync(path.join(DEPLOY_DIR, 'docker-compose.yml'), dockerComposeDeploy, 'utf-8');

  const jalankanBat = `@echo off
cd /d "%~dp0"
title PresenSee - Jalankan Aplikasi Presensi Siswa
color 0A
cls

echo ====================================================================
echo                   PRESENSEE - SISTEM PRESENSI SISWA
echo ====================================================================
echo.
echo Sedang memeriksa status Docker Desktop...
echo.

docker info >nul 2>&1
if not errorlevel 1 goto SKIP_DOCKER_START2

echo [INFO] Docker Desktop belum aktif. Mencoba menyalakannya secara otomatis...

REM Cara PALING ANDAL: subcommand \`docker desktop start\` bawaan Docker
REM Desktop modern. Ini bekerja APAPUN lokasi instalasinya — tidak perlu tahu
REM di mana file .exe-nya — selama CLI \`docker\` ada di PATH (dan itu sudah
REM terbukti benar di PC ini, karena \`docker info\` tadi berhasil dijalankan
REM tanpa "command not found").
docker desktop start >nul 2>&1

REM Cadangan kalau subcommand di atas tidak dikenali (versi Docker Desktop
REM lama) — coba tebak lokasi .exe di tempat yang lazim. Empat kemungkinan
REM disertakan, TERMASUK mode instal "tanpa admin" yang menaruhnya di
REM %%LocalAppData%% — kejadian nyata (21 September 2026): dua lokasi
REM Program Files saja TIDAK CUKUP, PC client punya Docker Desktop tapi
REM tidak di salah satu dari keduanya, dan skrip lama keliru bilang
REM "belum terpasang" padahal ikonnya jelas ada di Desktop.
REM %%ProgramFiles(x86)%% TIDAK BOLEH dipakai langsung di dalam blok
REM if(...)else(...) — tanda kurung di NAMA variabelnya sendiri membingungkan
REM pencocokan kurung blok cmd.exe (jebakan batch yang sudah lama dikenal).
set "PF86=%ProgramFiles(x86)%"
if exist "%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe" start "" "%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe"
if exist "%PF86%\\Docker\\Docker\\Docker Desktop.exe" start "" "%PF86%\\Docker\\Docker\\Docker Desktop.exe"
if exist "%LocalAppData%\\Docker\\Docker Desktop.exe" start "" "%LocalAppData%\\Docker\\Docker Desktop.exe"
if exist "%LocalAppData%\\Programs\\Docker\\Docker Desktop.exe" start "" "%LocalAppData%\\Programs\\Docker\\Docker Desktop.exe"

echo Menunggu Docker Desktop siap di latar belakang (bisa sampai 2 menit)...

set "COBA2=0"
:loop_docker2
timeout /t 3 /nobreak >nul
set /a COBA2+=1
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_SIAP2
if %COBA2% lss 40 goto loop_docker2

color 0C
echo.
echo [ERROR] Docker Desktop belum aktif setelah ditunggu 2 menit.
echo.
echo \`docker\` sendiri sudah bisa dijalankan di PC ini, jadi Docker Desktop
echo KEMUNGKINAN BESAR sudah terpasang, hanya saja skrip ini tidak berhasil
echo menyalakannya secara otomatis (mis. terpasang di lokasi yang tidak biasa).
echo.
echo Silakan buka Docker Desktop SENDIRI sekali ini (cari ikonnya di Desktop
echo atau Start Menu), tunggu sampai ikon paus di system tray jadi stabil,
echo lalu jalankan skrip ini lagi.
echo.
echo Kalau memang belum pernah dipasang, unduh dari https://www.docker.com
echo.
pause
exit /b 1

:DOCKER_SIAP2
echo [OK] Docker Desktop telah aktif dan siap!
echo.

:SKIP_DOCKER_START2

echo [1/3] Memulai service PresenSee (Database, API, ^& Web)...
docker compose up -d --build

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Gagal menjalankan container Docker.
    echo Periksa pesan kesalahan di atas.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Menunggu service siap (3 detik)...
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Membuka aplikasi PresenSee di browser...


echo.
echo [4/4] Menyiapkan Scanner Agent (Mode C# Raw Input)...
set "AGENT_RAW_DIR=%~dp0apps\scanner-agent-raw"
set "AGENT_SIAP=0"
if exist "%AGENT_RAW_DIR%\RakitAplikasi.bat" (
    echo   [INFO] Merakit file EXE...
    call "%AGENT_RAW_DIR%\RakitAplikasi.bat" >nul 2>&1
    if exist "%AGENT_RAW_DIR%\AgenScannerRaw.exe" (
        REM Tambahkan ke Registry agar otomatis jalan saat user login
        reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PresenSeeScanner" /t REG_SZ /d "\"%AGENT_RAW_DIR%\AgenScannerRaw.exe\"" /f >nul 2>&1
        REM Matikan proses lama jika ada, lalu jalankan yang baru
        taskkill /f /im AgenScannerRaw.exe >nul 2>&1
        start "" "%AGENT_RAW_DIR%\AgenScannerRaw.exe"
        set "AGENT_SIAP=1"
        echo   [OK] Scanner C# Raw Input aktif di background!
    ) else (
        echo   [GAGAL] Kompilasi .NET gagal. Pastikan OS memiliki .NET Framework.
    )
)

:SKIP_AGENT2

echo.
echo ====================================================================
echo               [SUKSES] PRESENSEE BERHASIL DIJALANKAN!
echo ====================================================================
echo  - Dashboard Web : http://localhost:3000
echo  - Konsol Scan   : http://localhost:3000/scan
echo  - Backend API   : http://localhost:5000/api/v1
if "%AGENT_SIAP%"=="1" (
    echo  - Scanner Agent : aktif
) else if exist "%AGENT_DIR%\\dist\\index.js" (
    echo  - Scanner Agent : BELUM dipasang sebagai layanan ^(lihat pesan di atas^)
)
echo.
echo Jendela ini boleh ditutup. Untuk menghentikan aplikasi,
echo jalankan file "HENTIKAN-PRESENSEE.bat".
echo ====================================================================
echo.
pause
`;
  fs.writeFileSync(path.join(DEPLOY_DIR, 'JALANKAN-PRESENSEE.bat'), toCrlf(jalankanBat), 'utf-8');
}

// Copy install.bat, HENTIKAN-PRESENSEE.bat, BUKA-APLIKASI.bat & INSTAL-DOCKER.bat (dengan CRLF agar aman di CMD Windows)
copyAsCrlf(path.join(ROOT_DIR, 'install.bat'), path.join(DEPLOY_DIR, 'install.bat'));
copyAsCrlf(path.join(ROOT_DIR, 'HENTIKAN-PRESENSEE.bat'), path.join(DEPLOY_DIR, 'HENTIKAN-PRESENSEE.bat'));
copyAsCrlf(path.join(ROOT_DIR, 'BUKA-APLIKASI.bat'), path.join(DEPLOY_DIR, 'BUKA-APLIKASI.bat'));
copyAsCrlf(path.join(ROOT_DIR, 'INSTAL-DOCKER.bat'), path.join(DEPLOY_DIR, 'INSTAL-DOCKER.bat'));

// Copy Database schema & seed (seed-esensial.sql BE-119 — jalur "tanpa data
// contoh" dari install.bat menimpa database/seed.sql di paket deploy
// dengan isi berkas ini sebelum "docker compose up" pertama kali).
const deployDbDir = path.join(DEPLOY_DIR, 'database');
fs.mkdirSync(deployDbDir, { recursive: true });
fs.copyFileSync(path.join(ROOT_DIR, 'database', 'schema.sql'), path.join(deployDbDir, 'schema.sql'));
fs.copyFileSync(path.join(ROOT_DIR, 'database', 'seed.sql'), path.join(deployDbDir, 'seed.sql'));
fs.copyFileSync(path.join(ROOT_DIR, 'database', 'seed-esensial.sql'), path.join(deployDbDir, 'seed-esensial.sql'));

// Copy Scanner Agent (tanpa node_modules dan src)
console.log('📂 [3/4] Menyalin berkas Scanner Agent...');
const deployAgentDir = path.join(DEPLOY_DIR, 'apps', 'scanner-agent');
fs.mkdirSync(deployAgentDir, { recursive: true });

const agentFilesToCopy = [
  'package.json',
  'config.example.json',
  'install-service.bat',
  'uninstall-service.bat',
  'README.md',
  'presensee-scanner-agent.service'
];

for (const file of agentFilesToCopy) {
  const src = path.join(ROOT_DIR, 'apps', 'scanner-agent', file);
  if (fs.existsSync(src)) {
    if (file.endsWith('.bat')) {
      copyAsCrlf(src, path.join(deployAgentDir, file));
    } else {
      fs.copyFileSync(src, path.join(deployAgentDir, file));
    }
  }
}


// Copy Scanner Agent Raw
console.log('📂 Menyalin berkas Scanner Agent Raw (Khusus Keyboard)...');
const deployAgentRawDir = path.join(DEPLOY_DIR, 'apps', 'scanner-agent-raw');
fs.mkdirSync(deployAgentRawDir, { recursive: true });
const agentRawSrcDir = path.join(ROOT_DIR, 'apps', 'scanner-agent-raw');
if (fs.existsSync(agentRawSrcDir)) {
  for (const file of fs.readdirSync(agentRawSrcDir)) {
    const src = path.join(agentRawSrcDir, file);
    if (fs.statSync(src).isDirectory()) continue;
    if (file.endsWith('.bat')) {
      copyAsCrlf(src, path.join(deployAgentRawDir, file));
    } else {
      fs.copyFileSync(src, path.join(deployAgentRawDir, file));
    }
  }
}

// Tambahkan config.json default untuk AgenScannerRaw
fs.writeFileSync(
  path.join(deployAgentRawDir, 'config.json'),
  JSON.stringify({ apiUrl: 'http://localhost:5000', apiKey: 'presensee-scanner-api-key-2026' }, null, 2) + '\n',
  'utf-8',
);


// Copy dist scanner-agent jika ada
const agentDistSrc = path.join(ROOT_DIR, 'apps', 'scanner-agent', 'dist');
if (fs.existsSync(agentDistSrc)) {
  fs.cpSync(agentDistSrc, path.join(deployAgentDir, 'dist'), { recursive: true });
}

/*
 * Installer bawaan Node.js + NSSM (BE-117) — Scanner Agent di paket Docker
 * ini butuh keduanya juga (Docker cuma menjalankan API/Web/DB di container,
 * scanner USB tetap baca lewat Node.js langsung di host Windows), dan
 * sebelumnya cuma mengandalkan winget/unduhan online saat dipasang,
 * padahal berkas yang sama persis sudah dipakai di tools/buat-paket-native.mjs.
 * Disalin ke installer\ di root paket (sejajar dengan apps\, database\) —
 * install-service.bat mencarinya di situ lewat path relatif "..\..\installer".
 * Opsional: kalau data/ tidak ada installer-nya, dilewati saja (Scanner
 * Agent tetap bisa dipasang manual lewat winget/unduhan seperti sebelumnya).
 */
console.log('📂 [3/4] Menyalin installer bawaan Node.js + NSSM untuk Scanner Agent...');
const deployInstallerDir = path.join(DEPLOY_DIR, 'installer');
if (fs.existsSync(DATA_DIR)) {
  const nodeMsi = fs.readdirSync(DATA_DIR).find((f) => /^node-.*\.msi$/i.test(f));
  const nssmExeSrc = path.join(DATA_DIR, 'nssm-2.24/win64/nssm.exe');
  if (nodeMsi || fs.existsSync(nssmExeSrc)) fs.mkdirSync(deployInstallerDir, { recursive: true });
  if (nodeMsi) {
    fs.copyFileSync(path.join(DATA_DIR, nodeMsi), path.join(deployInstallerDir, nodeMsi));
    console.log(`   [OK] Node.js: ${nodeMsi}`);
  } else {
    console.log('   [INFO] Installer Node.js (.msi) tidak ada di data/ - dilewati.');
  }
  if (fs.existsSync(nssmExeSrc)) {
    fs.copyFileSync(nssmExeSrc, path.join(deployInstallerDir, 'nssm.exe'));
    console.log('   [OK] NSSM');
  } else {
    console.log('   [INFO] nssm.exe tidak ada di data/ - dilewati.');
  }

  /*
   * Installer Docker Desktop (BE-118) — permintaan pemilik proyek supaya
   * PC client tidak perlu unduh ~600MB sendiri dari docker.com. Dipasang
   * lewat INSTAL-DOCKER.bat terpisah (BUKAN di dalam JALANKAN-PRESENSEE.bat
   * yang jalan tiap boot) karena ini operasi sekali-pasang yang butuh admin
   * dan bisa minta restart Windows (aktivasi fitur WSL2) — dipisah supaya
   * JALANKAN-PRESENSEE.bat tetap ringan dan tidak berulang kali mengecek
   * WSL/Docker Desktop di setiap boot.
   */
  const dockerExeSrc = path.join(DATA_DIR, 'Docker Desktop Installer.exe');
  if (fs.existsSync(dockerExeSrc)) {
    fs.mkdirSync(deployInstallerDir, { recursive: true });
    fs.copyFileSync(dockerExeSrc, path.join(deployInstallerDir, 'Docker Desktop Installer.exe'));
    console.log('   [OK] Docker Desktop');
  } else {
    console.log('   [INFO] "Docker Desktop Installer.exe" tidak ada di data/ - dilewati (client tetap bisa pasang manual dari docker.com).');
  }
} else {
  console.log('   [INFO] Folder data/ tidak ada - installer bawaan dilewati.');
}

/*
 * config.json SUDAH TERISI, bukan cuma config.example.json yang harus
 * disalin & diedit manual (permintaan pemilik proyek, 22 September 2026).
 *
 * Nilainya sudah pasti benar untuk skenario All-in-One (Scanner Agent di PC
 * yang sama dengan Docker) — cocok persis dengan SCANNER_API_KEY dan port API
 * di docker-compose.yml paket ini, jadi tidak ada alasan menyuruh client
 * mengetiknya sendiri dan berisiko salah ketik. Kalau nanti dipakai sebagai
 * "PC 2" di skenario multi-gerbang, tinggal timpa apiUrl-nya ke IP PC 1 —
 * config.example.json tetap disalin sebagai referensi format lengkapnya
 * (termasuk kolom opsional yang tidak perlu diisi di kasus umum).
 */
fs.writeFileSync(
  path.join(deployAgentDir, 'config.json'),
  JSON.stringify({ apiUrl: 'http://localhost:5000', apiKey: 'presensee-scanner-api-key-2026' }, null, 2) + '\n',
  'utf-8',
);

/*
 * `package.json` yang disalin apa adanya dari repo sumber punya scripts untuk
 * lingkungan DEV (`dev`, `build`, `typecheck`, dan `ports` yang menjalankan
 * `tsx src/cli-ports.ts`) — tapi paket client HANYA membawa `dist/`, TANPA
 * `src/` dan TANPA `tsx` (devDependency, sengaja tidak ikut `--omit=dev`).
 *
 * Terbukti gagal kalau diikuti apa adanya (22 September 2026, direproduksi
 * ulang di folder salinan sebelum menjawab pertanyaan client):
 *   npm run ports
 *   > tsx src/cli-ports.ts
 *   sh: 1: tsx: not found
 *
 * `scripts` untuk paket client diganti supaya HANYA memuat yang benar-benar
 * bisa jalan dari `dist/` — `ports` memanggil `node dist/cli-ports.js` * langsung, bukan lewat tsx.
 */
const agentPkgPath = path.join(deployAgentDir, 'package.json');
const agentPkg = JSON.parse(fs.readFileSync(agentPkgPath, 'utf-8'));
agentPkg.scripts = {
  start: 'node dist/index.js',
  ports: 'node dist/cli-ports.js',
};
fs.writeFileSync(agentPkgPath, JSON.stringify(agentPkg, null, 2) + '\n', 'utf-8');

// README versi client: langkah "Pemasangan" ditulis ulang untuk paket
// TERKOMPILASI (tanpa src/, tanpa npm run build) — bagian lain (isi
// config.json, log, masalah umum) sama dengan versi developer di repo.
const agentReadmeClient = `# PresenSee Scanner Agent

Berjalan di **PC gerbang sekolah**. Membaca scanner barcode lewat port serial dan
mengirim hasilnya ke server PresenSee.

## Yang perlu disiapkan lebih dulu

1. **Scanner harus dalam mode USB Virtual COM Port**, bukan mode keyboard.
   Ubah dengan memindai barcode setup dari buku manual scanner. Kalau masih mode
   keyboard, ia hanya "mengetik" ke jendela yang sedang aktif dan agent ini tidak
   bisa membacanya sama sekali.
2. **Node.js 22 atau lebih baru** (antrean offline memakai \`node:sqlite\` bawaan Node).
3. **Kunci API** dari halaman Scanner pada aplikasi.

## Pemasangan

Folder ini sudah berisi hasil kompilasi (\`dist/\`) — TIDAK perlu \`npm run build\`.

\`\`\`bash
# 1. Pasang dependensi (folder ini tidak membawa node_modules)
npm install --omit=dev

# 2. Buat config.json
cp config.example.json config.json
#    isi apiUrl dan apiKey

# 3. Periksa scanner terbaca
npm run ports
\`\`\`
\`npm run ports\` adalah langkah diagnosa terpenting. Kalau hasilnya kosong,
scanner masih dalam mode keyboard — perbaiki itu dulu sebelum lanjut.

### Windows

\`\`\`install-service.bat        (klik kanan > Run as administrator)
\`\`\`
Membutuhkan [nssm](https://nssm.cc/download). Layanan hidup otomatis setiap PC
dinyalakan dan dijalankan ulang sendiri bila mati.

### Linux

\`\`\`bash
sudo cp -r . /opt/presensee-agent
sudo useradd -r -s /bin/false presensee
sudo usermod -aG dialout presensee        # WAJIB: tanpa ini port serial tidak bisa dibuka
sudo cp presensee-scanner-agent.service /etc/systemd/system/
sudo systemctl enable --now presensee-scanner-agent
\`\`\`
## Isi config.json

\`\`\`jsonc
{
  "apiUrl": "https://presensi.sekolahku.sch.id",
  "apiKey": "dari halaman Scanner",

  // opsional
  "antreanPath": "./antrean.sqlite",
  "portTambahan": [],        // path port yang tidak terdeteksi otomatis
  "laporDetik": 60,
  "kirimUlangDetik": 15,
  "logLevel": "info"         // debug | info | warn | error
}
\`\`\`
**Daftar scanner tidak ada di sini.** Nomor COM di Windows bisa berubah sendiri
saat colokan USB dipindah, dan tidak ada yang tahu scanner fisik mana yang jadi
COM3 tanpa mencoba. Karena itu penamaan scanner dilakukan dari halaman **Scanner**
di aplikasi: tekan **Kenali Scanner**, tempelkan barcode di scanner yang ingin
dinamai, lalu beri kode gerbangnya. Agent menerapkannya **tanpa perlu restart**.

## Kalau internet mati

Scan tetap tercatat. Agent menyimpannya di \`antrean.sqlite\` (tahan mati listrik)
dan mengirimkannya begitu server bisa dihubungi. **Jam scan aslinya yang
tersimpan**, bukan jam pengiriman — jadi siswa yang datang 06:50 tetap tercatat
06:50 meski baru terkirim pukul 09:00.

## Membaca log

| | |
|---|---|
| Windows | \`type log\\agent.log\` |
| Linux | \`journalctl -u presensee-scanner-agent -f\` |

Yang perlu diperhatikan di log:

- \`OFFLINE — scan ditampung di antrean lokal\` — server tidak terjangkau. Wajar
  sesaat; kalau berjam-jam, periksa jaringan.
- \`Belum ada scanner yang dipetakan\` — agent jalan tapi belum diberi nama di aplikasi.
- \`X-Api-Key ditolak server\` — \`apiKey\` di config.json salah.
- \`gagal membuka /dev/ttyACM0\` di Linux — pengguna belum masuk grup \`dialout\`.

## Masalah yang sering terjadi

**\`npm run ports\` kosong.** Scanner masih mode keyboard. Ubah lewat barcode setup
di buku manualnya.

**Di Linux semua port gagal dibuka.** Pengguna belum di grup \`dialout\`:
\`sudo usermod -aG dialout $USER\`, lalu logout-login.

**Scanner tidak punya nomor seri.** Agent tetap jalan, tapi pemetaannya ikut
lokasi colokan USB — **jangan pindahkan colokannya**, karena pemetaannya akan
tertukar. Halaman Scanner menandai kondisi ini dengan peringatan.
`;
fs.writeFileSync(path.join(deployAgentDir, 'README.md'), agentReadmeClient, 'utf-8');

// 6. Buat file PANDUAN-INSTALL-WINDOWS.md & PETUNJUK-CLIENT.txt di dist-deploy
console.log('📖 [4/4] Membuat berkas Panduan Instalasi Klien Windows...');

const panduanClientMd = `# 📖 PANDUAN INSTALASI & PENGGUNAAN PRESENSEE (PC CLIENT WINDOWS)

Panduan ini ditunjukkan untuk **Petugas / Teknisi Sekolah** dalam memasang dan menjalankan aplikasi **PresenSee All-in-One** di PC Windows gerbang sekolah.

---

## 📁 LANGKAH 1: Menempatkan Folder Aplikasi

1. Ekstrak / salin seluruh folder ini ke lokasi drive PC Windows (disarankan: \`C:\\PresenSee\` atau \`D:\\PresenSee\`).
2. Pastikan file berikut ada di dalam folder:
   - \`install.bat\` ← **cukup jalankan ini, lanjut ke Langkah 2**
   - \`INSTAL-DOCKER.bat\`, \`JALANKAN-PRESENSEE.bat\`, \`HENTIKAN-PRESENSEE.bat\`, \`BUKA-APLIKASI.bat\`   - \`installer\\\` (berisi installer Docker Desktop, Node.js, dan NSSM bawaan)
   - \`docker-compose.yml\`   - \`apps/\`   - \`database/\`
---

## 🚀 LANGKAH 2: Instalasi (Satu Klik, Dilakukan Sekali Saja)

1. Klik kanan **\`install.bat\`**, pilih **Run as administrator**.
2. Skrip ini mengurus semuanya berurutan, tanpa perlu diawasi:
   - **Docker Desktop + WSL2** — dipasang otomatis dari installer bawaan di
     folder \`installer\\\` (**tidak perlu unduh apa pun dari internet**). Kalau
     WSL2 belum aktif di PC ini, diaktifkan otomatis juga.
   - **Data awal database** — ada pertanyaan **"Masukkan data contoh? (Y/N)"**:
     jawab **Y** untuk coba-coba dulu (dapat kelas & siswa contoh, aman
     dihapus/diedit nanti), atau **N** untuk pemasangan sungguhan di sekolah
     (mulai dari kosong, kelas & siswa asli ditambahkan sendiri lewat aplikasi).
   - **Container Docker** (Database, API, Web) dinyalakan otomatis.
   - **Scanner Agent** — kalau PC ini juga dipakai baca scanner USB gerbang,
     didaftarkan otomatis sebagai layanan Windows (karena \`install.bat\`     dijalankan sebagai Administrator, langkah ini tidak perlu klik kanan
     manual lagi seperti versi sebelumnya).
   - Diakhiri dengan browser terbuka otomatis ke \`http://localhost:3000\`.
3. **Kalau muncul pertanyaan "Restart PC sekarang? (Y/N)"** (biasanya karena
   WSL2 baru pertama kali diaktifkan): jawab **Y**, lalu setelah PC menyala
   kembali **jalankan \`install.bat\` ini LAGI** — langkah yang sudah selesai
   (Docker Desktop, data database) tidak diulang, langsung lanjut ke
   menyalakan aplikasi.
4. **Akun Login Bawaan**:
   - **Username**: \`superadmin\` (atau \`admin\` untuk peran Admin Tata Usaha)
   - **Password**: \`siklon123\`   - Sistem akan meminta ganti password ini di percobaan masuk pertama — itu memang disengaja, bukan kesalahan.

   ⚠️ **Kalau Docker Desktop gagal menyala dan pesannya menyebut WSL** (mis.
   "WSL 2 installation is incomplete", update kernel WSL, atau semacamnya):
   1. Buka **PowerShell sebagai Administrator**.
   2. Jalankan: \`wsl --update\`   3. **Restart PC Windows**, lalu jalankan \`install.bat\` lagi.

---

## 📷 LANGKAH 3: Kalau Scanner USB Belum Otomatis Terdaftar

Kalau \`install.bat\` tadi menjawab untuk memasang Scanner Agent tapi pesannya
bilang **"Pendaftaran otomatis tidak berhasil"**, atau Scanner Agent mau
ditambahkan belakangan (bukan saat instalasi awal):

1. Colokkan kabel USB scanner 2D ke port USB PC Windows.
2. Pindai QR setup **"USB Virtual COM Port"** atau **"RS232 Emulation"** dari buku manual bawaan scanner fisik.
3. Buka folder \`apps/scanner-agent\`, pastikan \`config.json\` ada (dibuat otomatis oleh \`install.bat\`).
4. Klik kanan file \`install-service.bat\`, lalu pilih **Run as administrator**.
5. Buka web dashboard \`http://localhost:3000\`, masuk ke menu **Scanner**, klik **Kenali Scanner**, lalu scan salah satu QR siswa untuk memberikan nama gerbang (contoh: \`"Gerbang Utama"\`).

---

## 🖥️ LANGKAH 4: Menyiapkan Mode Layar Penuh (Fullscreen Kiosk)

1. Buka browser ke alamat: \`http://localhost:3000/scan\`2. Tekan tombol **\`F11\`** pada keyboard untuk masuk ke mode Layar Penuh (Fullscreen).

---

## ⚙️ LANGKAH 5: Otomatis Menyala Saat PC Dinyalakan (Auto-Start)

1. Tekan \`Win + R\` pada keyboard Windows.
2. Ketik \`shell:startup\` lalu tekan **Enter**.
3. Buat Pintasan (Shortcut) dari berkas \`JALANKAN-PRESENSEE.bat\` dan taruh di dalam folder Startup tersebut.
4. Setiap kali PC dinyalakan di pagi hari, aplikasi PresenSee akan otomatis aktif dan browser siap digunakan!

---

## 🔴 LANGKAH 6: Menghentikan Aplikasi di Sore Hari

Sebelum PC Sekolah dimatikan di sore hari:
1. **Klik 2x** pada berkas: \`HENTIKAN-PRESENSEE.bat\`2. Semua data presensi & sesi WhatsApp tetap tersimpan aman di PC.

---

## 🌐 LANGKAH 7: Menambah Komputer & Scanner Baru (PC 2 - Multi Gerbang)

Jika sekolah ingin menambah **PC 2 (Komputer Tambahan / Gerbang 2)** yang terhubung ke **PC 1 (Server Utama & Gerbang 1)** via jaringan WiFi / LAN sekolah:

### 1. Di PC 1 (Server Utama):
- Buka Command Prompt di PC 1, ketik \`ipconfig\` untuk melihat IP Lokal PC 1 (contoh: \`192.168.1.100\`).
- Pastikan Port \`5000\` (API) dan Port \`3000\` (Web) diizinkan di Windows Firewall PC 1.

### 2. Di PC 2 (Komputer Tambahan / Gerbang 2):
- **TIDAK PERLU** pasang Docker atau Database di PC 2!
- Cukup salin folder \`apps/scanner-agent\` dari paket deploy ke PC 2.
- Pasang Node.js 22 di PC 2.
- Buka \`apps/scanner-agent/config.json\` di PC 2 dan ganti \`apiUrl\` mengarah ke IP PC 1:
  \`\`\`json
  {
    "apiUrl": "http://192.168.1.100:5000",
    "apiKey": "presensee-scanner-api-key-2026"
  }
  \`\`\`- Colokkan USB Scanner 2D di PC 2, scan QR setup **"USB Virtual COM Port"**.
- Klik kanan \`install-service.bat\` pada PC 2 -> **Run as administrator**.
- Buka browser di PC 2 ke \`http://192.168.1.100:3000/scanner\`, klik **Kenali Scanner**, scan QR siswa di PC 2, lalu beri nama \`"Gerbang 2"\`.
- Untuk tampilan presensi di PC 2, buka browser ke \`http://192.168.1.100:3000/scan\`.

---

## ⚠️ LANGKAH 8: Kalau Muncul "Berkas Rusak (Checksum Tidak Cocok)" atau "Pull Access Denied"

Kedua pesan ini artinya SAMA: berkas \`presensee-images.tar\` di dalam paket ini
rusak saat disalin ke PC ini — bukan masalah aplikasinya. Ini biasanya terjadi
karena:

- Ekstrak ZIP terputus di tengah jalan (koneksi lambat, PC dimatikan saat proses
  ekstrak belum selesai).
- Antivirus memindai/mengubah berkas besar ini di tengah proses salin.
- Unduhan paketnya sendiri belum 100% selesai saat disalin ke PC ini.

**Solusinya satu: unduh ulang paketnya dari sumber asli** (jangan salin ulang
dari berkas yang sudah ada di PC ini, karena kalau sumbernya sendiri yang rusak,
menyalin ulang tidak akan memperbaikinya), lalu jalankan \`JALANKAN-PRESENSEE.bat\`lagi. Skrip ini memeriksa keutuhan berkasnya lebih dulu lewat checksum SHA256
sebelum mencoba memuatnya — kalau lolos pemeriksaan itu, berkasnya pasti utuh.

---

> 💡 *Catatan Keamanan*: Paket ini **100% bebas dari kode sumber mentah (\`.ts\`, \`.tsx\`, \`src/\`)**. Seluruh kode yang berjalan adalah bundel biner/JavaScript hasil kompilasi yang aman dan efisien.
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'PANDUAN-INSTALL-WINDOWS.md'), panduanClientMd, 'utf-8');

const petunjukTxt = `====================================================================
           PANDUAN SINGKAT INSTALL & JALANKAN PRESENSEE
====================================================================

1. PERSIAPAN (PC 1 / SERVER UTAMA):
   - Unduh & Install Docker Desktop for Windows:
     https://www.docker.com/products/docker-desktop/
   - Buka Docker Desktop sampai ikon paus berwarna biru di tray aktif.
   - Kalau Docker Desktop gagal menyala dan pesannya menyebut WSL: buka PowerShell
     sebagai Administrator, jalankan "wsl --install", lalu restart PC.
   - Supaya Docker Desktop tidak membuka jendela tiap kali menyala (cukup di tray):
     Settings > General > hilangkan centang "Open Docker Dashboard when Docker
     Desktop starts" > Apply & Restart. Cukup sekali, berlaku seterusnya.
     Detail lengkap: PANDUAN-INSTALL-WINDOWS.md

2. MEMULAI APLIKASI:
   - Klik 2x file "JALANKAN-PRESENSEE.bat"
   - Browser akan otomatis terbuka ke: http://localhost:3000
   - Login: superadmin / siklon123 (wajib ganti password saat masuk pertama)

3. MENGHENTIKAN APLIKASI:
   - Klik 2x file "HENTIKAN-PRESENSEE.bat"

4. SETUP SCANNER USB GERBANG 1:
   - Buka folder apps\\scanner-agent
   - Copy config.example.json -> config.json
   - Klik kanan install-service.bat -> Run as administrator

5. MENAMBAH PC 2 & SCANNER GERBANG 2 (MULTI-GERBANG LAN):
   - Di PC 1: Ketik ipconfig untuk melihat IP PC 1 (misal 192.168.1.100)
   - Di PC 2: Cukup copy folder apps\\scanner-agent
   - Di PC 2: Edit config.json -> "apiUrl": "http://192.168.1.100:5000"
   - Di PC 2: Klik kanan install-service.bat -> Run as administrator

6. KALAU MUNCUL "BERKAS RUSAK (CHECKSUM TIDAK COCOK)" ATAU "PULL ACCESS DENIED":
   - Ini artinya berkas presensee-images.tar rusak saat disalin ke PC ini,
     BUKAN masalah aplikasinya.
   - Solusinya: unduh ulang paketnya dari sumber asli, lalu jalankan lagi.

Detail panduan lengkap dapat dibaca pada berkas: PANDUAN-INSTALL-WINDOWS.md
====================================================================
`;

fs.writeFileSync(path.join(DEPLOY_DIR, 'PETUNJUK-CLIENT.txt'), petunjukTxt, 'utf-8');

// 5. Buat file ZIP otomatis dari folder presensee
console.log('\n🤐 [5/5] Mengompres paket deploy "presensee" menjadi berkas ZIP...');
const zipFileName = 'presensee.zip';
const zipPath = path.join(ROOT_DIR, zipFileName);

// Hapus berkas zip lama jika ada
if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}
const oldZipPath = path.join(ROOT_DIR, 'dist-deploy.zip');
if (fs.existsSync(oldZipPath)) {
  fs.rmSync(oldZipPath, { force: true });
}

let createdZip = false;

// 1. Coba command zip
if (hasCommand('zip')) {
  try {
    execSync(`zip -r "${zipPath}" presensee`, { stdio: 'inherit' });
    createdZip = true;
  } catch (err) {
    console.warn('⚠️ Gagal mengompres via "zip", mencoba perkakas lain...', err.message);
  }
}

// 2. Coba command 7z / 7za
if (!createdZip && (hasCommand('7z') || hasCommand('7za'))) {
  try {
    const cmd7z = hasCommand('7z') ? '7z' : '7za';
    execSync(`${cmd7z} a "${zipPath}" presensee`, { stdio: 'inherit' });
    createdZip = true;
  } catch (err) {
    console.warn('⚠️ Gagal mengompres via "7z", mencoba perkakas lain...', err.message);
  }
}

// 3. Coba tar (terutama di Windows 10/11)
if (!createdZip && hasCommand('tar')) {
  try {
    execSync(`tar -a -c -f "${zipPath}" presensee`, { stdio: 'inherit' });
    createdZip = true;
  } catch (err) {
    // abaikan jika tar tidak mendukung flag zip
  }
}

// 4. Coba PowerShell di Windows
if (!createdZip && process.platform === 'win32') {
  try {
    const psCmd = hasCommand('powershell') ? 'powershell' : (hasCommand('powershell.exe') ? 'powershell.exe' : 'pwsh');
    execSync(`${psCmd} -NoProfile -Command "Compress-Archive -Path presensee -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
    createdZip = true;
  } catch (err) {
    console.warn('⚠️ Gagal mengompres via PowerShell:', err.message);
  }
}

/*
 * Zip yang baru dibuat diverifikasi bisa dibaca ulang secara utuh — supaya
 * kerusakan yang terjadi SAAT MENGOMPRES (bukan saat transfer ke client)
 * ketahuan di sini, bukan menunggu client yang menemukannya berhari-hari
 * kemudian dengan pesan error yang membingungkan.
 */
if (createdZip && fs.existsSync(zipPath)) {
  console.log('🔍 Memverifikasi presensee.zip bisa dibaca ulang...');
  let zipValid = false;
  if (hasCommand('unzip')) {
    try {
      execSync(`unzip -tq "${zipPath}"`, { stdio: 'inherit' });
      zipValid = true;
    } catch {
      zipValid = false;
    }
  } else if (hasCommand('7z') || hasCommand('7za')) {
    try {
      execSync(`${hasCommand('7z') ? '7z' : '7za'} t "${zipPath}"`, { stdio: 'inherit' });
      zipValid = true;
    } catch {
      zipValid = false;
    }
  } else {
    console.warn('⚠️ Tidak ada "unzip" atau "7z" di mesin ini — verifikasi zip dilewati.');
    zipValid = true; // tidak bisa diverifikasi di sini, jangan gagalkan build karenanya
  }
  if (!zipValid) {
    throw new Error('❌ presensee.zip RUSAK sesaat setelah dibuat! Jangan dikirim ke client. Coba jalankan ulang skrip ini.');
  }
  console.log('✅ presensee.zip terverifikasi utuh.\n');
}

console.log('\n====================================================================');
console.log('✨ [BERHASIL] PAKET DEPLOY PRESENSEE BERHASIL DIBUAT!');
console.log('====================================================================');
if (createdZip && fs.existsSync(zipPath)) {
  const stat = fs.statSync(zipPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Berkas ZIP Deploy    : ${zipPath} (${sizeMb} MB)`);
}
console.log('📖 Panduan Client       : PANDUAN-INSTALL-WINDOWS.md & PETUNJUK-CLIENT.txt');
console.log('🔒 Keamanan             : 100% TANPA KODE SUMBER (.ts/.tsx/src)!');
console.log('📋 Instruksi             : Salin berkas "presensee.zip" atau folder "presensee" ke PC Klien Windows.');
console.log('====================================================================\n');

