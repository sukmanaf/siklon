@echo off
cd /d "%~dp0"
title PresenSee - Pemasangan (Node.js + NSSM + PostgreSQL, tanpa Docker)
color 0A
setlocal enabledelayedexpansion

set "LOGFILE=%~dp0install-log.txt"
echo PresenSee install.bat - %DATE% %TIME% > "%LOGFILE%"

net session >nul 2>&1
if errorlevel 1 (
  color 0C
  echo.
  echo  GAGAL: harus dijalankan sebagai Administrator.
  echo  Klik kanan install.bat, pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo.
echo ====================================================================
echo   PRESENSEE - PEMASANGAN NATIF (tanpa Docker)
echo ====================================================================
echo.
echo  Skrip ini akan memasang, kalau belum ada: Node.js, NSSM, dan
echo  PostgreSQL. Prosesnya beberapa menit, jangan tutup jendela ini.
echo  Semua yang terjadi juga dicatat ke install-log.txt di folder ini.
echo.
pause

REM =====================================================================
REM [1/6] Node.js
REM =====================================================================
echo.
echo [1/6] Memeriksa Node.js...
>>"%LOGFILE%" echo [1/6] Memeriksa Node.js...
where node >nul 2>&1
if not errorlevel 1 goto NODE_OK

if exist "installer\node-v24.21.0-x64.msi" (
  echo   Memasang Node.js dari installer bawaan...
  >>"%LOGFILE%" echo   Memasang Node.js dari installer bawaan...
  msiexec /i "installer\node-v24.21.0-x64.msi" /quiet /norestart
) else (
  echo   [INFO] installer bawaan tidak ada, mencoba winget...
  >>"%LOGFILE%" echo   [INFO] installer bawaan tidak ada, mencoba winget...
  where winget >nul 2>&1
  if not errorlevel 1 (
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  )
)

if exist "%ProgramFiles%\nodejs\node.exe" goto NODE_OK
where node >nul 2>&1
if not errorlevel 1 goto NODE_OK

color 0C
echo.
echo  [GAGAL] Node.js tidak berhasil dipasang.
echo  Pasang manual dari https://nodejs.org ^(versi LTS 22 atau lebih baru^),
echo  lalu jalankan install.bat ini lagi.
echo.
>>"%LOGFILE%" echo [GAGAL] Node.js tidak berhasil dipasang.
pause
exit /b 1

:NODE_OK
echo   [OK] Node.js siap.
>>"%LOGFILE%" echo   [OK] Node.js siap.

REM node.exe path SUNGGUHAN dicari di sini, bukan ditebak dari lokasi baku
REM (pelajaran dari install-service.bat Scanner Agent: winget/MSI tidak
REM selalu berakhir di %ProgramFiles%\nodejs).
set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE (
  color 0C
  echo.
  echo  [GAGAL] node.exe tidak ditemukan walau Node.js terdeteksi terpasang.
  echo  Tutup jendela ini, buka lagi, lalu jalankan install.bat sekali lagi
  echo  ^(PATH-nya perlu dimuat ulang^).
  echo.
  >>"%LOGFILE%" echo [GAGAL] node.exe tidak ditemukan setelah terpasang.
  pause
  exit /b 1
)
for %%D in ("%NODE_EXE%") do set "NODE_DIR=%%~dpD"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%NPM_CMD%" set "NPM_CMD=npm"
>>"%LOGFILE%" echo   node.exe: %NODE_EXE%
echo.

REM =====================================================================
REM [2/6] NSSM
REM =====================================================================
echo [2/6] Memeriksa NSSM...
>>"%LOGFILE%" echo [2/6] Memeriksa NSSM...
REM Dicari lewat variabel penanda + "if not defined" berurutan, BUKAN goto
REM yang melompat keluar dari blok tanda kurung — pelajaran sesi ini: goto
REM yang harus melompati blok ber-tanda-kurung lain (apalagi yang bersarang)
REM berisiko membingungkan parser cmd.exe. JALANKAN-PRESENSEE.bat sudah
REM lebih dulu memakai pola ini untuk alasan yang sama.
set "NSSM_EXE="
for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"

if not defined NSSM_EXE if exist "installer\nssm.exe" (
  echo   Memasang NSSM dari installer bawaan...
  >>"%LOGFILE%" echo   Memasang NSSM dari installer bawaan...
  if not exist "%ProgramFiles%\nssm" mkdir "%ProgramFiles%\nssm"
  copy /y "installer\nssm.exe" "%ProgramFiles%\nssm\nssm.exe" >nul
)
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"
if not defined NSSM_EXE (
  echo   [PERINGATAN] installer bawaan tidak ada/gagal disalin, mencoba winget...
  >>"%LOGFILE%" echo   [PERINGATAN] installer bawaan tidak ada/gagal, mencoba winget.
  where winget >nul 2>&1
  if not errorlevel 1 winget install --id NSSM.NSSM -e --silent --accept-package-agreements --accept-source-agreements
)
if not defined NSSM_EXE for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"

if not defined NSSM_EXE (
  color 0C
  echo.
  echo  [GAGAL] NSSM tidak berhasil dipasang.
  echo  Unduh dari https://nssm.cc/download, letakkan nssm.exe di PATH,
  echo  lalu jalankan install.bat ini lagi.
  echo.
  >>"%LOGFILE%" echo [GAGAL] NSSM tidak berhasil dipasang lewat cara mana pun.
  pause
  exit /b 1
)

REM Verifikasi sungguhan - file-nya benar-benar ada di path yang ditemukan,
REM bukan cuma "where"/pencarian yang mengaku ketemu tapi filenya hilang.
if not exist "%NSSM_EXE%" (
  color 0C
  echo.
  echo  [GAGAL] NSSM terdeteksi tapi berkasnya tidak ada di:
  echo    %NSSM_EXE%
  echo.
  >>"%LOGFILE%" echo [GAGAL] NSSM_EXE terdeteksi tapi berkas tidak ada: %NSSM_EXE%
  pause
  exit /b 1
)
set "PATH=%PATH%;%ProgramFiles%\nssm"
echo   [OK] NSSM siap: %NSSM_EXE%
>>"%LOGFILE%" echo   [OK] NSSM siap: %NSSM_EXE%
echo.

REM =====================================================================
REM [3/6] PostgreSQL
REM =====================================================================
echo [3/6] Memeriksa PostgreSQL...
>>"%LOGFILE%" echo [3/6] Memeriksa PostgreSQL...

set "PG_PASSWORD=p0stgr3sql"
set "PGPASSWORD=%PG_PASSWORD%"

REM Selalu gunakan PostgreSQL Portable bawaan PresenSee (Port Khusus 5433)
set "PG_ZIP="
set "PG_ZIP_DIR="
if exist "installer\postgresql-16.15-5-windows-x64-binaries.zip" (
  set "PG_ZIP=postgresql-16.15-5-windows-x64-binaries.zip"
  set "PG_ZIP_DIR=installer"
)
if not defined PG_ZIP for /f "delims=" %%Z in ('dir /b "installer\postgresql-*-binaries.zip" 2^>nul') do if not defined PG_ZIP (
  set "PG_ZIP=%%Z"
  set "PG_ZIP_DIR=installer"
)
if not defined PG_ZIP for /f "delims=" %%Z in ('dir /b "..\installer\postgresql-*-binaries.zip" 2^>nul') do if not defined PG_ZIP (
  set "PG_ZIP=%%Z"
  set "PG_ZIP_DIR=..\installer"
)
if not defined PG_ZIP for /f "delims=" %%Z in ('dir /b "..\presensee_native\installer\postgresql-*-binaries.zip" 2^>nul') do if not defined PG_ZIP (
  set "PG_ZIP=%%Z"
  set "PG_ZIP_DIR=..\presensee_native\installer"
)

if not exist "pgsql\bin\postgres.exe" (
  if exist "..\pgsql\bin\postgres.exe" (
    echo   [INFO] Menyalin folder pgsql dari folder induk...
    xcopy /e /i /y "..\pgsql" "pgsql" >nul 2>&1
  ) else if exist "..\presensee_native\pgsql\bin\postgres.exe" (
    echo   [INFO] Menyalin folder pgsql dari folder presensee_native...
    xcopy /e /i /y "..\presensee_native\pgsql" "pgsql" >nul 2>&1
  ) else if defined PG_ZIP (
    echo   Mengekstrak PostgreSQL Portable dari !PG_ZIP_DIR!\!PG_ZIP!...
    >>"%LOGFILE%" echo   Mengekstrak PostgreSQL Portable dari !PG_ZIP_DIR!\!PG_ZIP!...
    where tar >nul 2>&1
    if not errorlevel 1 (
      tar -xf "!PG_ZIP_DIR!\!PG_ZIP!"
    ) else (
      powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '!PG_ZIP_DIR!\!PG_ZIP!' -DestinationPath '.' -Force"
    )
  )
)

if exist "pgsql\bin\postgres.exe" (
  echo   [OK] PostgreSQL Portable aktif di folder pgsql\ ^(Port Khusus 5433^).
  >>"%LOGFILE%" echo   [OK] PostgreSQL Portable siap di pgsql\ port 5433.
  set "PATH=%~dp0pgsql\bin;!PATH!"
  set "PSQL_EXE=%~dp0pgsql\bin\psql.exe"
  set "PG_PORT=5433"

  rem Salin runtime DLL jika ada di pgAdmin python agar postgres.exe & initdb.exe tidak kekurangan runtime
  if exist "%~dp0pgsql\pgAdmin 4\python\vcruntime140.dll" (
    copy /y "%~dp0pgsql\pgAdmin 4\python\vcruntime*.dll" "%~dp0pgsql\bin\" >nul 2>&1
  )

  set "PG_DATA=%~dp0database\data"
  if "!PG_DATA:~-1!"=="\" set "PG_DATA=!PG_DATA:~0,-1!"

  rem Cek apakah PostgreSQL sudah aktif dan merespons pada port 5433
  "!PSQL_EXE!" -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "SELECT 1" >nul 2>&1
  if not errorlevel 1 (
    echo   [OK] Layanan PostgreSQL sudah aktif dan siap pada port 5433.
    >>"%LOGFILE%" echo   [OK] PostgreSQL sudah aktif pada port 5433.
    goto PG_SIAP
  )

  rem Bersihkan sisa proses zombie atau proses lain yang memegang port 5433
  echo   Memeriksa ketersediaan port 5433 dan proses lama...
  >>"%LOGFILE%" echo   Membersihkan port 5433...
  for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr /r ":5433 "') do (
    if not "%%p"=="0" taskkill /f /pid %%p >nul 2>&1
  )
  tasklist /fi "imagename eq postgres.exe" 2>nul | findstr /i "postgres.exe" >nul
  if errorlevel 1 (
    if exist "!PG_DATA!\postmaster.pid" del /f /q "!PG_DATA!\postmaster.pid" >nul 2>&1
  )
  if exist "%~dp0database\postgres.log" del /f /q "%~dp0database\postgres.log" >nul 2>&1
  timeout /t 1 /nobreak >nul

  if not exist "!PG_DATA!\PG_VERSION" (
    echo   Menginisialisasi kluster database PostgreSQL...
    >>"%LOGFILE%" echo   Menjalankan initdb...
    if exist "!PG_DATA!" rmdir /s /q "!PG_DATA!" >nul 2>&1
    pushd "%~dp0pgsql\bin"
    initdb.exe -D "!PG_DATA!" -U postgres -E UTF8 --locale=C -A trust
    popd
  )

  rem Pastikan port 5433 dan listen_addresses di set di postgresql.conf
  if exist "!PG_DATA!\postgresql.conf" (
    findstr /c:"port = 5433" "!PG_DATA!\postgresql.conf" >nul 2>&1
    if errorlevel 1 (
      echo.>> "!PG_DATA!\postgresql.conf"
      echo port = 5433>> "!PG_DATA!\postgresql.conf"
    )
    findstr /c:"listen_addresses = '*'" "!PG_DATA!\postgresql.conf" >nul 2>&1
    if errorlevel 1 (
      echo.>> "!PG_DATA!\postgresql.conf"
      echo listen_addresses = '*'>> "!PG_DATA!\postgresql.conf"
    )
  )

  rem Pastikan pg_hba.conf mengizinkan koneksi trust lokal
  if exist "!PG_DATA!\pg_hba.conf" (
    findstr /c:"127.0.0.1/32            trust" "!PG_DATA!\pg_hba.conf" >nul 2>&1
    if errorlevel 1 (
      echo host    all             all             127.0.0.1/32            trust> "!PG_DATA!\pg_hba.conf.tmp"
      echo host    all             all             ::1/128                 trust>> "!PG_DATA!\pg_hba.conf.tmp"
      echo host    all             all             all                     trust>> "!PG_DATA!\pg_hba.conf.tmp"
      type "!PG_DATA!\pg_hba.conf" >> "!PG_DATA!\pg_hba.conf.tmp" 2>nul
      move /y "!PG_DATA!\pg_hba.conf.tmp" "!PG_DATA!\pg_hba.conf" >nul 2>&1
    )
  )

  echo   Mendaftarkan dan menyalakan layanan PresenSeePostgres pada port 5433...
  >>"%LOGFILE%" echo   Mendaftarkan PresenSeePostgres port 5433...

  set "NEED_REGISTER=1"
  sc qc PresenSeePostgres 2>nul | findstr /i "pg_ctl.exe" >nul 2>&1
  if not errorlevel 1 set "NEED_REGISTER=0"

  if "!NEED_REGISTER!"=="1" (
    net stop PresenSeePostgres >nul 2>&1
    "%NSSM_EXE%" stop PresenSeePostgres >nul 2>&1
    "%NSSM_EXE%" remove PresenSeePostgres confirm >nul 2>&1
    pushd "%~dp0pgsql\bin"
    pg_ctl.exe unregister -N PresenSeePostgres >nul 2>&1
    pg_ctl.exe register -N PresenSeePostgres -D "!PG_DATA!" -S auto >nul 2>&1
    popd
  )

  net start PresenSeePostgres >nul 2>&1

  rem Cek apakah PostgreSQL sudah merespons koneksi di port 5433
  echo   Menunggu database PostgreSQL siap menerima koneksi...
  set "PG_READY=0"
  for /l %%I in (1,1,20) do (
    if "!PG_READY!"=="0" (
      "!PSQL_EXE!" -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "SELECT 1" >nul 2>&1
      if not errorlevel 1 (
        set "PG_READY=1"
      ) else (
        timeout /t 1 /nobreak >nul
      )
    )
  )

  if "!PG_READY!"=="1" (
    echo   [OK] PostgreSQL aktif dan siap pada port 5433.
    >>"%LOGFILE%" echo   [OK] PostgreSQL aktif pada port 5433.
  ) else (
    color 0C
    echo  [GAGAL] PostgreSQL tidak merespons pada port 5433.
    sc query PresenSeePostgres
    if exist "!PG_DATA!\log" (
      for /f "delims=" %%F in ('dir /b /o-d "!PG_DATA!\log\*.log" 2^>nul') do (
        echo.
        echo  --- PESAN DARI log\%%F ---
        type "!PG_DATA!\log\%%F"
        echo  --------------------------
        goto PG_LOG_DONE
      )
    )
    :PG_LOG_DONE
    if exist "%~dp0database\postgres.log" (
      echo.
      echo  --- PESAN DARI database\postgres.log ---
      type "%~dp0database\postgres.log"
      echo  ----------------------------------------
    )
    >>"%LOGFILE%" echo [GAGAL] PostgreSQL tidak merespons pada port 5433.
    pause
    exit /b 1
  )

  goto PG_SIAP
)

