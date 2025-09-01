#!/bin/bash
echo "Iniciando frontend do Gerador de Agentes..."
echo "Servidor local na porta 8005"
cd "$(dirname "$0")"
python -m http.server 8005 --directory frontend
