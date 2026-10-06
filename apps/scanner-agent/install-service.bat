@echo off
REM ====================================================================
REM  Memasang PresenSee Scanner Agent sebagai layanan Windows.
REM  Jalankan sebagai Administrator (klik kanan, pilih "Run as administrator").
REM ====================================================================
setlocal enabledelayedexpansion

echo.
echo  PresenSee Scanner Agent - pemasangan layanan Windows
echo  =================================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo  GAGAL: harus dijalankan sebagai Administrator.
  echo  Klik kanan berkas ini, pilih "Run as administrator".
  echo.
  pause
  exit /b 1
)

set "NODE_ADA=0"
where node >nul 2>&1
if %errorLevel% equ 0 set "NODE_ADA=1"

REM Installer Node.js bawaan (data/node-*.msi saat paket dibuat) ikut
REM disalin ke installer\ di root paket, baik untuk deploy native maupun
REM Docker (tools/buat-paket-native.mjs dan tools/buat-paket-deploy.mjs
REM sama-sama meletakkannya di sana) — kalau ada, dipasang dari situ dulu
REM karena tidak butuh internet sama sekali, sebelum coba winget/unduhan
REM langsung di bawah (BE-117).
if "%NODE_ADA%"=="0" if exist "%~dp0..\..\installer" (
  set "NODE_MSI="
  for %%F in ("%~dp0..\..\installer\node-*.msi") do if not defined NODE_MSI set "NODE_MSI=%%F"
  if defined NODE_MSI (
    echo  [INFO] Memasang Node.js dari installer bawaan ^(tidak perlu internet^)...
    msiexec /i "!NODE_MSI!" /quiet /norestart
    if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_ADA=1"
    where node >nul 2>&1
    if %errorLevel% equ 0 set "NODE_ADA=1"
  )
)

if "%NODE_ADA%"=="0" (
  echo  [INFO] Node.js belum terpasang. Mencoba memasang otomatis lewat winget...
  where winget >nul 2>&1
  if %errorLevel% equ 0 (
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  ) else (
    echo  [INFO] winget tidak tersedia di PC ini - dilewati.
  )
)

REM PATH di jendela cmd yang sedang berjalan ini TIDAK otomatis diperbarui
REM setelah instalasi lewat winget — Windows cuma menulis PATH baru ke
REM registry; proses yang sudah berjalan (termasuk jendela ini) masih
REM memakai salinan lama sampai jendelanya ditutup dan dibuka lagi. Karena
REM itu dicek juga lokasi baku instalasinya secara langsung, bukan cuma
REM lewat "where node" — nssm di bawah toh sudah memakai path lengkap ini
REM juga, jadi layanannya sendiri tidak terganggu oleh PATH jendela ini.
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_ADA=1"
where node >nul 2>&1
if %errorLevel% equ 0 set "NODE_ADA=1"