color 0C
echo.
echo  ====================================================================
echo  [GAGAL] PostgreSQL Portable tidak ditemukan di folder ini!
echo  ====================================================================
echo.
echo  PENTING:
echo  Berkas install.bat ini harus berada di dalam folder presensee_native
echo  yang memiliki folder "installer" dan file "postgresql-*-binaries.zip".
echo.
echo  JIKA ANDA MENGEKSTRAK DARI presensee_patch.zip:
echo  Pastikan isi patch ini DI-COPY / DITIMPA LANGSUNG ke dalam folder
echo  presensee_native utama Anda (jangan dijalankan di folder terpisah)!
echo.
>>"%LOGFILE%" echo [GAGAL] pgsql\bin\postgres.exe atau zip portable tidak ditemukan.
pause
exit /b 1

:PG_SIAP
if not defined PSQL_EXE (
  color 0C
  echo  [GAGAL] psql.exe tidak ditemukan setelah PostgreSQL disiapkan.
  echo  Tutup jendela ini, buka lagi, jalankan install.bat sekali lagi.
  >>"%LOGFILE%" echo [GAGAL] psql.exe tidak ditemukan.
  pause
  exit /b 1
)
>>"%LOGFILE%" echo   psql.exe: %PSQL_EXE% ^(port !PG_PORT!^)

