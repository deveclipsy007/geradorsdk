#!/bin/bash
echo "Iniciando frontend do Gerador de Agentes..."
echo "Servidor local na porta 8080"
cd "$(dirname "$0")"
python -m http.server 8080 --directory frontend