@echo off
echo DH_SERVIS Yerel Sunucu Baslatiliyor...
echo ----------------------------------------
cd /d %~dp0
start http://localhost:5173
npm run dev
pause