REM =====================================================================
REM [4/6] Database
REM =====================================================================
echo [4/6] Menyiapkan database...
>>"%LOGFILE%" echo [4/6] Menyiapkan database...
set "PGPASSWORD=!PG_PASSWORD!"

set "DB_SUDAH_ADA=0"
"%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='absen'" > "%TEMP%\presensee-db-check.txt" 2>nul
findstr /c:"1" "%TEMP%\presensee-db-check.txt" >nul 2>&1
if not errorlevel 1 set "DB_SUDAH_ADA=1"

if "%DB_SUDAH_ADA%"=="1" (
  echo   [OK] Database 'absen' sudah ada, skema tidak dijalankan ulang.
  >>"%LOGFILE%" echo   [OK] Database 'absen' sudah ada, dilewati.
) else (
  "%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d postgres -c "CREATE DATABASE absen" >nul
  if errorlevel 1 (
    color 0C
    echo  [GAGAL] Tidak bisa membuat database. Periksa PostgreSQL sudah aktif pada port !PG_PORT!.
    >>"%LOGFILE%" echo [GAGAL] CREATE DATABASE gagal.
    pause
    exit /b 1
  )

  "%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\schema.sql"
  if errorlevel 1 (
    color 0C
    echo  [GAGAL] Gagal memasang skema database.
    >>"%LOGFILE%" echo [GAGAL] schema.sql gagal dijalankan.
    pause
    exit /b 1
  )

  echo.
  echo   ------------------------------------------------------------------
  echo   Mau masukkan DATA CONTOH ^(beberapa kelas dan siswa contoh^)?
  echo   Jawab Y untuk coba-coba, jawab N untuk mulai dari data kosong.
  echo   ------------------------------------------------------------------
  >>"%LOGFILE%" echo   [TANYA] Masukkan data contoh? (Y/N)
  set /p ISI_CONTOH="  Masukkan data contoh? (Y/N): "
  >>"%LOGFILE%" echo   [JAWAB] !ISI_CONTOH!
  if /I "!ISI_CONTOH!"=="Y" (
    "%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\seed.sql"
    "%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\contoh-multi-kelas.sql"
    echo   [OK] Data contoh dimasukkan.
    >>"%LOGFILE%" echo   [OK] Data contoh dimasukkan.
  ) else (
    "%PSQL_EXE%" -h 127.0.0.1 -p !PG_PORT! -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\seed-esensial.sql"
    echo   [OK] Cuma data esensial yang dimasukkan.
    >>"%LOGFILE%" echo   [OK] Cuma data esensial yang dimasukkan.
  )
  echo   [OK] Database siap.
  >>"%LOGFILE%" echo   [OK] Database siap.
)
echo.

