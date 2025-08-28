@echo off
echo.
echo ==========================================
echo   Gerador de Agentes v2.0
echo   Iniciando sistema...
echo ==========================================
echo.

REM Verificar se o ambiente virtual existe
if not exist "venv\Scripts\activate" (
    echo [INFO] Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 (
        echo [ERRO] Falha ao criar ambiente virtual. Verifique se Python está instalado.
        pause
        exit /b 1
    )
)

REM Ativar ambiente virtual
echo [INFO] Ativando ambiente virtual...
call venv\Scripts\activate

REM Verificar se requirements.txt existe
if not exist "requirements.txt" (
    echo [ERRO] Arquivo requirements.txt não encontrado!
    pause
    exit /b 1
)

REM Instalar dependências
echo [INFO] Instalando dependências...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERRO] Falha na instalação das dependências.
    pause
    exit /b 1
)

REM Verificar se arquivo .env existe
if not exist ".env" (
    echo [AVISO] Arquivo .env não encontrado!
    echo [INFO] Copiando .env.example para .env...
    copy .env.example .env
    echo.
    echo ============================================
    echo   CONFIGURAÇÃO NECESSÁRIA
    echo ============================================
    echo.
    echo Por favor, edite o arquivo .env e configure:
    echo - Pelo menos uma API key (Anthropic, OpenAI ou Groq)
    echo - Outras configurações conforme necessário
    echo.
    echo Após configurar, execute este script novamente.
    echo.
    pause
    exit /b 0
)

REM Navegar para o diretório backend
if not exist "backend\main.py" (
    echo [ERRO] Arquivo backend\main.py não encontrado!
    echo Verifique se você está no diretório correto.
    pause
    exit /b 1
)

cd backend

echo [INFO] Iniciando servidor...
echo.
echo ==========================================
echo   Servidor disponível em:
echo   - Interface: http://localhost:8000/static/index.html
echo   - API Docs:  http://localhost:8000/docs  
echo   - Health:    http://localhost:8000/health
echo ==========================================
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

REM Iniciar servidor
python -m uvicorn main:app --host 0.0.0.0 --port 8001

echo.
echo [INFO] Servidor finalizado.
pause
