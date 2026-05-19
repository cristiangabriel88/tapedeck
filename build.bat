@echo off
REM Build a single-exe (Windows). Output: dist\tapedeck.exe
REM FFmpeg stays external — install via `winget install ffmpeg`.

setlocal
where pyinstaller >nul 2>nul
if errorlevel 1 (
  echo Installing build deps...
  pip install -r requirements-build.txt || goto :err
)
pip install flask yt-dlp waitress || goto :err

pyinstaller --onefile --noconsole --name tapedeck ^
  --icon tapedeck.ico ^
  --add-data "static;static" ^
  --add-data "templates;templates" ^
  --collect-all yt_dlp ^
  --hidden-import waitress ^
  app.py || goto :err

echo.
echo Built dist\tapedeck.exe
exit /b 0

:err
echo Build failed.
exit /b 1