REM Konfigurasi lengkap ditulis ke config.env (Port Khusus: BE 5050, FE 3050, DB !PG_PORT!)
> "config.env" (
  echo NODE_ENV=production
  echo PORT=5050
  echo TZ=Asia/Jakarta
  echo DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@localhost:!PG_PORT!/absen
  echo JWT_SECRET=super-secret-jwt-key-replace-in-production-min-32-chars
  echo SCANNER_API_KEY=presensee-scanner-api-key-2026
  echo WA_PROVIDER=baileys
  echo WA_SESSION_PATH=./storage/wa-session
  echo WA_ALLOWLIST=*
  echo STORAGE_PATH=./storage
  echo CORS_ORIGINS=http://localhost:3050,http://127.0.0.1:3050
)
>>"%LOGFILE%" echo   config.env ditulis ulang.

REM =====================================================================
REM [5/6] Pasang node_modules produksi dan daftarkan service
REM =====================================================================
echo [5/6] Memasang dependensi dan mendaftarkan layanan Windows...
echo   ^(Butuh internet - mengunduh paket dari npm, beberapa menit^)
>>"%LOGFILE%" echo [5/6] Memasang dependensi dan mendaftarkan layanan Windows...

REM PENTING: "call" wajib di sini. npm.cmd di Windows adalah berkas .cmd
REM (bukan .exe) — memanggilnya TANPA "call" dari dalam skrip .bat lain
REM menyerahkan kendali ke situ SELAMANYA: begitu npm.cmd selesai, seluruh
REM proses cmd.exe ini ikut tertutup, install.bat tidak pernah lanjut ke
REM baris sesudahnya. Inilah sebab jendela tertutup sendiri tanpa pesan
REM tepat setelah tulisan langkah [5/6] muncul — ditemukan dari client
REM sungguhan (BE-113).
pushd "shared"
if not exist "node_modules\zod" (
  if exist "..\apps\api\node_modules\zod" (
    echo   Menyalin dependensi zod ke shared...
    xcopy /e /i /y "..\apps\api\node_modules\zod" "node_modules\zod\" >nul 2>&1
  )
)
popd

