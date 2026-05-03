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
echo Update complete! Starting DonaVentory...
echo.

:: Start the development server in a minimized window
start /min cmd /c "npm run dev"
echo Waiting for the server to initialize (5s)...
timeout /t 5 >nul
:: Open the app in the default browser
start http://localhost:5173
echo.
echo Application launched!
echo Keep the minimized terminal window open while using the app.
echo.
pause
exit
