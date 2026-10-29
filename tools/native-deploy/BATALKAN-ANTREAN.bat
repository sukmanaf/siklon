@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title PresenSee - Batalkan Antrean Pesan WhatsApp
color 0E

echo.
echo ====================================================================
echo   PRESENSEE - MEMBATALKAN ANTREAN PESAN WHATSAPP
echo ====================================================================
echo.
echo  Skrip ini akan membatalkan SEMUA pesan yang saat ini masih
echo  berstatus 'Dalam Antrean' (PENDING / QUEUED).
echo.
echo  Pesan yang dibatalkan TIDAK AKAN DIKIRIM saat WhatsApp terhubung
echo  kembali, sehingga tidak akan membebani nomor WA atau membingungkan
echo  wali murid.
echo ====================================================================
echo.

set /p KONFIRM="Yakin ingin membatalkan semua antrean pesan? (Y/T): "
if /i not "%KONFIRM%"=="Y" (
  echo Dibatalkan oleh pengguna.
  pause
  exit /b 0
)

echo.
echo Menghubungi database...

set "PSQL_EXE="
if exist "%~dp0pgsql\bin\psql.exe" set "PSQL_EXE=%~dp0pgsql\bin\psql.exe"
if not defined PSQL_EXE for /f "delims=" %%S in ('where psql 2^>nul') do if not defined PSQL_EXE set "PSQL_EXE=%%S"

set "PGPASSWORD=p0stgr3sql"

if not defined PSQL_EXE (
  color 0C
  echo [GAGAL] psql.exe tidak ditemukan.
  pause
  exit /b 1
)

set "BERHASIL=0"
"%PSQL_EXE%" -h 127.0.0.1 -p 5433 -U postgres -d absen -c "UPDATE wa_messages SET status = 'CANCELLED', last_error = 'Dibatalkan oleh admin' WHERE status = 'QUEUED';" >nul 2>&1
if not errorlevel 1 (
  set "BERHASIL=1"
) else (
  "%PSQL_EXE%" -h 127.0.0.1 -p 5432 -U postgres -d absen -c "UPDATE wa_messages SET status = 'CANCELLED', last_error = 'Dibatalkan oleh admin' WHERE status = 'QUEUED';" >nul 2>&1
  if not errorlevel 1 set "BERHASIL=1"
)

if "%BERHASIL%"=="1" (
  color 0A
  echo.
  echo ====================================================================
  echo   [SUKSES] Seluruh pesan antrean (pending) BERHASIL DIBATALKAN!
  echo   Pesan tidak akan dikirim saat WhatsApp disambungkan kembali.
  echo ====================================================================
) else (
  color 0C
  echo.
  echo [GAGAL] Tidak dapat terhubung ke database PostgreSQL (port 5433/5432).
  echo Pastikan service database sedang berjalan.
)

echo.
pause