pushd "apps\api"
REM npm install di Windows kadang gagal EPERM sesaat (rmdir/symlink) kalau
REM antivirus real-time sedang memindai berkas yang baru saja ditulis npm
if not exist "node_modules" (
  set "NPM_OK=0"
  for /l %%T in (1,1,3) do (
    if "!NPM_OK!"=="0" (
      call "%NPM_CMD%" install --omit=dev --no-audit --no-fund
      if not errorlevel 1 (
        set "NPM_OK=1"
      ) else (
        echo   [INFO] npm install gagal ^(percobaan %%T/3^) - kemungkinan
        echo   antivirus mengunci berkas sesaat. Membersihkan dan mencoba lagi...
        >>"%LOGFILE%" echo   [INFO] npm install apps\api gagal, percobaan %%T/3 - mencoba lagi
        rd /s /q "node_modules" >nul 2>&1
        timeout /t 5 /nobreak >nul
      )
    )
  )
  if "!NPM_OK!"=="0" (
    echo   [PERINGATAN] npm install apps\api tetap gagal setelah 3 percobaan.
    echo   Kemungkinan besar antivirus mengunci folder ini - coba kecualikan
    echo   folder "%~dp0" dari pemindaian real-time Windows Defender/antivirus
    echo   yang dipakai, lalu jalankan install.bat lagi.
    >>"%LOGFILE%" echo   [PERINGATAN] npm install apps\api gagal setelah 3 percobaan - kemungkinan antivirus
  )
)
copy /y "..\..\config.env" ".env" >nul

