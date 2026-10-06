@echo off
set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    echo Gagal: Komputer Anda tidak punya .NET Framework bawaan.
    pause
    exit /b 1
)

"%CSC%" /nologo /target:winexe /out:"%~dp0AgenScannerRaw.exe" "%~dp0AgenScanner.cs"
if %errorlevel% equ 0 (
    exit /b 0
) else (
    echo Gagal kompilasi! Silakan cek pesan error di atas.
    pause
    exit /b 1
)
