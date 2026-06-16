@echo off
cd /d "%~dp0"
set PORT=4176
echo Starting Glitch prototype at http://127.0.0.1:%PORT%/index.html
echo.
echo Keep this window open while using the localhost URL.
echo Press Ctrl+C to stop the server.
echo.
node server.js
pause