rem Pastikan zod juga disalin ke shared jika belum ada
if not exist "..\..\shared\node_modules\zod" (
  if exist "node_modules\zod" (
    xcopy /e /i /y "node_modules\zod" "..\..\shared\node_modules\zod\" >nul 2>&1
  )
)
popd

rem Siapkan file konfigurasi environment untuk Web
> "apps\web\.env" (
  echo PORT=3050
  echo HOSTNAME=0.0.0.0
)
if exist "apps\web\apps\web" (
  > "apps\web\apps\web\.env" (
    echo PORT=3050
    echo HOSTNAME=0.0.0.0
  )
)

echo   Mendaftarkan layanan presensee-api...
>>"%LOGFILE%" echo   Mendaftarkan layanan PresenSeeApi...
"%NSSM_EXE%" stop PresenSeeApi >nul 2>&1
"%NSSM_EXE%" remove PresenSeeApi confirm >nul 2>&1
"%NSSM_EXE%" install PresenSeeApi "%NODE_EXE%" "--env-file=.env dist\server.js"
"%NSSM_EXE%" set PresenSeeApi AppDirectory "%~dp0apps\api"
"%NSSM_EXE%" set PresenSeeApi DisplayName "PresenSee API"
"%NSSM_EXE%" set PresenSeeApi Description "Server API PresenSee (presensi, WhatsApp, laporan)"
"%NSSM_EXE%" set PresenSeeApi Start SERVICE_AUTO_START
"%NSSM_EXE%" set PresenSeeApi AppExit Default Restart
"%NSSM_EXE%" set PresenSeeApi AppRestartDelay 5000
if not exist "apps\api\log" mkdir "apps\api\log"
"%NSSM_EXE%" set PresenSeeApi AppStdout "%~dp0apps\api\log\api.log"
"%NSSM_EXE%" set PresenSeeApi AppStderr "%~dp0apps\api\log\api.log"
"%NSSM_EXE%" set PresenSeeApi AppRotateFiles 1
"%NSSM_EXE%" set PresenSeeApi AppRotateBytes 5242880

