@echo off
REM ============================================================
REM   Apex Abstracts - one-click launcher (Windows)
REM   Double-click this file to start the Title Search app.
REM   It starts the local server and opens your browser.
REM ============================================================

REM Move to the folder this script lives in (the repo root).
cd /d "%~dp0"

set "URL=http://localhost:8787"

echo.
echo   +------------------------------------------+
echo   ^|   APEX ABSTRACTS - Title Search          ^|
echo   +------------------------------------------+
echo.

REM 1. Make sure Node.js is installed.
where node >nul 2>nul
if errorlevel 1 (
  echo   !  Node.js is not installed.
  echo.
  echo   Apex needs Node.js ^(version 18 or newer^) to run.
  echo   Install the LTS version from:  https://nodejs.org
  echo   Then double-click this launcher again.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
echo   OK Node.js found (%NODEVER%)
echo   ^>  Starting the Apex app...
echo   ^>  Your browser will open to: %URL%
echo.
echo   Keep this window OPEN while you use Apex.
echo   Close it (or press Ctrl+C) when you're done.
echo.

REM 2. Open the browser shortly after the server boots.
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" %URL%"

REM 3. Start the backend (this keeps the window running).
node backend\server.mjs

pause
