@echo off
echo Iniciando backend do Gerador de Agentes...
echo Porta configurada: 8000
cd /d "%~dp0\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8001
=======
python main.py
pause
