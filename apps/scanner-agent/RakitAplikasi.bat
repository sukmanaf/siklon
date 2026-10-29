@echo off
set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    echo [GAGAL] Komputer tidak memiliki .NET Framework v4.0.30319 bawaan Windows.
    pause
    exit /b 1
)

echo Merakit AgenScanner.exe...
"%CSC%" /nologo /target:winexe /r:System.Windows.Forms.dll /out:"%~dp0AgenScanner.exe" "%~dp0AgenScanner.cs"
if %errorlevel% equ 0 (
    echo [OK] AgenScanner.exe berhasil dibuat!
    exit /b 0
) else (
    echo [ERROR] Gagal kompilasi! Silakan cek pesan error di atas.
    pause
    exit /b 1
)

