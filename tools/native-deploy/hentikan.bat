@echo off
cd /d "%~dp0"
title PresenSee - Hentikan
color 0A

echo.
echo ====================================================================
echo   PRESENSEE - MENGHENTIKAN LAYANAN
echo ====================================================================
echo.

set "NSSM_EXE="
for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"
if not defined NSSM_EXE (
  color 0C
  echo  [GAGAL] nssm.exe tidak ditemukan.
  echo.
  pause
  exit /b 1
)

echo  Menghentikan layanan Web...
"%NSSM_EXE%" stop PresenSeeWeb >nul 2>&1

echo  Menghentikan layanan API...
"%NSSM_EXE%" stop PresenSeeApi >nul 2>&1

echo  Menghentikan Scanner Agent C# All-in-One...
taskkill /f /im AgenScanner.exe >nul 2>&1
taskkill /f /im AgenScannerRaw.exe >nul 2>&1
taskkill /f /im AgenScannerCom.exe >nul 2>&1

sc query PresenSeePostgres >nul 2>&1
if not errorlevel 1 (
  echo  Menghentikan layanan PostgreSQL Portable...
  net stop PresenSeePostgres >nul 2>&1
)
if exist "%~dp0pgsql\bin\pg_ctl.exe" (
  pushd "%~dp0pgsql\bin"
  pg_ctl.exe stop -D "%~dp0database\data" -m fast >nul 2>&1
  popd
)

echo.
echo ====================================================================
echo   [OK] PresenSee dihentikan.
echo ====================================================================
echo.
pause
