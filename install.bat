@echo off
cd /d "%~dp0"
title PresenSee - Instalasi
color 0A
cls

echo ====================================================================
echo   PRESENSEE - INSTALASI
echo ====================================================================
echo.
echo  Skrip ini memasang semuanya dalam satu jalan: Docker Desktop + WSL2
echo  (kalau belum ada), data awal database, lalu menyalakan aplikasinya.
echo.

net session >nul 2>&1
if errorlevel 1 (
  color 0C
  echo  GAGAL: harus dijalankan sebagai Administrator.
  echo  Klik kanan install.bat, pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo [1/3] Docker Desktop + WSL2...
call "%~dp0INSTAL-DOCKER.bat" --dari-install
if errorlevel 2 goto PERLU_RESTART_DULU
if errorlevel 1 goto GAGAL_DOCKER
echo   [OK] Docker Desktop siap.
echo.

echo [2/3] Data awal database...
if exist "%~dp0database\.data-sudah-diisi" goto DATA_SUDAH_ADA

echo   ------------------------------------------------------------------
echo   Masukkan data contoh? ^(kelas ^& siswa contoh, aman dihapus/diedit
echo   nanti^). Jawab N untuk pemasangan sungguhan di sekolah - mulai dari
echo   kosong, kelas ^& siswa asli ditambahkan sendiri lewat aplikasi.
echo   ------------------------------------------------------------------
set /p DATA_CONTOH="  Masukkan data contoh? (Y/N): "
if /I "%DATA_CONTOH%"=="Y" (
  echo   [OK] Data contoh akan dimasukkan ^(bawaan paket ini^).
) else (
  REM seed.sql bawaan paket ini SUDAH berisi data contoh - ditimpa dengan
  REM versi esensial (cuma akun login + setelan, tanpa kelas/siswa contoh)
  REM kalau dijawab N. docker-compose.yml memetakan persis berkas
  REM database\seed.sql ini ke /docker-entrypoint-initdb.d/02-seed.sql,
  REM yang hanya dijalankan Postgres SEKALI saat volume datanya masih
  REM kosong (percobaan pertama) - makanya keputusan Y/N ini harus
  REM diambil SEBELUM "docker compose up" pertama kali, bukan sesudahnya.
  copy /y "%~dp0database\seed-esensial.sql" "%~dp0database\seed.sql" >nul
  echo   [OK] Mulai dari data kosong ^(cuma akun login^).
)
echo selesai > "%~dp0database\.data-sudah-diisi"
goto DATA_SELESAI

:DATA_SUDAH_ADA
echo   [INFO] Sudah pernah diisi sebelumnya - dilewati ^(aman dijalankan
echo   ulang, database yang sudah ada tidak disentuh^).

:DATA_SELESAI
echo.

echo [3/3] Menyalakan aplikasi...
echo.
call "%~dp0JALANKAN-PRESENSEE.bat"
exit /b 0

:PERLU_RESTART_DULU
echo.
echo ====================================================================
echo   PC perlu di-restart dulu ^(lihat pesan di atas^). Setelah PC
echo   menyala kembali, jalankan install.bat ini LAGI untuk melanjutkan -
echo   langkah yang sudah selesai ^(Docker Desktop^) tidak diulang.
echo ====================================================================
echo.
pause
exit /b 0

:GAGAL_DOCKER
echo.
echo ====================================================================
echo   [GAGAL] Pemasangan Docker Desktop tidak berhasil ^(lihat pesan
echo   di atas^). Perbaiki dulu, lalu jalankan install.bat ini lagi.
echo ====================================================================
echo.
pause
exit /b 1
