@echo off
title RSaini & Associates - Practice Billing System
cd /d "%~dp0\.."

echo ================================================================
echo   RSAINI & ASSOCIATES - PRACTICING COMPANY SECRETARIES
echo   Client, Invoice & Payment Management System
echo ================================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js (version 20 or higher) from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [SETUP] Installing required dependencies...
    npm install
)

echo [STARTING] Starting practice portal server on port 3000...
echo Server running at: http://localhost:3000
echo.
echo Leave this window open while using the application.
echo Press Ctrl+C to stop the server.
echo.

start "" "http://localhost:3000"
node server/index.js
pause
