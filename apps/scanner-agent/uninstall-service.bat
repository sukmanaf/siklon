@echo off
REM Menghapus layanan PresenSee Scanner Agent. Jalankan sebagai Administrator.
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo  Harus dijalankan sebagai Administrator.
  pause & exit /b 1
)
nssm stop PresenSeeScannerAgent
nssm remove PresenSeeScannerAgent confirm
echo  Layanan dihapus. Berkas antrean.sqlite dan config.json TIDAK dihapus.
pause
