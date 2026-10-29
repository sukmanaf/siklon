@echo off
cd /d "%~dp0"
title PresenSee - Hentikan Agen Scanner

echo ====================================================================
echo             PRESENSEE - MENGHENTIKAN AGEN SCANNER
echo ====================================================================
echo.

tasklist /fi "imagename eq AgenScanner.exe" 2>nul | findstr /i "AgenScanner.exe" >nul
if %errorlevel% equ 0 (
    echo Menghentikan AgenScanner.exe...
    taskkill /f /im AgenScanner.exe >nul 2>&1
    echo [OK] Agen Scanner berhasil dihentikan.
) else (
    echo [INFO] Agen Scanner memang sedang tidak berjalan.
)

echo.
timeout /t 3 >nul

