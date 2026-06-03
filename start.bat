@echo off
start "xPense Dev Server" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 2 /nobreak >nul
start chrome http://localhost:5173
