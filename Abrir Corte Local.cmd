@echo off
setlocal
cd /d "%~dp0"
if exist "release\win-unpacked\Corte Local.exe" (
  start "" "release\win-unpacked\Corte Local.exe"
  exit /b 0
)
if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 exit /b 1
)
call npm start
