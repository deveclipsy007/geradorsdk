@echo off

echo Ativando ambiente virtual...
call "%~dp0\.venv\Scripts\activate.bat"

if %errorlevel% neq 0 (
    echo ERRO: Nao foi possivel ativar o ambiente virtual.
    pause
    exit /b %errorlevel%
)

echo Iniciando backend do Gerador de Agentes com Uvicorn...
cd /d "%~dp0\backend"

REM Inicia o servidor na porta 8001 com auto-reload
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

pause