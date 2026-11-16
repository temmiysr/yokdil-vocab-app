@echo off
title YOKDIL Master Web Sunucusu
echo ===================================================
echo   YOKDIL Master Web Uygulamasi Baslatiliyor...
echo ===================================================
echo.

set ELECTRON_RUN_AS_NODE=1
set PORT=3000

REM Tarayicida otomatik ac
start http://localhost:3000

REM Gomulu Node ile yerel sunucuyu calistir
"C:\Users\user\AppData\Local\Programs\antigravity\Antigravity.exe" "%~dp0serve.js"

pause
