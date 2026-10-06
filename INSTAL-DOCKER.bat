@echo off
cd /d "%~dp0"
title PresenSee - Pasang Docker Desktop
color 0A
cls

echo ====================================================================
echo   PRESENSEE - PASANG DOCKER DESKTOP + WSL2
echo ====================================================================
echo.
echo  Jalankan skrip ini SEKALI SAJA, sebelum pertama kali memakai
echo  JALANKAN-PRESENSEE.bat. Kalau Docker Desktop sudah terpasang di PC
echo  ini, skrip ini cuma memastikan itu lalu langsung selesai.
echo.

net session >nul 2>&1
if errorlevel 1 (
  color 0C
  echo  GAGAL: harus dijalankan sebagai Administrator.
  echo  Klik kanan INSTAL-DOCKER.bat, pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

set "PERLU_RESTART=0"
set "DOCKER_ADA=0"
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_ADA=1"
if "%DOCKER_ADA%"=="1" goto DOCKER_SIAP

echo [1/2] Memeriksa WSL2 ^(dibutuhkan Docker Desktop^)...

REM Dicek lewat DISM (status fitur Windows sungguhan), bukan "wsl --status"
REM - wsl.exe kadang malah mencoba mulai proses pasang interaktif sendiri
REM kalau fiturnya belum aktif, yang bisa bikin skrip ini macet menunggu
REM input padahal sedang jalan tanpa pengawasan.
set "WSL_ADA=0"
dism /online /get-featureinfo /featurename:Microsoft-Windows-Subsystem-Linux | findstr /i "State : Enabled" >nul 2>&1
if not errorlevel 1 set "WSL_ADA=1"

set "VMP_ADA=0"
dism /online /get-featureinfo /featurename:VirtualMachinePlatform | findstr /i "State : Enabled" >nul 2>&1
if not errorlevel 1 set "VMP_ADA=1"

if "%WSL_ADA%"=="1" if "%VMP_ADA%"=="1" goto PASANG_DOCKER

echo   [INFO] WSL2 belum aktif - mengaktifkan fitur Windows yang dibutuhkan...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

REM Fitur Windows baru benar-benar aktif setelah restart - Docker Desktop
REM tidak akan bisa menyala normal sebelum itu, jadi restart WAJIB di akhir
REM skrip ini, bukan cuma disarankan.
set "PERLU_RESTART=1"

:PASANG_DOCKER
if not exist "%~dp0installer\Docker Desktop Installer.exe" (
  color 0C
  echo   [GAGAL] installer\Docker Desktop Installer.exe tidak ditemukan di
  echo   paket ini. Unduh manual dari https://www.docker.com/products/docker-desktop/
  echo   lalu pasang sendiri, atau minta paket yang sudah membawa installer-nya.
  echo.
  pause
  exit /b 1
)

echo [2/2] Memasang Docker Desktop ^(beberapa menit, mohon tunggu^)...
"%~dp0installer\Docker Desktop Installer.exe" install --quiet --accept-license --backend=wsl-2
if errorlevel 1 (
  color 0C
  echo   [GAGAL] Instalasi Docker Desktop tidak berhasil ^(kode kesalahan di atas^).
  echo   Coba pasang manual lewat installer\Docker Desktop Installer.exe
  echo   ^(klik 2x, ikuti wizard-nya^).
  echo.
  pause
  exit /b 1
)
echo   [OK] Docker Desktop terpasang.

REM TIDAK otomatis minta restart di sini kalau WSL2 sebelumnya sudah aktif -
REM restart cuma benar-benar wajib kalau fitur Windows (WSL2/VirtualMachine
REM Platform) baru saja diaktifkan di atas (PERLU_RESTART sudah diset 1 di
REM situ kalau itu terjadi). Di PC yang WSL2-nya sudah siap dari awal,
REM Docker Desktop biasanya bisa langsung dipakai tanpa restart - supaya
REM "satu kali install.bat" benar-benar selesai sekali jalan di kasus itu.
goto SET_DASHBOARD

:DOCKER_SIAP
echo  [OK] Docker Desktop sudah terpasang sebelumnya - tidak dipasang ulang.

:SET_DASHBOARD
REM Supaya Docker Desktop tidak membuka jendela dashboard tiap kali
REM menyala (cuma diam di system tray) - setelan ini sama dengan centang
REM "Open Docker Dashboard when Docker Desktop starts" di menu Settings,
REM ditulis langsung ke berkas setelannya. CATATAN: nama kunci ini
REM berdasar perilaku Docker Desktop yang didokumentasikan komunitas,
REM BUKAN API resmi Docker - tidak fatal kalau gagal/berubah di versi
REM lain, cuma berarti dashboard-nya tetap terbuka sendiri (bukan error).
REM Jalur utama JALANKAN-PRESENSEE.bat memakai "docker desktop start" yang
REM MEMANG didesain Docker untuk tidak membuka dashboard sama sekali, jadi
REM ini cuma lapisan tambahan untuk kasus dashboard dibuka manual.
REM Ditulis lewat -EncodedCommand (base64), BUKAN -Command dengan tanda
REM kutip bersarang - pola yang sama dipakai di
REM apps\scanner-agent\install-service.bat untuk alasan yang sama: lebih
REM aman dari jebakan quoting batch, dan tidak pakai "ConvertFrom-Json
REM -AsHashtable" (parameter itu TIDAK ada di Windows PowerShell 5.1 bawaan
REM Windows, cuma di PowerShell 7+) supaya tetap jalan di powershell.exe baku.
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand JABFAHIAcgBvAHIAQQBjAHQAaQBvAG4AUAByAGUAZgBlAHIAZQBuAGMAZQAgAD0AIAAnAFMAdABvAHAAJwAKAHQAcgB5ACAAewAKACAAIAAkAHAAIAA9ACAAIgAkAGUAbgB2ADoAQQBwAHAARABhAHQAYQBcAEQAbwBjAGsAZQByAFwAcwBlAHQAdABpAG4AZwBzAC0AcwB0AG8AcgBlAC4AagBzAG8AbgAiAAoAIAAgACQAZABpAHIAIAA9ACAAUwBwAGwAaQB0AC0AUABhAHQAaAAgACQAcAAgAC0AUABhAHIAZQBuAHQACgAgACAAaQBmACAAKAAtAG4AbwB0ACAAKABUAGUAcwB0AC0AUABhAHQAaAAgACQAZABpAHIAKQApACAAewAgAE4AZQB3AC0ASQB0AGUAbQAgAC0ASQB0AGUAbQBUAHkAcABlACAARABpAHIAZQBjAHQAbwByAHkAIAAtAFAAYQB0AGgAIAAkAGQAaQByACAALQBGAG8AcgBjAGUAIAB8ACAATwB1AHQALQBOAHUAbABsACAAfQAKACAAIABpAGYAIAAoAFQAZQBzAHQALQBQAGEAdABoACAAJABwACkAIAB7AAoAIAAgACAAIAAkAG8AIAA9ACAARwBlAHQALQBDAG8AbgB0AGUAbgB0ACAAJABwACAALQBSAGEAdwAgAHwAIABDAG8AbgB2AGUAcgB0AEYAcgBvAG0ALQBKAHMAbwBuAAoAIAAgAH0AIABlAGwAcwBlACAAewAKACAAIAAgACAAJABvACAAPQAgAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABQAFMATwBiAGoAZQBjAHQACgAgACAAfQAKACAAIABpAGYAIAAoACQAbwAuAFAAUwBPAGIAagBlAGMAdAAuAFAAcgBvAHAAZQByAHQAaQBlAHMALgBOAGEAbQBlACAALQBjAG8AbgB0AGEAaQBuAHMAIAAnAE8AcABlAG4AVQBJAE8AbgBTAHQAYQByAHQAdQBwAEQAaQBzAGEAYgBsAGUAZAAnACkAIAB7AAoAIAAgACAAIAAkAG8ALgBPAHAAZQBuAFUASQBPAG4AUwB0AGEAcgB0AHUAcABEAGkAcwBhAGIAbABlAGQAIAA9ACAAJAB0AHIAdQBlAAoAIAAgAH0AIABlAGwAcwBlACAAewAKACAAIAAgACAAJABvACAAfAAgAEEAZABkAC0ATQBlAG0AYgBlAHIAIAAtAE4AbwB0AGUAUAByAG8AcABlAHIAdAB5AE4AYQBtAGUAIAAnAE8AcABlAG4AVQBJAE8AbgBTAHQAYQByAHQAdQBwAEQAaQBzAGEAYgBsAGUAZAAnACAALQBOAG8AdABlAFAAcgBvAHAAZQByAHQAeQBWAGEAbAB1AGUAIAAkAHQAcgB1AGUACgAgACAAfQAKACAAIAAkAG8AIAB8ACAAQwBvAG4AdgBlAHIAdABUAG8ALQBKAHMAbwBuACAALQBEAGUAcAB0AGgAIAAxADAAIAB8ACAAUwBlAHQALQBDAG8AbgB0AGUAbgB0ACAAJABwACAALQBFAG4AYwBvAGQAaQBuAGcAIAB1AHQAZgA4AAoAfQAgAGMAYQB0AGMAaAAgAHsACgB9AAoA >nul 2>&1

