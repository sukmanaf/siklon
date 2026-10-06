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
set "PG_ADA=0"
sc query postgresql-x64-16 >nul 2>&1
if not errorlevel 1 set "PG_ADA=1"
where psql >nul 2>&1
if not errorlevel 1 set "PG_ADA=1"

REM Password database TETAP (bukan acak) — sengaja, supaya predictable
REM tiap kali install ulang (mis. saat uji coba, PostgreSQL di-uninstall
REM lalu dipasang lagi lewat skrip ini). Aman ditulis langsung: semua
REM karakternya alfanumerik biasa, tidak ada yang bisa merusak baris
REM perintah instalasi (pelajaran sesi ini soal tanda kutip/backslash yang
REM salah tempat — password acak sebelumnya juga demi ini, tapi string
REM tetap yang alfanumerik murni ini sama amannya).
set "PG_PASSWORD=p0stgr3sql"
set "PGPASSWORD=%PG_PASSWORD%"

if "%PG_ADA%"=="1" (
  echo   [OK] PostgreSQL sudah terpasang, dilewati.
  >>"%LOGFILE%" echo   [OK] PostgreSQL sudah terpasang, dilewati.

  REM Coba dulu password baku di atas — kalau PostgreSQL ini yang dipasang
  REM skrip ini sebelumnya, otomatis cocok. Cuma tanya manual kalau
  REM ternyata TIDAK cocok (berarti instalasi PostgreSQL lain yang tidak
  REM berhubungan dengan PresenSee).
  psql -h localhost -U postgres -c "SELECT 1" >nul 2>&1
  if errorlevel 1 (
    echo   [PENTING] Password baku tidak cocok - kemungkinan ini instalasi
    echo   PostgreSQL LAIN yang sudah ada sebelumnya, bukan dari skrip ini.
    echo   Masukkan password akun 'postgres' yang benar.
    >>"%LOGFILE%" echo   [INFO] Password baku tidak cocok, minta manual.
    set /p PG_PASSWORD="  Password akun database 'postgres': "
    set "PGPASSWORD=!PG_PASSWORD!"
  ) else (
    echo   [OK] Password baku cocok, dipakai langsung.
    >>"%LOGFILE%" echo   [OK] Password baku cocok.
  )
) else (
  if not exist "installer\postgresql-16.15-4-windows-x64.exe" (
    color 0C
    echo.
    echo  [GAGAL] PostgreSQL belum terpasang, dan
    echo  installer\postgresql-16.15-4-windows-x64.exe tidak ditemukan.
    echo  Pasang PostgreSQL 16 manual, atau lengkapi berkas installer-nya.
    echo.
    >>"%LOGFILE%" echo [GAGAL] PostgreSQL belum ada dan installer tidak ditemukan.
    pause
    exit /b 1
  )

  echo   Memasang PostgreSQL ^(beberapa menit, mohon tunggu^)...
  >>"%LOGFILE%" echo   Memasang PostgreSQL...
  "installer\postgresql-16.15-4-windows-x64.exe" --mode unattended --unattendedmodeui minimal --superpassword "%PG_PASSWORD%" --serverport 5432 --servicename postgresql-x64-16 --disable-components stackbuilder
  if errorlevel 1 (
    color 0C
    echo.
    echo  [GAGAL] Installer PostgreSQL keluar dengan kode error.
    echo  Coba pasang manual: installer\postgresql-16.15-4-windows-x64.exe
    echo.
    >>"%LOGFILE%" echo [GAGAL] Installer PostgreSQL keluar dengan error.
    pause
    exit /b 1
  )

  set "PATH=%PATH%;%ProgramFiles%\PostgreSQL\16\bin"
  echo   [OK] PostgreSQL terpasang.
  >>"%LOGFILE%" echo   [OK] PostgreSQL terpasang.
)
echo.

