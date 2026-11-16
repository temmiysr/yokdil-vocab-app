@echo off
title YOKDIL Master Web Sunucusu
echo ===================================================
echo   YOKDIL Master Web Uygulamasi Baslatiliyor...
echo ===================================================
echo.

set ELECTRON_RUN_AS_NODE=1
set PORT=3000

REM Gomulu Node ile sunucuyu baslat
start /B "" "C:\Users\user\AppData\Local\Programs\antigravity\Antigravity.exe" "%~dp0serve.js"

REM Sunucunun baglanmasi icin 1 saniye bekle
timeout /t 1 /nobreak >nul

REM Tarayicida otomatik ac
start http://localhost:3000

echo [BILGI] Sunucu aktif! Tarayicinizda http://localhost:3000 acilmistir.
echo.
echo Bu pencereyi acik tuttugunuz surece sunucu calisir.
echo Kapatmak icin pencereyi carpisindan kapatabilirsiniz.
echo ===================================================
echo.
pause
