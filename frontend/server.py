#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor HTTP simples para desenvolvimento do frontend
Configuração centralizada de portas
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Importar configuração centralizada do backend
sys.path.append(str(Path(__file__).parent.parent / "backend"))
try:
    from config import FRONTEND_PORT, BACKEND_PORT
    PORT = FRONTEND_PORT
except ImportError:
    # Fallback se não conseguir importar
    PORT = 8005

FRONTEND_DIR = Path(__file__).parent

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Handler personalizado para servir arquivos com CORS headers"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)
    
    def end_headers(self):
        """Adiciona headers CORS para permitir comunicação com backend"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Override GET to serve index.html for SPA routing"""
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

def start_frontend_server():
    """Inicia o servidor frontend na porta 8005"""
    
    # Verificar se a porta está disponível
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            print(f"[FRONTEND] Server iniciado!")
            print(f"[FRONTEND] Diretorio: {FRONTEND_DIR}")
            print(f"[FRONTEND] URL: http://localhost:{PORT}")
            try:
                print(f"[FRONTEND] Backend API: http://localhost:{BACKEND_PORT}/api")
            except NameError:
                print(f"[FRONTEND] Backend API: http://localhost:8001/api")
            print(f"[FRONTEND] Evolution API: https://evolution.agentecortex.com (v2.2.3)")
            print("=" * 50)
            print("[INFO] Para parar o servidor: Ctrl+C")
            print("=" * 50)
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n[STOP] Servidor frontend interrompido pelo usuario")
                print("[OK] Servidor frontend finalizado com sucesso")
                
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"[ERROR] Porta {PORT} ja esta em uso")
            print(f"[INFO] Tente parar outros servicos na porta {PORT} ou use outra porta")
        else:
            print(f"[ERROR] Erro ao iniciar servidor: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Erro inesperado: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("SDK Agentes Especializados - Frontend Server")
    print("=" * 50)
    
    # Verificar se estamos no diretório correto
    if not (FRONTEND_DIR / 'index.html').exists():
        print("[ERROR] Arquivo index.html nao encontrado")
        print(f"[INFO] Diretorio atual: {FRONTEND_DIR}")
        print("[INFO] Execute este script a partir do diretorio frontend/")
        sys.exit(1)
    
    start_frontend_server()