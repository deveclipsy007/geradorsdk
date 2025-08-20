@echo off
echo Iniciando frontend do Gerador de Agentes...
echo Servidor local na porta 8080
cd /d "%~dp0"
python -m http.server 8080 --directory frontend
pause