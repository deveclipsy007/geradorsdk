@echo off
echo Iniciando backend do Gerador de Agentes...
echo Porta configurada: 8000
cd /d "%~dp0\backend"
python main.py
pause
