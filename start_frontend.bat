@echo off
echo Iniciando frontend do Gerador de Agentes...
echo Servidor local na porta 8080
cd /d "%~dp0"

REM Generate config.js from environment variable or example
if not "%API_BASE_URL%"=="" (
    echo window.API_BASE_URL = '%API_BASE_URL%';>frontend\config.js
) else (
    if not exist frontend\config.js (
        copy frontend\config.example.js frontend\config.js >nul 2>&1
        if errorlevel 1 echo window.API_BASE_URL = '/api';>frontend\config.js
    )
)

python -m http.server 8080 --directory frontend
pause