@echo off
title BillFlow - Cloudflare Remote Access Tunnel
cd /d "%~dp0\.."

echo ================================================================
echo   BILLFLOW - SECURE CLOUDFLARE REMOTE ACCESS TUNNEL
echo ================================================================
echo.

set "CLOUDFLARED_BIN="

REM 1. Check if cloudflared is in PATH
where cloudflared >nul 2>&1
if %errorlevel% equ 0 (
    set "CLOUDFLARED_BIN=cloudflared"
)

REM 2. Check if cloudflared.exe is in local tools folder
if "%CLOUDFLARED_BIN%"=="" (
    if exist "tools\cloudflared.exe" (
        set "CLOUDFLARED_BIN=tools\cloudflared.exe"
    )
)

REM 3. If not found, download it automatically
if "%CLOUDFLARED_BIN%"=="" (
    echo [INFO] Cloudflare tunnel executable not found.
    echo [DOWNLOADING] Downloading official cloudflared binary from Cloudflare GitHub...
    if not exist "tools\" mkdir tools
    curl.exe -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o "tools\cloudflared.exe"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to download cloudflared automatically.
        echo Please download it manually from:
        echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
        echo and place it into the "d:\bsm\tools" folder as "cloudflared.exe".
        pause
        exit /b 1
    )
    set "CLOUDFLARED_BIN=tools\cloudflared.exe"
    echo [SUCCESS] Downloaded cloudflared.exe successfully.
    echo.
)

echo [CHECK] Checking if BillFlow server is running on port 3000...
curl.exe -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo [NOTE] Local BillFlow server is not detected yet.
    echo Starting BillFlow server in a background window...
    start "BillFlow Server" cmd /c "scripts\start-server.bat"
    timeout /t 4 >nul
)

echo.
echo ================================================================
echo   STARTING CLOUDFLARE SECURE TUNNEL
echo ================================================================
echo Look for the public HTTPS link below ending in: .trycloudflare.com
echo Copy that link and share it with your brother and colleague.
echo They can open it on their laptop, tablet, or phone from anywhere!
echo.
echo NOTE: Keep this terminal window open while they need access.
echo ================================================================
echo.

%CLOUDFLARED_BIN% tunnel --url http://localhost:3000
pause