:RINGKASAN
if not "%PERLU_RESTART%"=="1" goto SELESAI_TANPA_RESTART

echo.
echo ====================================================================
echo   Instalasi selesai, tapi PC ini perlu di-RESTART dulu supaya
echo   Docker Desktop/WSL2 bisa berfungsi dengan benar.
echo ====================================================================
set /p RESTART_SEKARANG="  Restart PC sekarang? (Y/N): "
if /I not "%RESTART_SEKARANG%"=="Y" goto RESTART_NANTI

echo  PC akan restart dalam 10 detik - simpan pekerjaan lain dulu kalau ada.
shutdown /r /t 10 /c "Restart untuk menyelesaikan instalasi PresenSee"
set "KODE_KELUAR=2"
goto AKHIR

:RESTART_NANTI
echo  Oke, tidak direstart sekarang. Restart manual PC ini SEBELUM
echo  menjalankan JALANKAN-PRESENSEE.bat - kalau tidak, Docker Desktop
echo  kemungkinan besar gagal menyala.
set "KODE_KELUAR=2"
goto AKHIR

:SELESAI_TANPA_RESTART
echo.
echo ====================================================================
echo   [SELESAI] Docker Desktop sudah siap, tidak perlu restart.
echo   Lanjutkan dengan menjalankan JALANKAN-PRESENSEE.bat.
echo ====================================================================
set "KODE_KELUAR=0"

:AKHIR
REM Kode keluar untuk skrip lain yang memanggil berkas ini lewat "call":
REM 0 = Docker Desktop siap, aman lanjut. 2 = perlu restart dulu, JANGAN
REM lanjut ke langkah berikutnya. 1 = gagal (lihat exit /b 1 di atas).
REM "pause" dilewati kalau dipanggil dari install.bat (argumen pertama
REM "--dari-install") supaya tidak minta tekan tombol dua kali berturutan.
if "%~1"=="--dari-install" exit /b %KODE_KELUAR%
echo.
pause
exit /b %KODE_KELUAR%
