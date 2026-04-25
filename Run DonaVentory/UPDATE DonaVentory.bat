@echo off
echo Updating DonaVentory...
echo.
:: Navigate to the project root relative to the script's location
cd /d "%~dp0.."
git pull
echo.
echo Installing dependencies...
cd DonaVentory
npm install
echo.
echo Update complete!
pause
