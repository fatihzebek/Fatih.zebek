@echo off
echo DH_SERVIS Web'e Guncelleniyor...
echo ----------------------------------------
cd /d %~dp0
echo 1. Proje derleniyor (Build)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Derleme sirasinda bir sorun olustu! Guncelleme durduruldu.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo 2. Web'e yukleniyor (Deploy)...
call firebase deploy --only hosting
echo.
echo ----------------------------------------
echo Guncelleme BASARIYLA Tamamlandi!
echo ----------------------------------------
pause
