@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title PresenSee - Patch Update
color 0B

echo.
echo ====================================================================
echo   PRESENSEE - PEMBARUAN SISTEM (PATCH UPDATE)
echo ====================================================================
echo.

REM ---------------------------------------------------------------------
REM 1. Periksa Hak Akses Administrator
REM ---------------------------------------------------------------------
net session >nul 2>&1
if errorlevel 1 (
  color 0C
  echo [PERINGATAN] Skrip update.bat memerlukan hak Administrator!
  echo.
  echo Silakan:
  echo   1. Tutup jendela ini.
  echo   2. Klik kanan pada berkas "update.bat".
  echo   3. Pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

REM ---------------------------------------------------------------------
REM 2. Periksa Lokasi Folder
REM ---------------------------------------------------------------------
if not exist "apps\api\dist" (
  if exist "..\presensee_native\apps\api" (
    echo [INFO] Berkas update terdeteksi di luar folder presensee_native.
    echo Menyalin pembaruan ke ..\presensee_native...
    xcopy /e /i /y "apps" "..\presensee_native\apps\" >nul 2>&1
    xcopy /e /i /y "database" "..\presensee_native\database\" >nul 2>&1
    xcopy /e /i /y "shared" "..\presensee_native\shared\" >nul 2>&1
    copy /y "update.bat" "..\presensee_native\update.bat" >nul 2>&1
    cd /d "..\presensee_native"
    echo [OK] Pindah ke folder utama presensee_native.
  ) else (
    color 0C
    echo [GAGAL] Folder apps\api\dist tidak ditemukan!
    echo Pastikan isi file patch diekstrak ke dalam folder utama presensee_native.
    echo.
    pause
    exit /b 1
  )
)

REM ---------------------------------------------------------------------
REM 3. Cari NSSM
REM ---------------------------------------------------------------------
set "NSSM_EXE="
for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"
if not defined NSSM_EXE if exist "installer\nssm.exe" set "NSSM_EXE=%~dp0installer\nssm.exe"
if not defined NSSM_EXE if exist "..\installer\nssm.exe" set "NSSM_EXE=%~dp0..\installer\nssm.exe"

REM ---------------------------------------------------------------------
REM 4. Hentikan Layanan Sementara
REM ---------------------------------------------------------------------
echo [1/4] Menghentikan layanan PresenSee sementara...
if defined NSSM_EXE (
  "%NSSM_EXE%" stop PresenSeeWeb >nul 2>&1
  "%NSSM_EXE%" stop PresenSeeApi >nul 2>&1
) else (
  net stop PresenSeeWeb >nul 2>&1
  net stop PresenSeeApi >nul 2>&1
)

taskkill /f /im AgenScannerRaw.exe >nul 2>&1
taskkill /f /im AgenScannerCom.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo   [OK] Layanan dihentikan.

REM ---------------------------------------------------------------------
REM 5. Perbarui Pengaturan Database (Spintax & Anti-Spam)
REM ---------------------------------------------------------------------
echo.
echo [2/4] Memperbarui pengaturan database WhatsApp (Anti-Spam Spintax)...

rem Pastikan PostgreSQL berjalan
sc query PresenSeePostgres >nul 2>&1
if not errorlevel 1 (
  sc query PresenSeePostgres | findstr /c:"RUNNING" >nul 2>&1
  if errorlevel 1 net start PresenSeePostgres >nul 2>&1
) else (
  sc query postgresql-x64-16 >nul 2>&1
  if not errorlevel 1 (
    sc query postgresql-x64-16 | findstr /c:"RUNNING" >nul 2>&1
    if errorlevel 1 net start postgresql-x64-16 >nul 2>&1
  )
)

set "PSQL_EXE="
if exist "%~dp0pgsql\bin\psql.exe" set "PSQL_EXE=%~dp0pgsql\bin\psql.exe"
if not defined PSQL_EXE for /f "delims=" %%S in ('where psql 2^>nul') do if not defined PSQL_EXE set "PSQL_EXE=%%S"

set "PGPASSWORD=p0stgr3sql"

if defined PSQL_EXE if exist "database\update-spintax.sql" (
  "%PSQL_EXE%" -h 127.0.0.1 -p 5433 -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\update-spintax.sql" >nul 2>&1
  if not errorlevel 1 (
    echo   [OK] Template WhatsApp Spintax berhasil diaplikasikan ke database (port 5433).
  ) else (
    "%PSQL_EXE%" -h 127.0.0.1 -p 5432 -U postgres -d absen -v ON_ERROR_STOP=1 -f "database\update-spintax.sql" >nul 2>&1
    if not errorlevel 1 (
      echo   [OK] Template WhatsApp Spintax berhasil diaplikasikan ke database (port 5432).
    ) else (
      echo   [INFO] Eksekusi update-spintax.sql dilewati (akan menggunakan template default kode).
    )
  )
) else (
  echo   [INFO] psql.exe tidak ditemukan, database update dilewati.
)

REM ---------------------------------------------------------------------
REM 6. Rakit Ulang Scanner Agent jika diperlukan
REM ---------------------------------------------------------------------
if exist "apps\scanner-agent\RakitAplikasi.bat" (
  call "apps\scanner-agent\RakitAplikasi.bat" >nul 2>&1
)

REM ---------------------------------------------------------------------
REM 7. Jalankan Kembali Layanan
REM ---------------------------------------------------------------------
echo.
echo [3/4] Menjalankan kembali layanan PresenSee...
if defined NSSM_EXE (
  "%NSSM_EXE%" start PresenSeeApi >nul 2>&1
  "%NSSM_EXE%" start PresenSeeWeb >nul 2>&1
) else (
  net start PresenSeeApi >nul 2>&1
  net start PresenSeeWeb >nul 2>&1
)

if exist "apps\scanner-agent\AgenScanner.exe" (
  start "" "apps\scanner-agent\AgenScanner.exe"
)

timeout /t 3 /nobreak >nul

REM ---------------------------------------------------------------------
REM 8. Periksa Status Layanan
REM ---------------------------------------------------------------------
echo.
echo [4/4] Memeriksa status sistem...
if defined NSSM_EXE (
  "%NSSM_EXE%" status PresenSeeApi 2>nul | findstr /c:"SERVICE_RUNNING" >nul
  if not errorlevel 1 (
    echo   [OK] Layanan PresenSee API : BERJALAN (PORT 5050)
  ) else (
    echo   [PERINGATAN] Layanan PresenSee API belum aktif, cek log di apps\api\log\api.log
  )

  "%NSSM_EXE%" status PresenSeeWeb 2>nul | findstr /c:"SERVICE_RUNNING" >nul
  if not errorlevel 1 (
    echo   [OK] Layanan PresenSee Web : BERJALAN (PORT 3050)
  ) else (
    echo   [PERINGATAN] Layanan PresenSee Web belum aktif, cek log di apps\web\log\web.log
  )
)

echo.
echo ====================================================================
echo   ✨ [SUKSES] PresenSee Berhasil Diperbarui ke Versi Terbaru!
echo ====================================================================
echo   Perubahan yang aktif:
echo   1. Engine WhatsApp Anti-Spam:
echo      - Simulasi jeda mengetik alami (1.5 - 3.5 detik)
echo      - Identitas browser Windows Chrome asli
echo      - Penghapusan probe onWhatsApp yang memicu blokir Meta
echo      - Otomatis Ref Hash unik & stempel waktu di tiap pesan
echo   2. Spintax Otomatis:
echo      - Variasi salam & kalimat otomatis per siswa {pilihan1|pilihan2}
echo   3. Web UI:
echo      - Editor template WhatsApp dilengkapi panduan Spintax
echo ====================================================================
echo.
echo   Buka aplikasi: http://localhost:3050
echo.
pause

