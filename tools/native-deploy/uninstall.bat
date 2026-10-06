@echo off
cd /d "%~dp0"
title PresenSee - Uninstall
color 0A

net session >nul 2>&1
if errorlevel 1 (
  color 0C
  echo.
  echo  GAGAL: harus dijalankan sebagai Administrator.
  echo  Klik kanan uninstall.bat, pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo.
echo ====================================================================
echo   PRESENSEE - COPOT LAYANAN
echo ====================================================================
echo.
echo  Ini menghapus layanan Windows PresenSeeApi dan PresenSeeWeb saja.
echo  TIDAK menghapus: database PostgreSQL, node_modules, atau berkas
echo  apa pun di folder ini. Aman dijalankan ulang kalau mau pasang lagi
echo  lewat install.bat.
echo.
set /p LANJUT="  Lanjutkan? (Y/N): "
if /I not "%LANJUT%"=="Y" (
  echo  Dibatalkan.
  pause
  exit /b 0
)

set "NSSM_EXE="
for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"
if not defined NSSM_EXE (
  color 0C
  echo  [GAGAL] nssm.exe tidak ditemukan.
  pause
  exit /b 1
)

echo  Menghentikan dan menghapus layanan Web...
"%NSSM_EXE%" stop PresenSeeWeb >nul 2>&1
"%NSSM_EXE%" remove PresenSeeWeb confirm >nul 2>&1

echo  Menghentikan dan menghapus layanan API...
"%NSSM_EXE%" stop PresenSeeApi >nul 2>&1
"%NSSM_EXE%" remove PresenSeeApi confirm >nul 2>&1

echo.
echo ====================================================================
echo   [OK] Layanan PresenSee dicopot. Database TIDAK disentuh.
echo ====================================================================
echo.
pause
