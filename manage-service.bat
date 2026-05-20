@echo off
REM Service Manager Launcher
REM Double-click this file to manage the service

cd /d "%~dp0"

REM Request admin privileges
if not "%1"=="am_admin" (
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\" am_admin' -Verb runAs"
    exit /b
)

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "manage-service.ps1"

REM Keep window open
echo.
echo Press any key to close this window...
pause > nul
