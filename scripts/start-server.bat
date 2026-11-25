@echo off
title BillFlow - Client, Invoice and Payment Management System
cd /d "%~dp0\.."

echo ================================================================
echo   BILLFLOW - CLIENT, INVOICE AND PAYMENT MANAGEMENT SYSTEM
echo ================================================================
echo Working folder: %CD%
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v24 LTS from https://nodejs.org
    pause
    exit /b 1
)

if not exist "server\index.js" (
    echo [ERROR] server\index.js not found in %CD%
    echo Make sure the shortcut points to bsm\scripts\start-server.bat
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [SETUP] Installing required dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo [STARTING] Starting BillFlow server on port 3000...
echo Server running at: http://localhost:3000
echo.
echo Leave this window open - you can minimize it while using BillFlow.
echo Press Ctrl+C to stop the server.
echo.

start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server/index.js
echo.
echo [STOPPED] Server exited with code %errorlevel%.
pause