REM Lapis kedua: kalau winget tidak ada/gagal, unduh installer resmi
REM nodejs.org langsung lewat PowerShell (selalu ada di Windows 7 ke atas,
REM tidak butuh winget maupun package manager lain) dan pasang diam-diam.
REM Skripnya ditulis langsung di sini (lewat -EncodedCommand, base64) alih-alih
REM sebagai berkas .ps1 terpisah, supaya install-service.bat ini tetap satu
REM berkas tunggal yang bisa disalin sendirian tanpa berkas pendamping lain.
if "%NODE_ADA%"=="0" (
  echo  [INFO] Mencoba memasang Node.js lewat unduhan langsung dari nodejs.org...
  powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand JABFAHIAcgBvAHIAQQBjAHQAaQBvAG4AUAByAGUAZgBlAHIAZQBuAGMAZQAgAD0AIAAnAFMAdABvAHAAJwAKACQAUAByAG8AZwByAGUAcwBzAFAAcgBlAGYAZQByAGUAbgBjAGUAIAA9ACAAJwBTAGkAbABlAG4AdABsAHkAQwBvAG4AdABpAG4AdQBlACcACgAKAHQAcgB5ACAAewAKACAAIAAgACAAVwByAGkAdABlAC0ASABvAHMAdAAgACIAIAAgAE0AZQBuAGMAYQByAGkAIAB2AGUAcgBzAGkAIABOAG8AZABlAC4AagBzACAATABUAFMAIAB0AGUAcgBiAGEAcgB1AC4ALgAuACIACgAgACAAIAAgACQAcgBlAGwAZQBhAHMAZQBzACAAPQAgAEkAbgB2AG8AawBlAC0AUgBlAHMAdABNAGUAdABoAG8AZAAgAC0AVQByAGkAIAAnAGgAdAB0AHAAcwA6AC8ALwBuAG8AZABlAGoAcwAuAG8AcgBnAC8AZABpAHMAdAAvAGkAbgBkAGUAeAAuAGoAcwBvAG4AJwAKACAAIAAgACAAJABsAHQAcwBSAGUAbABlAGEAcwBlACAAPQAgACQAcgBlAGwAZQBhAHMAZQBzACAAfAAgAFcAaABlAHIAZQAtAE8AYgBqAGUAYwB0ACAAewAgACQAXwAuAGwAdABzACAAfQAgAHwAIABTAGUAbABlAGMAdAAtAE8AYgBqAGUAYwB0ACAALQBGAGkAcgBzAHQAIAAxAAoAIAAgACAAIABpAGYAIAAoAC0AbgBvAHQAIAAkAGwAdABzAFIAZQBsAGUAYQBzAGUAKQAgAHsACgAgACAAIAAgACAAIAAgACAAdABoAHIAbwB3ACAAIgBUAGkAZABhAGsAIABtAGUAbgBlAG0AdQBrAGEAbgAgAHIAaQBsAGkAcwAgAEwAVABTACAAcABhAGQAYQAgAGQAYQBmAHQAYQByACAAcgBlAHMAbQBpACAAbgBvAGQAZQBqAHMALgBvAHIAZwAuACIACgAgACAAIAAgAH0ACgAgACAAIAAgACQAdgBlAHIAcwBpAG8AbgAgAD0AIAAkAGwAdABzAFIAZQBsAGUAYQBzAGUALgB2AGUAcgBzAGkAbwBuAAoAIAAgACAAIAAkAHUAcgBsACAAPQAgACIAaAB0AHQAcABzADoALwAvAG4AbwBkAGUAagBzAC4AbwByAGcALwBkAGkAcwB0AC8AJAB2AGUAcgBzAGkAbwBuAC8AbgBvAGQAZQAtACQAdgBlAHIAcwBpAG8AbgAtAHgANgA0AC4AbQBzAGkAIgAKACAAIAAgACAAJABvAHUAdAAgAD0AIABKAG8AaQBuAC0AUABhAHQAaAAgACQAZQBuAHYAOgBUAEUATQBQACAAIgBwAHIAZQBzAGUAbgBzAGUAZQAtAG4AbwBkAGUALQBpAG4AcwB0AGEAbABsAGUAcgAuAG0AcwBpACIACgAKACAAIAAgACAAVwByAGkAdABlAC0ASABvAHMAdAAgACIAIAAgAE0AZQBuAGcAdQBuAGQAdQBoACAATgBvAGQAZQAuAGoAcwAgACQAdgBlAHIAcwBpAG8AbgAgAGQAYQByAGkAIABuAG8AZABlAGoAcwAuAG8AcgBnAC4ALgAuACIACgAgACAAIAAgAEkAbgB2AG8AawBlAC0AVwBlAGIAUgBlAHEAdQBlAHMAdAAgAC0AVQByAGkAIAAkAHUAcgBsACAALQBPAHUAdABGAGkAbABlACAAJABvAHUAdAAKAAoAIAAgACAAIABXAHIAaQB0AGUALQBIAG8AcwB0ACAAIgAgACAATQBlAG0AYQBzAGEAbgBnACAATgBvAGQAZQAuAGoAcwAgACgAZABpAGEAbQAtAGQAaQBhAG0ALAAgAHQAdQBuAGcAZwB1ACAAcwBlAGIAZQBuAHQAYQByACkALgAuAC4AIgAKACAAIAAgACAAJABwAHIAbwBjACAAPQAgAFMAdABhAHIAdAAtAFAAcgBvAGMAZQBzAHMAIABtAHMAaQBlAHgAZQBjAC4AZQB4AGUAIAAtAEEAcgBnAHUAbQBlAG4AdABMAGkAcwB0ACAAIgAvAGkAIABgACIAJABvAHUAdABgACIAIAAvAHEAdQBpAGUAdAAgAC8AbgBvAHIAZQBzAHQAYQByAHQAIABBAEQARABMAE8AQwBBAEwAPQBBAEwATAAiACAALQBXAGEAaQB0ACAALQBQAGEAcwBzAFQAaAByAHUACgAgACAAIAAgAFIAZQBtAG8AdgBlAC0ASQB0AGUAbQAgACQAbwB1AHQAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAaQBsAGUAbgB0AGwAeQBDAG8AbgB0AGkAbgB1AGUACgAKACAAIAAgACAAaQBmACAAKAAkAHAAcgBvAGMALgBFAHgAaQB0AEMAbwBkAGUAIAAtAG4AZQAgADAAKQAgAHsACgAgACAAIAAgACAAIAAgACAAdABoAHIAbwB3ACAAIgBtAHMAaQBlAHgAZQBjACAAawBlAGwAdQBhAHIAIABkAGUAbgBnAGEAbgAgAGsAbwBkAGUAIAAkACgAJABwAHIAbwBjAC4ARQB4AGkAdABDAG8AZABlACkALgAiAAoAIAAgACAAIAB9AAoACgAgACAAIAAgAFcAcgBpAHQAZQAtAEgAbwBzAHQAIAAiACAAIABOAG8AZABlAC4AagBzACAAJAB2AGUAcgBzAGkAbwBuACAAdABlAHIAcABhAHMAYQBuAGcALgAiAAoAIAAgACAAIABlAHgAaQB0ACAAMAAKAH0AIABjAGEAdABjAGgAIAB7AAoAIAAgACAAIABXAHIAaQB0AGUALQBIAG8AcwB0ACAAIgAgACAARwBBAEcAQQBMACAAbQBlAG0AYQBzAGEAbgBnACAATgBvAGQAZQAuAGoAcwAgAG8AdABvAG0AYQB0AGkAcwA6ACAAJABfACIACgAgACAAIAAgAGUAeABpAHQAIAAxAAoAfQAKAA==
)

