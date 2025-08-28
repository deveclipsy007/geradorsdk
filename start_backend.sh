#!/bin/bash
echo "Iniciando backend do Gerador de Agentes..."
echo "Porta configurada: 8000"
cd "$(dirname "$0")/backend"
python main.py
