@echo off
title DH-SERVIS OPC & SCADA KOPRUSU
cd /d "D:\Dh_Servis"
echo ========================================================
echo [DH-SERVIS] SCADA RESET & PARAMETRE DENETIM KOPRUSU
echo ========================================================
echo Durum: VPN Dinleme Modunda (0 KB/s Bosta Trafik)
echo Sadece siz webden tetiklediginizde calisir.
echo.
node opc-bridge/bridge.js
pause
