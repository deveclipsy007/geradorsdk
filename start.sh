#!/bin/bash

echo ""
echo "=========================================="
echo "   Gerador de Agentes v2.0"
echo "   Iniciando sistema..."
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logs coloridos
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    log_error "Python não está instalado ou não está no PATH!"
    exit 1
fi

# Usar python3 se disponível, senão python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Verificar se o ambiente virtual existe
if [ ! -d "venv" ]; then
    log_info "Criando ambiente virtual..."
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        log_error "Falha ao criar ambiente virtual."
        exit 1
    fi
fi

# Ativar ambiente virtual
log_info "Ativando ambiente virtual..."
source venv/bin/activate

# Verificar se requirements.txt existe
if [ ! -f "requirements.txt" ]; then
    log_error "Arquivo requirements.txt não encontrado!"
    exit 1
fi

# Instalar dependências
log_info "Instalando dependências..."
pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    log_error "Falha na instalação das dependências."
    exit 1
fi

# Verificar se arquivo .env existe
if [ ! -f ".env" ]; then
    log_warn "Arquivo .env não encontrado!"
    log_info "Copiando .env.example para .env..."
    cp .env.example .env
    echo ""
    echo "============================================"
    echo "   CONFIGURAÇÃO NECESSÁRIA"
    echo "============================================"
    echo ""
    echo "Por favor, edite o arquivo .env e configure:"
    echo "- Pelo menos uma API key (Anthropic, OpenAI ou Groq)"
    echo "- Outras configurações conforme necessário"
    echo ""
    echo "Comando para editar:"
    echo "  nano .env"
    echo ""
    echo "Após configurar, execute este script novamente."
    echo ""
    exit 0
fi

# Verificar se backend/main.py existe
if [ ! -f "backend/main.py" ]; then
    log_error "Arquivo backend/main.py não encontrado!"
    log_error "Verifique se você está no diretório correto."
    exit 1
fi

# Navegar para o diretório backend
cd backend

log_info "Iniciando servidor..."
echo ""
echo "=========================================="
echo -e "   Servidor disponível em:"
echo -e "   - Interface: ${BLUE}http://localhost:8000/static/index.html${NC}"
echo -e "   - API Docs:  ${BLUE}http://localhost:8000/docs${NC}"
echo -e "   - Health:    ${BLUE}http://localhost:8000/health${NC}"
echo "=========================================="
echo ""
echo "Pressione Ctrl+C para parar o servidor"
echo ""

# Função para capturar Ctrl+C
cleanup() {
    echo ""
    log_info "Finalizando servidor..."
    exit 0
}
trap cleanup INT

# Iniciar servidor
$PYTHON_CMD main.py

log_info "Servidor finalizado."