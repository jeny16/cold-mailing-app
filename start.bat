@echo off
cd /d "%~dp0"

echo ==================================================
echo   Starting Job Application Mailer
echo   Backend:  http://127.0.0.1:5080
echo   Frontend: http://127.0.0.1:5180
echo ==================================================

rem Open default browser after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5180"

npm run dev
