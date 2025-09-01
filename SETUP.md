# 🚀 Guia de Configuração e Instalação - Gerador de Agentes v2.0

Este guia detalha como configurar e executar o sistema completo do Gerador de Agentes.

## 📋 Pré-requisitos

### Software Necessário
- **Python 3.8+** (Recomendado: Python 3.10 ou superior)
- **pip** ou **uv** (gerenciador de pacotes Python)
- **Git** (opcional, para clonagem)

### Chaves de API (pelo menos uma é obrigatória)
- **Anthropic Claude**: [Console Anthropic](https://console.anthropic.com/)
- **OpenAI GPT**: [Platform OpenAI](https://platform.openai.com/)
- **Groq**: [Console Groq](https://console.groq.com/)

## 🛠️ Instalação Passo a Passo

### 1. Preparação do Ambiente

```bash
# Clone ou baixe o projeto
cd gerador-de-agentes

# Crie um ambiente virtual (RECOMENDADO)
python -m venv venv

# Ative o ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 2. Instalação das Dependências

```bash
# Instale as dependências
pip install -r requirements.txt

# Ou usando uv (mais rápido):
uv pip install -r requirements.txt
```

### 3. Configuração do Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
# Windows: notepad .env
# Linux/Mac: nano .env
```

### 4. Configuração das API Keys

Edite o arquivo `.env` e adicione pelo menos uma chave de API:

```env
# Para Claude (Recomendado)
ANTHROPIC_API_KEY=sk-ant-api03-sua-chave-aqui

# Para GPT-4
OPENAI_API_KEY=sk-sua-chave-openai-aqui

# Para Llama/Mixtral
GROQ_API_KEY=gsk_sua-chave-groq-aqui
```

### 5. Configuração do Banco de Dados

O sistema usa SQLite por padrão (sem configuração adicional). Para outros bancos:

```env
# PostgreSQL
DATABASE_URL=postgresql://usuario:senha@localhost:5432/agents

# MySQL
DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/agents

# SQLite (padrão)
DATABASE_URL=sqlite:///./agents.db
```

## 🚀 Execução

### Método 1: Execução Direta

```bash
# Navegue até o diretório backend
cd backend

# Execute o servidor
python main.py
```

### Método 2: Usando Uvicorn (Recomendado para Produção)

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Método 3: Script de Inicialização

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

## 🌐 Acesso à Interface

Após iniciar o servidor:

- **Interface Web**: http://localhost:8005
- **API Documentation**: http://localhost:8001/docs
- **API Redoc**: http://localhost:8001/redoc
- **Health Check**: http://localhost:8001/api/health

## 🔧 Configurações Avançadas

### Integração OCM Drizzy

Para habilitar notificações via Drizzy:

```env
DRIZZY_ENABLED=true
DRIZZY_WEBHOOK_URL=https://seu-webhook.drizzy.com
DRIZZY_API_KEY=sua-api-key-drizzy
```

### Configurações de Produção

```env
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING
CORS_ORIGINS=https://seu-dominio.com,https://app.seu-dominio.com
SECRET_KEY=sua-chave-secreta-super-forte-aqui
```

### Configurações de Chat

```env
CHAT_SESSION_TIMEOUT=7200  # 2 horas em segundos
MAX_CHAT_HISTORY=100      # Máximo de mensagens por sessão
```

## 📊 Verificação da Instalação

### 1. Teste de Conectividade

```bash
curl http://localhost:8001/api/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00",
  "services": {
    "database": "healthy",
    "agent_executor": {"status": "healthy", "loaded_agents": 0}
  }
}
```

### 2. Teste das API Keys

```bash
# (Opcional) Outros testes dependem de implementação específica
```

### 3. Teste da Interface

Acesse http://localhost:8005 e verifique se:
- ✅ Interface carrega sem erros
- ✅ É possível criar um agente
- ✅ Lista de agentes funciona
- ✅ Chat com agente responde

## 🐛 Solução de Problemas

### Erro: "Module not found"

```bash
# Certifique-se de que o ambiente virtual está ativo
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Reinstale as dependências
pip install -r requirements.txt --force-reinstall
```

### Erro: "API Key não configurada"

Verifique se pelo menos uma chave está configurada no `.env`:

```bash
# Verifique as configurações
# (Removido) Endpoint de configuração não estático
```

### Erro de Banco de Dados

```bash
# Delete o banco e deixe o sistema recriar
rm agents.db

# Ou force a recriação
python -c "from backend.database import DatabaseManager; DatabaseManager.reset_db()"
```

### Porta em Uso

```bash
# Mude a porta no .env
PORT=8001

# Ou mate o processo na porta
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:8000 | xargs kill -9
```

### Logs e Debugging

```bash
# Habilite logs detalhados
LOG_LEVEL=DEBUG
DEBUG=true

# Verifique os logs
tail -f app.log
```

## 📁 Estrutura de Arquivos Após Instalação

```
gerador-de-agentes/
├── backend/
│   ├── main.py              # Servidor principal
│   ├── config.py            # Configurações
│   ├── database.py          # Modelos e ORM
│   ├── services.py          # Lógica de negócio
│   ├── drizzy_integration.py # Integração Drizzy
│   ├── agent_generator.py   # Gerador de código
│   ├── agent_executor.py    # Executor de agentes
│   └── models.py            # Modelos Pydantic
├── frontend/
│   ├── index.html           # Interface principal
│   ├── styles.css           # Estilos
│   └── script.js            # JavaScript
├── .env                     # Configurações (criado por você)
├── .env.example             # Exemplo de configurações
├── requirements.txt         # Dependências Python
├── agents.db               # Banco SQLite (criado automaticamente)
├── app.log                 # Logs (opcional)
└── uploads/                # Uploads (criado automaticamente)
```

## 🔄 Atualizações e Manutenção

### Limpeza Automática

```bash
# Execute tarefas de manutenção
curl -X POST http://localhost:8000/api/system/maintenance
```

### Backup do Banco

```bash
# SQLite
cp agents.db agents_backup_$(date +%Y%m%d).db

# PostgreSQL
pg_dump agents > agents_backup_$(date +%Y%m%d).sql
```

### Monitoramento

```bash
# Estatísticas do sistema
curl http://localhost:8000/api/system/stats

# Agentes carregados
curl http://localhost:8000/api/agents/loaded

# Teste do Drizzy
curl -X POST http://localhost:8000/api/drizzy/test
```

## ⚡ Otimizações de Performance

### Para Alto Volume

```env
# Use PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/agents

# Configure cache maior
CACHE_TTL=7200

# Limite histórico de chat
MAX_CHAT_HISTORY=50
```

### Para Desenvolvimento

```env
# Use SQLite
DATABASE_URL=sqlite:///./agents.db

# Habilite debug
DEBUG=true
LOG_LEVEL=DEBUG
DATABASE_ECHO=true
```

---

## 💡 Dicas Importantes

1. **Segurança**: Nunca commite o arquivo `.env` no Git
2. **Performance**: Use PostgreSQL para produção com múltiplos usuários
3. **Monitoramento**: Configure logs em produção
4. **Backup**: Faça backups regulares do banco de dados
5. **Atualizações**: Mantenha as dependências atualizadas

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `tail -f app.log`
2. Teste a conectividade: `curl http://localhost:8000/health`
3. Valide as configurações: `curl http://localhost:8000/api/config`
4. Consulte a documentação da API: http://localhost:8000/docs

---

**✅ Sistema configurado com sucesso! Você pode começar a criar seus agentes inteligentes.**
