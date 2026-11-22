@echo off
title BillFlow - Complete Office & Remote Launcher
cd /d "%~dp0\.."

echo ================================================================
echo   STARTING BILLFLOW PORTAL & CLOUDFLARE REMOTE ACCESS
echo ================================================================
echo.
echo 1. Launching local Node.js server (http://localhost:3000)...
start "BillFlow Server" cmd /c "scripts\start-server.bat"

timeout /t 3 >nul

echo 2. Launching Cloudflare remote tunnel for your brother and colleague...
start "BillFlow Cloudflare Tunnel" cmd /c "scripts\start-cloudflare-tunnel.bat"

echo.
echo Both services are now running!
echo Check the Cloudflare Tunnel window for your public HTTPS link.
echo.
