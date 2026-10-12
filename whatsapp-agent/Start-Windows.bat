@echo off
title Hindivine WhatsApp Lead Agent
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org, then double-click this file again.
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing for the first time, please wait...
  call npm install --omit=dev
  if errorlevel 1 ( pause & exit /b 1 )
)
set OPEN_BROWSER=1
node src\server.js
pause