if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_ADA=1"
where node >nul 2>&1
if %errorLevel% equ 0 set "NODE_ADA=1"

if "%NODE_ADA%"=="0" (
  echo  GAGAL: Node.js belum terpasang.
  echo  Pemasangan otomatis ^(winget maupun unduhan langsung dari nodejs.org^)
  echo  tidak berhasil - kemungkinan PC ini tidak terhubung internet.
  echo  Pasang manual dari https://nodejs.org ^(pilih versi LTS 22 atau lebih
  echo  baru^), lalu jalankan skrip ini lagi.
  echo.
  echo  Kalau baru saja instalasi tampak berhasil tapi pesan ini tetap
  echo  muncul: tutup jendela ini, buka lagi, lalu jalankan skrip ini
  echo  sekali lagi ^(PATH-nya perlu dimuat ulang^).
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0config.json" (
  echo  GAGAL: config.json belum ada di folder ini.
  echo  Salin config.example.json menjadi config.json, lalu isi apiUrl dan apiKey
  echo  dengan nilai dari halaman Scanner pada aplikasi.
  echo.
  pause
  exit /b 1
)

REM nssm dipakai karena Node bukan aplikasi layanan Windows; nssm yang
REM mengurus start otomatis, restart saat crash, dan pengalihan log.
REM Pola variabel penanda (bukan goto keluar blok kurung) sengaja dipakai
REM di sini — goto jenis itu sudah terbukti jadi sumber bug tersembunyi di
REM instalasi native sesi ini (lihat install.bat BE-112).
set "NSSM_ADA=0"
where nssm >nul 2>&1
if %errorLevel% equ 0 set "NSSM_ADA=1"
if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_ADA=1"

