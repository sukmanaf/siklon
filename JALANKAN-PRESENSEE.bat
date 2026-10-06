@echo off
cd /d "%~dp0"
title PresenSee - Jalankan Aplikasi Presensi Siswa (v1.0.1)
color 0A
cls

echo ====================================================================
echo                   PRESENSEE - SISTEM PRESENSI SISWA (v1.0.1)
echo ====================================================================
echo.
echo Sedang memeriksa status Docker Desktop...
echo.

docker info >nul 2>&1
if not errorlevel 1 goto SKIP_DOCKER_START

echo [INFO] Docker Desktop belum aktif. Memulai Docker Desktop secara otomatis...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
) else (
    color 0C
    echo [ERROR] Docker Desktop belum terpasang di PC ini!
    echo Harap unduh dan pasang Docker Desktop dari https://www.docker.com
    echo.
    pause
    exit /b 1
)
echo Menunggu Docker Desktop siap di latar belakang...

:loop_docker
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto loop_docker

echo [OK] Docker Desktop telah aktif dan siap!
echo.

:SKIP_DOCKER_START

if not exist "presensee-images.tar" goto SKIP_TAR_LOAD

echo [INFO] Memeriksa image Docker PresenSee v1.0.1...
docker image inspect presensee-api:1.0.1 >nul 2>&1
if not errorlevel 1 goto SKIP_TAR_LOAD

echo [INFO] Mengimpor image PresenSee v1.0.1 dari presensee-images.tar...
echo (Harap tunggu sesaat, proses ini hanya berjalan 1 kali per rilis versi)...
docker load -i presensee-images.tar
if errorlevel 1 (
    echo.
    echo [WARN] Gagal mengimpor di percobaan pertama. Menunggu Docker daemon stabil...
    timeout /t 5 /nobreak >nul
    echo [INFO] Mencoba mengimpor ulang presensee-images.tar...
    docker load -i presensee-images.tar
    if errorlevel 1 (
        color 0C
        echo.
        echo [ERROR] Gagal mengimpor image Docker.
        echo Pastikan Docker Desktop sudah menyala sempurna (ikon hijau).
        echo.
        pause
        exit /b 1
    )
)
echo [OK] Image Docker berhasil diimpor!
echo.

:SKIP_TAR_LOAD

echo [1/3] Memulai service PresenSee v1.0.1...
docker compose up -d

if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Gagal menjalankan container Docker.
    echo Periksa pesan kesalahan di atas.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Menunggu service siap (3 detik)...
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Membuka aplikasi PresenSee di browser...
start http://localhost:3000

echo.
echo ====================================================================
echo               [SUKSES] PRESENSEE v1.0.1 BERHASIL DIJALANKAN!
echo ====================================================================
echo  - Dashboard Web : http://localhost:3000
echo  - Konsol Scan   : http://localhost:3000/scan
echo  - Backend API   : http://localhost:5000/api/v1
echo.
echo Jendela ini boleh ditutup. Untuk menghentikan aplikasi,
echo jalankan file "HENTIKAN-PRESENSEE.bat".
echo ====================================================================
echo.
pause
