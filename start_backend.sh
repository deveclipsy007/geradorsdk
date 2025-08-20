#!/bin/bash
echo "Iniciando backend do Gerador de Agentes..."
echo "Porta configurada: 8001"
cd "$(dirname "$0")/backend"
python main.py