REM psql.exe path — sama seperti node.exe, dicari sungguhan.
set "PSQL_EXE="
for /f "delims=" %%P in ('where psql 2^>nul') do if not defined PSQL_EXE set "PSQL_EXE=%%P"
if not defined PSQL_EXE if exist "%ProgramFiles%\PostgreSQL\16\bin\psql.exe" set "PSQL_EXE=%ProgramFiles%\PostgreSQL\16\bin\psql.exe"
if not defined PSQL_EXE (
  color 0C
  echo  [GAGAL] psql.exe tidak ditemukan setelah PostgreSQL terpasang.
  echo  Tutup jendela ini, buka lagi, jalankan install.bat sekali lagi.
  >>"%LOGFILE%" echo [GAGAL] psql.exe tidak ditemukan.
  pause
  exit /b 1
)
>>"%LOGFILE%" echo   psql.exe: %PSQL_EXE%

REM =====================================================================
REM [4/6] Database
REM =====================================================================
echo [4/6] Menyiapkan database...
>>"%LOGFILE%" echo [4/6] Menyiapkan database...
set "PGPASSWORD=!PG_PASSWORD!"

REM Ditandai pakai variabel + if/else, BUKAN goto yang melompat keluar
REM blok tanda kurung — pelajaran yang sama seperti bagian NSSM di atas.
set "DB_SUDAH_ADA=0"
"%PSQL_EXE%" -h localhost -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='absen'" > "%TEMP%\presensee-db-check.txt" 2>nul
findstr /c:"1" "%TEMP%\presensee-db-check.txt" >nul 2>&1
if not errorlevel 1 set "DB_SUDAH_ADA=1"

if "%DB_SUDAH_ADA%"=="1" (
  echo   [OK] Database 'absen' sudah ada, skema tidak dijalankan ulang
  echo   ^(supaya data yang sudah ada tidak tersentuh^).
  >>"%LOGFILE%" echo   [OK] Database 'absen' sudah ada, dilewati.
) else (
  "%PSQL_EXE%" -h localhost -U postgres -c "CREATE DATABASE absen" >nul
  if errorlevel 1 (
    color 0C
    echo  [GAGAL] Tidak bisa membuat database. Periksa PostgreSQL sudah aktif.
    echo  ^(Kalau baru saja masukkan password manual, kemungkinan passwordnya
    echo  salah - jalankan install.bat lagi dan periksa lagi^).
    >>"%LOGFILE%" echo [GAGAL] CREATE DATABASE gagal - kemungkinan password salah.
    pause
    exit /b 1
  )

  "%PSQL_EXE%" -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\schema.sql"
  if errorlevel 1 (
    color 0C
    echo  [GAGAL] Gagal memasang skema database.
    >>"%LOGFILE%" echo [GAGAL] schema.sql gagal dijalankan.
    pause
    exit /b 1
  )

  echo.
  echo   ------------------------------------------------------------------
  echo   Mau masukkan DATA CONTOH ^(beberapa kelas dan siswa contoh, berguna
  echo   untuk uji coba^)? Jawab N kalau ini pemasangan SUNGGUHAN dan mau
  echo   mulai dari kosong ^(tambah kelas/siswa asli sendiri nanti^).
  echo   ------------------------------------------------------------------
  >>"%LOGFILE%" echo   [TANYA] Masukkan data contoh? (Y/N)
  set /p ISI_CONTOH="  Masukkan data contoh? (Y/N): "
  >>"%LOGFILE%" echo   [JAWAB] !ISI_CONTOH!
  if /I "!ISI_CONTOH!"=="Y" (
    "%PSQL_EXE%" -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\seed.sql"
    "%PSQL_EXE%" -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\contoh-multi-kelas.sql"
    echo   [OK] Data contoh dimasukkan.
    >>"%LOGFILE%" echo   [OK] Data contoh dimasukkan.
  ) else (
    "%PSQL_EXE%" -h localhost -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\seed-esensial.sql"
    echo   [OK] Cuma akun login ^& setelan bawaan yang dimasukkan.
    >>"%LOGFILE%" echo   [OK] Cuma data esensial yang dimasukkan.
  )
  echo   [OK] Database siap.
  >>"%LOGFILE%" echo   [OK] Database siap.
)
echo.

