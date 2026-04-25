@echo off
echo Starting DonaVentory Production Intake...
:: Start the development server in a minimized window
start /min cmd /c "npm run dev"
echo Waiting for the server to initialize (5s)...
:: Wait for 5 seconds
timeout /t 5 >nul
:: Open the app in the default browser
start http://localhost:5173
echo.
echo Application launched! 
echo Keep the minimized terminal window open while using the app.
echo.
pause
exit
