@echo off
cd /d "%~dp0"
title PresenSee - Jalankan
color 0A

echo.
echo ====================================================================
echo   PRESENSEE - MENJALANKAN LAYANAN
echo ====================================================================
echo.

set "NSSM_EXE="
for /f "delims=" %%S in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%S"
if not defined NSSM_EXE if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\nssm.exe"
if not defined NSSM_EXE (
  color 0C
  echo  [GAGAL] nssm.exe tidak ditemukan. Sudah pernah jalankan install.bat?
  echo.
  pause
  exit /b 1
)

REM Layanan API/Web/PostgreSQL didaftarkan SERVICE_AUTO_START oleh
REM install.bat, jadi normalnya SUDAH menyala sendiri sejak PC dinyalakan —
REM skrip ini cuma jaring pengaman + pembuka browser. Mengecek/menyalakan
REM ulang lewat nssm/sc BUTUH hak Administrator; kalau dipanggil tanpa itu
REM (mis. lewat pintasan di folder Startup, yang TIDAK elevated), semua
REM query itu gagal "Access is denied" walau layanannya sendiri baik-baik
REM saja — jadi dilewati saja di kondisi itu, bukan ditampilkan sebagai
REM error yang menakutkan (BE-115).
set "IS_ADMIN=0"
net session >nul 2>&1
if not errorlevel 1 set "IS_ADMIN=1"

if "%IS_ADMIN%"=="1" (
  sc query postgresql-x64-16 | findstr /c:"RUNNING" >nul 2>&1
  if errorlevel 1 (
    echo  Menyalakan PostgreSQL...
    net start postgresql-x64-16 >nul 2>&1
  )

  echo  Memeriksa layanan API...
  "%NSSM_EXE%" status PresenSeeApi 2>nul | findstr /c:"SERVICE_RUNNING" >nul
  if errorlevel 1 "%NSSM_EXE%" start PresenSeeApi

  echo  Memeriksa layanan Web...
  "%NSSM_EXE%" status PresenSeeWeb 2>nul | findstr /c:"SERVICE_RUNNING" >nul
  if errorlevel 1 "%NSSM_EXE%" start PresenSeeWeb
) else (
  echo  ^(Dijalankan tanpa hak Administrator - lewati pengecekan layanan;
  echo  layanan seharusnya sudah menyala sendiri sejak PC dinyalakan. Kalau
  echo  aplikasi tidak terbuka, klik kanan berkas ini lalu pilih
  echo  "Run as administrator" supaya bisa memaksa layanan menyala.^)
)

echo.
echo  Menunggu servicenya siap (5 detik)...
timeout /t 5 /nobreak >nul

echo  Membuka aplikasi di browser...
start http://localhost:3000

echo.
echo ====================================================================
echo   [OK] PresenSee dibuka di browser. Jendela ini boleh ditutup.
echo ====================================================================
echo.
pause
