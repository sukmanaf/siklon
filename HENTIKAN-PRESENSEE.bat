@echo off
cd /d "%~dp0"
title PresenSee - Hentikan Aplikasi
color 0E
cls

echo ====================================================================
echo                   PRESENSEE - MENGHENTIKAN APLIKASI
echo ====================================================================
echo.
echo Sedang menghentikan service container PresenSee...
echo.


echo Menghentikan Scanner Agent All-in-One...
taskkill /F /IM AgenScanner.exe >nul 2>&1
taskkill /F /IM AgenScannerRaw.exe >nul 2>&1
taskkill /F /IM AgenScannerCom.exe >nul 2>&1

echo.
docker compose down

echo.
echo ====================================================================
echo           [SUKSES] PRESENSEE TELAH DIHENTIKAN DENGAN AMAN.
echo ====================================================================
echo Data presensi & sesi WhatsApp tetap tersimpan aman di sistem.
echo.
pause
