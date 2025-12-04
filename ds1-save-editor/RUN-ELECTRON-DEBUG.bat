@echo off
echo Building and starting Electron app in DEBUG mode...
echo.
cd /d "%~dp0"
call npm run electron:debug:dev
pause



