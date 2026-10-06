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

echo.
echo  ------------------------------------------------------------------
echo  PostgreSQL dibiarkan tetap menyala (dipakai layanan lain juga bisa
echo  saja). Kalau memang mau ikut dimatikan, jalankan sendiri:
echo    net stop postgresql-x64-16
echo  ------------------------------------------------------------------
echo.
echo ====================================================================
echo   [OK] PresenSee dihentikan.
echo ====================================================================
echo.
pause
