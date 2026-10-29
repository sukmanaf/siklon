@echo off
cd /d "%~dp0"
title PresenSee - Backup Database
color 0A
setlocal enabledelayedexpansion

if not exist "backupdb" mkdir "backupdb"

REM Cari psql / pg_dump
set "PG_DUMP_EXE="
if exist "pgsql\bin\pg_dump.exe" set "PG_DUMP_EXE=%~dp0pgsql\bin\pg_dump.exe"
if not defined PG_DUMP_EXE for /f "delims=" %%P in ('where pg_dump 2^>nul') do if not defined PG_DUMP_EXE set "PG_DUMP_EXE=%%P"
if not defined PG_DUMP_EXE if exist "%ProgramFiles%\PostgreSQL\16\bin\pg_dump.exe" set "PG_DUMP_EXE=%ProgramFiles%\PostgreSQL\16\bin\pg_dump.exe"

if not defined PG_DUMP_EXE (
  echo [GAGAL] pg_dump.exe tidak ditemukan.
  exit /b 1
)

REM Ambil tanggal dan jam untuk nama berkas
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DT=%%I"
set "TGL=!DT:~0,4!-!DT:~4,2!-!DT:~6,2!"
set "JAM=!DT:~8,2!-!DT:~10,2!"
set "BACKUP_FILE=%~dp0backupdb\presensee_!TGL!_!JAM!.sql"

set "PGPASSWORD=p0stgr3sql"

echo ====================================================================
echo   PRESENSEE - BACKUP DATABASE OTOMATIS
echo ====================================================================
echo  Mencadangkan database 'absen' ke:
echo  !BACKUP_FILE!
echo.

"%PG_DUMP_EXE%" -h 127.0.0.1 -p 5433 -U postgres -d absen -f "!BACKUP_FILE!"
if errorlevel 1 (
  echo  [GAGAL] Backup database gagal pada port 5433. Mencoba port 5432...
  "%PG_DUMP_EXE%" -h 127.0.0.1 -p 5432 -U postgres -d absen -f "!BACKUP_FILE!"
)

if exist "!BACKUP_FILE!" (
  echo  [OK] Backup berhasil dibuat!
  echo.
  echo  Membersihkan backup lama yang lebih dari 7 hari...
  forfiles /p "%~dp0backupdb" /s /m *.sql /d -7 /c "cmd /c del @path" >nul 2>&1
  echo  [OK] Rotasi 7 hari selesai.
) else (
  echo  [GAGAL] Berkas backup tidak tercipta.
)

echo ====================================================================
echo.
timeout /t 5 >nul