REM nssm.exe bawaan (data/nssm-2.24/.../nssm.exe saat paket dibuat) ikut
REM disalin ke installer\ di root paket, sama seperti Node.js di atas —
REM dipasang dari situ dulu sebelum coba winget (BE-117).
if "%NSSM_ADA%"=="0" if exist "%~dp0..\..\installer\nssm.exe" (
  echo  [INFO] Memasang NSSM dari installer bawaan ^(tidak perlu internet^)...
  if not exist "%ProgramFiles%\nssm" mkdir "%ProgramFiles%\nssm"
  copy /y "%~dp0..\..\installer\nssm.exe" "%ProgramFiles%\nssm\nssm.exe" >nul
  set "NSSM_ADA=1"
)

if "%NSSM_ADA%"=="0" (
  where winget >nul 2>&1
  if %errorLevel% equ 0 (
    echo  [INFO] NSSM belum ada - mencoba memasang lewat winget...
    winget install --id NSSM.NSSM -e --silent --accept-package-agreements --accept-source-agreements
  )
)
where nssm >nul 2>&1
if %errorLevel% equ 0 set "NSSM_ADA=1"
if exist "%ProgramFiles%\nssm\nssm.exe" set "NSSM_ADA=1"

if "%NSSM_ADA%"=="0" (
  echo  GAGAL: nssm belum terpasang dan tidak ditemukan cara memasangnya otomatis.
  echo  Unduh dari https://nssm.cc/download lalu letakkan nssm.exe di PATH,
  echo  atau pasang lewat: winget install NSSM.NSSM
  echo.
  pause
  exit /b 1
)
set "PATH=%PATH%;%ProgramFiles%\nssm"

REM Path node.exe yang SUNGGUHAN dicari di sini, bukan ditebak dari lokasi
REM baku, karena instalasi lewat winget/MSI tidak selalu berakhir di
REM %ProgramFiles%\nodejs — nssm butuh path lengkap yang benar-benar ada,
REM kalau tidak dia akan "berhasil" dipasang tapi service-nya mati sendiri
REM begitu di-start (SERVICE_STOPPED).
set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"

if not defined NODE_EXE (
  echo  GAGAL: node.exe tidak ditemukan walau Node.js terdeteksi terpasang.
  echo  Tutup jendela ini, buka lagi, lalu jalankan skrip ini sekali lagi
  echo  ^(PATH-nya perlu dimuat ulang^).
  echo.
  pause
  exit /b 1
)

