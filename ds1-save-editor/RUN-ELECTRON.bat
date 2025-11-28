@echo off
echo Building and starting Electron app...
echo.
cd /d "%~dp0"
call npm run electron
pause