echo   Mendaftarkan layanan presensee-web...
>>"%LOGFILE%" echo   Mendaftarkan layanan PresenSeeWeb...
"%NSSM_EXE%" stop PresenSeeWeb >nul 2>&1
"%NSSM_EXE%" remove PresenSeeWeb confirm >nul 2>&1
"%NSSM_EXE%" install PresenSeeWeb "%NODE_EXE%" "apps\web\server.js"
"%NSSM_EXE%" set PresenSeeWeb AppDirectory "%~dp0apps\web"
"%NSSM_EXE%" set PresenSeeWeb DisplayName "PresenSee Web"
"%NSSM_EXE%" set PresenSeeWeb Description "Aplikasi web PresenSee"
"%NSSM_EXE%" set PresenSeeWeb AppEnvironmentExtra "PORT=3050"
"%NSSM_EXE%" set PresenSeeWeb Start SERVICE_AUTO_START
"%NSSM_EXE%" set PresenSeeWeb AppExit Default Restart
"%NSSM_EXE%" set PresenSeeWeb AppRestartDelay 5000
if not exist "apps\web\log" mkdir "apps\web\log"
"%NSSM_EXE%" set PresenSeeWeb AppStdout "%~dp0apps\web\log\web.log"
"%NSSM_EXE%" set PresenSeeWeb AppStderr "%~dp0apps\web\log\web.log"
"%NSSM_EXE%" set PresenSeeWeb AppRotateFiles 1
"%NSSM_EXE%" set PresenSeeWeb AppRotateBytes 5242880

echo   Menjalankan layanan...
"%NSSM_EXE%" start PresenSeeApi
"%NSSM_EXE%" start PresenSeeWeb
REM Beri jeda supaya proses yang crash-loop sempat ketahuan sebelum dicek
timeout /t 3 /nobreak >nul

REM Konfirmasi sungguhan, bukan cuma anggap berhasil karena tidak ada error.
"%NSSM_EXE%" status PresenSeeApi > "%TEMP%\presensee-status-api.txt" 2>nul
"%NSSM_EXE%" status PresenSeeWeb > "%TEMP%\presensee-status-web.txt" 2>nul
>>"%LOGFILE%" type "%TEMP%\presensee-status-api.txt"
>>"%LOGFILE%" type "%TEMP%\presensee-status-web.txt"

