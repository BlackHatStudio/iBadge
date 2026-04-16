@echo off
set PORT=__APP_PORT__
set HOSTNAME=127.0.0.1
set NODE_ENV=production
cd /d "%~dp0"
"%~dp0node\node.exe" server.js
