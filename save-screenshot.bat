@echo off
setlocal enabledelayedexpansion

:: Get the directory where the script is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Find the next available screen number
set NUM=1
:FIND_NUM
if exist "screen!NUM!.png" (
    set /a NUM+=1
    goto FIND_NUM
)

:: PowerShell script to save clipboard image
powershell -command "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img -ne $null) { $img.Save('%SCRIPT_DIR%screen!NUM!.png', [System.Drawing.Imaging.ImageFormat]::Png); Write-Host 'Screenshot saved as screen!NUM!.png'; } else { Write-Host 'No image found in clipboard'; exit 1; }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! File created: screen!NUM!.png
) else (
    echo.
    echo Error: No image in clipboard
)

pause
