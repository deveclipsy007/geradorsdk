@echo off
echo Iniciando backend do Gerador de Agentes...
echo Porta configurada: 8001
cd /d "%~dp0\backend"
python main.py
pause