set "STATUS_OK=1"
findstr /c:"SERVICE_RUNNING" "%TEMP%\presensee-status-api.txt" >nul || set "STATUS_OK=0"
findstr /c:"SERVICE_RUNNING" "%TEMP%\presensee-status-web.txt" >nul || set "STATUS_OK=0"

if "%STATUS_OK%"=="1" (
  echo   [OK] Layanan PresenSeeApi dan PresenSeeWeb terpasang dan BERJALAN.
  >>"%LOGFILE%" echo   [OK] Layanan PresenSeeApi dan PresenSeeWeb terpasang dan BERJALAN.
) else (
  echo   [PERINGATAN] Layanan terpasang tapi belum tentu berjalan normal.
  echo   Cek: "%NSSM_EXE%" status PresenSeeApi   dan   "%NSSM_EXE%" status PresenSeeWeb
  echo   Log error ada di: apps\api\log\api.log   dan   apps\web\log\web.log
  >>"%LOGFILE%" echo   [PERINGATAN] Layanan terpasang tapi belum tentu berjalan normal - cek apps\api\log\api.log dan apps\web\log\web.log
)
echo.

REM Mendaftarkan tugas Auto-Backup database setiap pukul 09:00 pagi (dengan rotasi 7 hari)
if exist "%~dp0BACKUP-DATABASE.bat" (
  echo   Mendaftarkan jadwal Auto-Backup database harian ^(setiap pukul 09:00^)...
  >>"%LOGFILE%" echo   Mendaftarkan jadwal Task Scheduler PresenSeeAutoBackup...
  schtasks /create /tn "PresenSeeAutoBackup" /tr "\"%~dp0BACKUP-DATABASE.bat\"" /sc daily /st 09:00 /ru "SYSTEM" /f >nul 2>&1
  if not errorlevel 1 (
    echo   [OK] Jadwal Auto-Backup pukul 09:00 terdaftar.
    >>"%LOGFILE%" echo   [OK] Task Scheduler PresenSeeAutoBackup berhasil dibuat.
  )
)

REM =====================================================================
REM [6/6] Scanner Agent (Pembaca scanner USB / Barcode)
REM =====================================================================
echo.
echo [6/6] Menyiapkan Scanner Agent...
>>"%LOGFILE%" echo [6/6] Menyiapkan Scanner Agent...

set "AGENT_DIR=%~dp0apps\scanner-agent"
if exist "%AGENT_DIR%\RakitAplikasi.bat" (
  echo   [INFO] Merakit Scanner Agent C# All-in-One...
  >>"%LOGFILE%" echo   Merakit AgenScanner.exe...
  call "%AGENT_DIR%\RakitAplikasi.bat" >nul 2>&1
  if exist "%AGENT_DIR%\AgenScanner.exe" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PresenSeeScanner" /t REG_SZ /d "\"%AGENT_DIR%\AgenScanner.exe\"" /f >nul 2>&1
    taskkill /f /im AgenScanner.exe >nul 2>&1
    start "" "%AGENT_DIR%\AgenScanner.exe"
    echo   [OK] Scanner Agent All-in-One aktif di background!
    >>"%LOGFILE%" echo   [OK] Scanner Agent All-in-One aktif.
  ) else (
    echo   [INFO] Kompilasi Scanner Agent dilewati/gagal.
    >>"%LOGFILE%" echo   [INFO] Kompilasi Scanner Agent gagal.
  )
)
echo.

echo ====================================================================
echo   [SELESAI] PresenSee terpasang.
echo   Buka http://localhost:3050 di browser ^(atau jalankan jalankan.bat^).
echo   Login: superadmin / siklon123 ^(wajib ganti password saat masuk^).
echo   Catatan lengkap proses ini ada di install-log.txt.
echo ====================================================================
>>"%LOGFILE%" echo [SELESAI] install.bat selesai dijalankan.
echo.
pause
