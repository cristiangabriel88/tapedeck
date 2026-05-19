@echo off
setlocal
cd /d "%~dp0"
title YouTube to MP3

echo.
echo  YouTube -^> MP3  Converter
echo  ============================
echo.

REM --- Python ---
echo  Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found.
    echo          Install Python 3.8+ from https://python.org and add it to PATH.
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  [OK] %PYVER%

REM --- Dependencies (stderr redirected to suppress pip noise) ---
echo  Installing dependencies...
python -m pip install -qq --upgrade --no-warn-script-location --disable-pip-version-check flask yt-dlp waitress 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] pip install failed. Try running this window as Administrator.
    echo.
    pause & exit /b 1
)
echo  [OK] Dependencies ready

REM --- Node.js (optional but improves yt-dlp compatibility) ---
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] Node.js found
) else (
    echo  [!] Node.js not found  ^(install from https://nodejs.org for best YouTube support^)
)

echo.
echo  Starting at http://127.0.0.1:5050
echo  Press Ctrl+C to stop.
echo.

start /b cmd /c "timeout /t 2 >nul && start http://127.0.0.1:5050"

python app.py

echo.
echo  Server stopped.
pause