REM node_modules TIDAK ikut terkirim dalam paket (dist\ saja) — "serialport"
REM adalah modul native yang harus benar-benar di-compile/diunduh di PC
REM Windows ini sendiri, bukan salinan dari mesin Linux tempat dist\ dibuat
REM (pelajaran yang sama seperti @node-rs/argon2 di apps/api). Tanpa langkah
REM ini, layanan langsung MODULE_NOT_FOUND begitu dinyalakan lalu masuk
REM restart-loop nssm sampai statusnya jadi SERVICE_PAUSED (BE-115).
for /f "delims=" %%D in ("%NODE_EXE%") do set "NODE_DIR=%%~dpD"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%~dp0node_modules" (
  REM npm install kadang gagal EPERM sesaat di Windows (rmdir/symlink)
  REM kalau antivirus real-time memindai berkas yang baru ditulis npm —
  REM terbukti terjadi di client sungguhan untuk apps/api (BE-116), pola
  REM yang sama bisa kena juga di sini karena "serialport" modul native.
  REM Diberi 3x percobaan, folder dihapus total di antara percobaan.
  set "NPM_OK=0"
  pushd "%~dp0."
  for /l %%T in (1,1,3) do (
    if "!NPM_OK!"=="0" (
      echo  Memasang dependensi Scanner Agent ^(butuh internet, sebentar^)...
      call "%NPM_CMD%" install --omit=dev --no-audit --no-fund
      if not errorlevel 1 (
        set "NPM_OK=1"
      ) else (
        echo  [INFO] npm install gagal, mencoba lagi...
        rd /s /q "node_modules" >nul 2>&1
        timeout /t 5 /nobreak >nul
      )
    )
  )
  popd
  if "!NPM_OK!"=="0" (
    echo  [PERINGATAN] npm install tetap gagal setelah 3 percobaan.
    echo  Kemungkinan besar antivirus mengunci folder ini - coba kecualikan
    echo  folder ini dari pemindaian real-time Windows Defender/antivirus,
    echo  lalu jalankan skrip ini lagi.
  )
)

echo  Menghentikan layanan lama bila ada...
nssm stop PresenSeeScannerAgent >nul 2>&1
nssm remove PresenSeeScannerAgent confirm >nul 2>&1

echo  Memasang layanan...
nssm install PresenSeeScannerAgent "%NODE_EXE%" "%~dp0dist\index.js"
REM "%~dp0" SELALU diakhiri backslash — kalau dikutip langsung seperti itu,
REM Windows membaca "\" tepat sebelum tanda kutip penutup sebagai ESCAPE
REM untuk kutipnya (bukan penutup string), sehingga argumennya jadi rusak
REM (ada tanda kutip nyasar di dalam path) dan CreateProcess menolaknya
REM dengan "directory name is invalid". Titik di akhir ("%~dp0.") mengacu
REM ke folder yang SAMA tapi menghindari bug ini karena tidak lagi diakhiri
REM backslash mentah sebelum tanda kutip penutup.
nssm set PresenSeeScannerAgent AppDirectory "%~dp0."
nssm set PresenSeeScannerAgent DisplayName "PresenSee Scanner Agent"
nssm set PresenSeeScannerAgent Description "Membaca scanner barcode di gerbang dan mengirim presensi ke server PresenSee"
nssm set PresenSeeScannerAgent Start SERVICE_AUTO_START

REM Log diputar per hari supaya tidak tumbuh tanpa batas di PC gerbang.
if not exist "%~dp0log" mkdir "%~dp0log"
nssm set PresenSeeScannerAgent AppStdout "%~dp0log\agent.log"
nssm set PresenSeeScannerAgent AppStderr "%~dp0log\agent.log"
nssm set PresenSeeScannerAgent AppRotateFiles 1
nssm set PresenSeeScannerAgent AppRotateBytes 5242880

REM Restart otomatis bila proses mati, dengan jeda 5 detik.
nssm set PresenSeeScannerAgent AppExit Default Restart
nssm set PresenSeeScannerAgent AppRestartDelay 5000

echo  Menjalankan layanan...
nssm start PresenSeeScannerAgent

echo.
echo  SELESAI. Layanan akan hidup otomatis setiap PC dinyalakan.
echo.
echo  Perintah yang berguna:
echo    nssm status PresenSeeScannerAgent    - lihat status
echo    nssm restart PresenSeeScannerAgent   - jalankan ulang
echo    nssm stop PresenSeeScannerAgent      - hentikan
echo    type log\agent.log                - lihat log
echo.
REM "pause" dilewati kalau dipanggil otomatis dari JALANKAN-PRESENSEE.bat
REM (argumen pertama "--dari-jalankan") supaya tidak minta tekan tombol di
REM tengah rangkaian install.bat yang lebih besar.
if "%~1"=="--dari-jalankan" exit /b 0
pause
