#!/bin/bash
echo "Iniciando frontend do Gerador de Agentes..."
echo "Servidor local na porta 8080"
cd "$(dirname "$0")"

# Generate config.js from environment variable or example
if [ -n "$API_BASE_URL" ]; then
  echo "window.API_BASE_URL = '$API_BASE_URL';" > frontend/config.js
elif [ ! -f frontend/config.js ]; then
  cp frontend/config.example.js frontend/config.js 2>/dev/null || echo "window.API_BASE_URL = '/api';" > frontend/config.js
fi

python -m http.server 8080 --directory frontend