REM Password disimpan untuk dipakai konfigurasi service di bawah, dan
REM ditulis ke config.env supaya jalankan.bat/install ulang bisa membacanya
REM tanpa perlu password diketik ulang tiap kali.
> "config.env" (
  echo DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@localhost:5432/absen
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
if not exist "node_modules" call "%NPM_CMD%" install --omit=dev --no-audit --no-fund
popd

pushd "apps\api"
REM npm install di Windows kadang gagal EPERM sesaat (rmdir/symlink) kalau
REM antivirus real-time sedang memindai berkas yang baru saja ditulis npm —
REM npm sendiri mencurigai ini di pesan errornya ("possibly in use by a text
REM editor or antivirus"). Ini TERBUKTI terjadi dua kali di client sungguhan
REM meski folder-nya sudah bersih diekstrak ulang, jadi bukan cuma sisa
REM percobaan lama (BE-114) — melainkan gangguan sesaat yang hilang sendiri
REM kalau dicoba ulang. Diberi 3x percobaan, folder node_modules dihapus
REM total di antara percobaan supaya tiap percobaan mulai bersih (BE-116).
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
popd

REM apps\web TIDAK butuh npm install — hasil build "standalone" Next.js
REM sudah membawa node_modules-nya sendiri (dibundel otomatis saat build).

echo   Mendaftarkan layanan presensee-api...
>>"%LOGFILE%" echo   Mendaftarkan layanan PresenSeeApi...
"%NSSM_EXE%" stop PresenSeeApi >nul 2>&1
"%NSSM_EXE%" remove PresenSeeApi confirm >nul 2>&1
"%NSSM_EXE%" install PresenSeeApi "%NODE_EXE%" "--env-file=.env dist\server.js"
"%NSSM_EXE%" set PresenSeeApi AppDirectory "%~dp0apps\api."
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
"%NSSM_EXE%" set PresenSeeWeb AppDirectory "%~dp0apps\web."
"%NSSM_EXE%" set PresenSeeWeb DisplayName "PresenSee Web"
"%NSSM_EXE%" set PresenSeeWeb Description "Aplikasi web PresenSee"
"%NSSM_EXE%" set PresenSeeWeb AppEnvironmentExtra "PORT=3000" "HOSTNAME=0.0.0.0"
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
REM Beri jeda supaya proses yang crash-loop sempat ketahuan sebelum dicek —
REM "start" nssm langsung kembali begitu proses dimulai, tidak menunggu
REM apakah prosesnya benar-benar tetap hidup (BE-114).
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

REM =====================================================================
REM [6/6] Scanner Agent (opsional, PC ini juga dipakai baca scanner USB)
REM =====================================================================
echo [6/6] Scanner Agent ^(pembaca scanner USB gerbang^)
echo   ------------------------------------------------------------------
echo   Apakah PC ini JUGA dipakai untuk membaca scanner USB gerbang?
echo   Jawab N kalau scanner-nya ada di PC lain, atau belum ada scanner.
echo   ------------------------------------------------------------------
>>"%LOGFILE%" echo [6/6] [TANYA] Pasang Scanner Agent di PC ini? (Y/N)
set /p PASANG_AGENT="  Pasang Scanner Agent di PC ini? (Y/N): "
>>"%LOGFILE%" echo   [JAWAB] %PASANG_AGENT%
if /I "!PASANG_AGENT!"=="Y" (
  if exist "apps\scanner-agent\config.json" (
    echo   config.json sudah ada, dilewati.
  ) else if exist "apps\scanner-agent\config.example.json" (
    copy "apps\scanner-agent\config.example.json" "apps\scanner-agent\config.json" >nul
    echo   config.json dibuat dari contoh - apiUrl sudah benar untuk PC ini
    echo   ^(http://localhost:5000^), apiKey ikut ter-copy juga.
  )
  echo   Menjalankan install-service.bat Scanner Agent...
  >>"%LOGFILE%" echo   Menjalankan install-service.bat Scanner Agent...
  call "apps\scanner-agent\install-service.bat"
) else (
  echo   Dilewati.
  >>"%LOGFILE%" echo   Scanner Agent dilewati.
)
echo.

echo ====================================================================
echo   [SELESAI] PresenSee terpasang.
echo   Buka http://localhost:3000 di browser ^(atau jalankan jalankan.bat^).
echo   Login: superadmin / siklon123 ^(wajib ganti password saat masuk^).
echo   Catatan lengkap proses ini ada di install-log.txt.
echo ====================================================================
>>"%LOGFILE%" echo [SELESAI] install.bat selesai dijalankan.
echo.
pause
