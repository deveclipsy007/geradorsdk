#!/bin/bash
echo "Iniciando backend do Gerador de Agentes..."
echo "Porta configurada: 8001"
cd "$(dirname "$0")/backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8001
