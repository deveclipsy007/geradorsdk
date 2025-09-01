# 🤖 Gerador de Agentes SDK v2.0

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)
![Agno](https://img.shields.io/badge/Agno-1.7.8-purple.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

Sistema enterprise para criação, gerenciamento e execução de agentes inteligentes usando o framework **Agno**. Inclui interface web moderna, persistência robusta, APIs completas e integrações com WhatsApp, Google Calendar, e-mail e pagamentos.

## ✨ Características Principais

### 🚀 **Framework Agno de Nova Geração**
- **Performance Extrema**: 10.000x mais rápido que LangGraph (~2 microssegundos)
- **5 Níveis Agênticos**: De ferramentas simples a workflows complexos
- **Multimodal Nativo**: Texto, imagem, áudio e vídeo em um só framework
- **Múltiplos Modelos**: Claude 3, GPT-4, Llama 3, Mixtral via Groq

### 🔌 **Integrações Empresariais**
- **WhatsApp Business**: Evolution API v2.2.3 para automação completa
- **Google Calendar**: Agendamento inteligente e gestão de eventos
- **E-mail**: Envio automatizado via SMTP e templates
- **Pagamentos**: Stripe e Asaas para processamento de transações
- **Webhooks**: Sistema robusto de notificações em tempo real

### 🎨 **Interface Moderna & Responsiva**
- **Design Glassmorphism**: Visual moderno com efeitos de vidro
- **Dark Theme**: Otimizado para desenvolvedores
- **Mobile First**: Funciona perfeitamente em todos os dispositivos
- **Real-time Updates**: Atualizações instantâneas via WebSocket

### 🗄️ **Persistência Enterprise**
- **Múltiplos Bancos**: SQLite, PostgreSQL, MySQL
- **SQLAlchemy ORM**: Migrations automáticas e type safety
- **Histórico Completo**: Todas as conversas e execuções persistidas
- **Backup Ready**: Estrutura otimizada para backup e replicação

## 📁 Arquitetura do Projeto

```
gerador-de-agentes-sdk/
├── 🔧 backend/                     # API FastAPI e lógica de negócio
│   ├── main.py                    # 🚀 Servidor principal e rotas API
│   ├── config.py                  # ⚙️ Configurações centralizadas
│   ├── database.py                # 🗄️ Modelos SQLAlchemy e ORM
│   ├── models.py                  # 📋 Schemas Pydantic para validação
│   └── services/                  # 🏗️ Serviços especializados
│       ├── evolution_api_service.py # 📱 Integração WhatsApp v2.2.3
│       ├── calendar_service.py    # 📅 Google Calendar API
│       ├── email_service.py       # 📧 Envio de e-mails
│       └── payment_service.py     # 💳 Stripe & Asaas
├── 🎨 frontend/                    # Interface web moderna
│   ├── index.html                 # 🏠 SPA responsiva
│   ├── styles.css                 # 💎 Glassmorphism & animations
│   └── script.js                  # ⚡ JavaScript interativo
├── 📚 docs/                        # Documentação completa
│   ├── SETUP.md                   # 🚀 Guia de instalação
│   ├── FRAMEWORK_ANALYSIS.md      # 🔍 Análise técnica Agno
│   ├── CHANGELOG.md               # 📋 Histórico de mudanças
│   └── CHECKLIST.md               # ✅ Funcionalidades
├── .env.example                   # 🔧 Template de configuração
├── requirements.txt               # 📦 Dependências Python
├── start.bat / start.sh           # 🎬 Scripts de inicialização
└── README.md                      # 📖 Este arquivo
```

## 🚀 Instalação e Configuração

### 📋 Pré-requisitos

| Requisito | Versão | Descrição |
|-----------|--------|-----------|
| **Python** | 3.8+ | Runtime principal (recomendado: 3.10+) |
| **pip/uv** | Latest | Gerenciador de pacotes Python |
| **API Keys** | - | Pelo menos uma chave de IA necessária |
| **Evolution API** | v2.2.3 | Acesso ao servidor remoto para WhatsApp |

### ⚡ Instalação Rápida

#### **Método 1: Scripts Automáticos (Recomendado)**

```bash
# Windows
start.bat

# Linux/macOS
chmod +x start.sh && ./start.sh
```

#### **Método 2: Instalação Manual**

```bash
# 1. Clone o repositório
git clone https://github.com/deveclipsy007/geradorsdk.git
cd geradorsdk

# 2. Crie ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate     # Windows

# 3. Instale dependências
pip install -r requirements.txt
# (Opcional) Ferramentas de desenvolvimento
pip install -r requirements-dev.txt

# (Opcional) Setup rápido de dev via Makefile
make dev-setup

# 4. Configure ambiente
cp .env.example .env
# Edite .env com suas API keys

# 5. Execute o sistema
cd backend && python main.py
```

### 🔑 Configuração de API Keys

Edite o arquivo `.env` com suas credenciais:

```env
# === MODELOS DE IA (Configure pelo menos um) ===
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx        # Claude 3 (Recomendado)
OPENAI_API_KEY=sk-proj-xxxxx                # GPT-4/3.5
GROQ_API_KEY=gsk_xxxxx                      # Llama 3/Mixtral

# === INTEGRAÇÕES EMPRESARIAIS ===
# WhatsApp (Evolution API v2.2.3 - Servidor Remoto)
EVOLUTION_API_URL=https://evolution.agentecortex.com
EVOLUTION_API_KEY=your-evolution-key
EVOLUTION_API_VERSION=2.2.3
EVOLUTION_WEBHOOK_URL=http://localhost:8001/api/whatsapp/webhook

# Google Calendar
GOOGLE_CALENDAR_CREDENTIALS=path/to/credentials.json

# E-mail (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Pagamentos
STRIPE_SECRET_KEY=sk_test_xxxxx
ASAAS_API_KEY=your-asaas-key

# === CONFIGURAÇÕES DO SISTEMA ===
HOST=0.0.0.0
PORT=8001
DEBUG=false
DATABASE_URL=sqlite:///./agents.db
```

## ⚡ Execução e Acesso

### 🚀 Inicialização

Após a configuração, execute:

```bash
# Método 1: Scripts automáticos
start.bat      # Windows
./start.sh     # Linux/Mac

# Método 2: Manual
cd backend
python main.py

# Método 3: Uvicorn (produção)
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 🌐 Endpoints Disponíveis

| Serviço | URL | Descrição |
|---------|-----|------------|
| **🎨 Interface Principal** | http://localhost:8005 | SPA moderna e responsiva |
| **📚 Documentação API** | http://localhost:8001/docs | Swagger/OpenAPI interativo |
| **❤️ Health Check** | http://localhost:8001/api/health | Monitor de saúde do sistema |

## 📖 Guia de Uso

### 🤖 1. Criar Agentes SDK

#### **Via Interface Web**

1. Acesse a interface principal
2. Navegue para "Criar Agente SDK"
3. Selecione a especialização:
   - **Customer Service**: Atendimento ao cliente
   - **Scheduling**: Agendamento inteligente
   - **Sales**: Vendas e conversão
4. Configure integrações (WhatsApp, Calendar, E-mail)
5. Clique em "Gerar SDK"

#### **Via API**

```bash
curl -X POST "http://localhost:8001/api/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Assistente de Vendas",
    "specialization": "sales",
    "description": "Agente para automatizar vendas via WhatsApp",
    "model": "claude-3-5-sonnet-20241022",
    "instructions": "Você é um vendedor especializado...",
    "whatsapp_config": {
      "instance_name": "vendas01"
    }
  }'
```

### 💬 2. Chat com Agentes

```python
# Exemplo de uso do SDK gerado
from generated_agent import SalesAgent

agent = SalesAgent()
response = agent.process_message(
    message="Quero saber sobre os produtos",
    user_id="123",
    context={"source": "whatsapp"}
)
print(response)
```

### 📅 3. Agendamento Inteligente

```python
# Agente com Google Calendar
agent = SchedulingAgent()
response = agent.schedule_appointment(
    message="Quero agendar uma consulta na próxima semana",
    user_email="cliente@email.com"
)
```

## 🧠 Modelos de IA Suportados

| Modelo | Provider | Código | Características |
|--------|----------|--------|------------------|
| **Claude 3 Sonnet** | Anthropic | `claude-3-sonnet-20240229` | ⭐ Equilibrio perfeito |
| **Claude 3 Haiku** | Anthropic | `claude-3-haiku-20240307` | ⚡ Rápido e eficiente |
| **GPT-4** | OpenAI | `gpt-4` | 💪 Poderoso e versátil |
| **GPT-3.5 Turbo** | OpenAI | `gpt-3.5-turbo` | 💰 Econômico |
| **Llama 3 70B** | Groq | `llama3-70b-8192` | 🔓 Open source |
| **Mixtral 8x7B** | Groq | `mixtral-8x7b-32768` | 🌍 Multilingual |

## 🔧 API Reference

### 🤖 Gestão de Agentes SDK

```bash
# Criar agente SDK
POST /api/agents/sdk/create

# Listar agentes
GET /api/agents/sdk

# Obter agente específico
GET /api/agents/sdk/{agent_id}

# Deletar agente
DELETE /api/agents/sdk/{agent_id}

# Testar agente
POST /api/agents/sdk/{agent_id}/test
```

### 💬 Sistema de Chat

```bash
# Iniciar sessão de chat
POST /api/agents/{agent_id}/chat/start

# Enviar mensagem
POST /api/chat/{session_id}/message

# Histórico da conversa
GET /api/chat/{session_id}/history

# Finalizar sessão
DELETE /api/chat/{session_id}
```

### 📱 Integrações

```bash
# WhatsApp (Evolution API)
POST /api/integrations/whatsapp/send
GET /api/integrations/whatsapp/status

# Google Calendar
POST /api/integrations/calendar/events
GET /api/integrations/calendar/available-slots

# E-mail
POST /api/integrations/email/send
GET /api/integrations/email/templates

# Pagamentos
POST /api/integrations/payments/stripe/create-payment
POST /api/integrations/payments/asaas/create-payment
```

## 🔒 Segurança e Boas Práticas

### 🛡️ Segurança Enterprise

- **Validação Rigorosa**: Pydantic models para todos os inputs
- **SQL Injection Protection**: SQLAlchemy ORM com prepared statements
- **XSS Protection**: Sanitização de dados de entrada e saída
- **CORS Configurável**: Origins específicos para produção
- **Rate Limiting**: Proteção contra abuse de API

### 🔐 Configuração de Produção

```env
# Produção
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING
SECRET_KEY=sua-chave-super-forte-256-bits
CORS_ORIGINS=https://seu-dominio.com

# Banco de dados
DATABASE_URL=postgresql://user:pass@localhost:5432/agents

# SSL/TLS
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

## 📊 Monitoramento e Logs

### 📈 Métricas Disponíveis

```bash
# Estatísticas gerais
curl http://localhost:8000/api/system/stats

# Health check detalhado
curl http://localhost:8000/health

# Logs em tempo real
tail -f app.log

# Métricas de agentes
curl http://localhost:8000/api/agents/metrics
```

### 🔍 Debugging

```env
# Ativar debug mode
DEBUG=true
LOG_LEVEL=DEBUG
DATABASE_ECHO=true
```

## 🚀 Exemplos de Código

### 📱 Agente WhatsApp + Vendas

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from services.evolution_api_service import EvolutionAPIService
from services.payment_service import PaymentManager

class WhatsAppSalesAgent:
    def __init__(self):
        self.model = Claude(id="claude-3-sonnet-20240229")
        self.whatsapp = EvolutionAPIService()
        self.payments = PaymentManager()
        
        self.agent = Agent(
            model=self.model,
            tools=[self.whatsapp, self.payments],
            instructions=[
                "Você é um vendedor especializado via WhatsApp",
                "Sempre confirme informações antes de processar pagamentos",
                "Use emojis para tornar a conversa mais amigável"
            ]
        )
    
    def process_whatsapp_message(self, message, phone_number):
        context = {"source": "whatsapp", "phone": phone_number}
        response = self.agent.run(message, context=context)
        return response
```

### 📅 Agente de Agendamento

```python
from services.calendar_service import GoogleCalendarService

class SchedulingAgent:
    def __init__(self):
        self.calendar = GoogleCalendarService()
        self.agent = Agent(
            model=Claude(id="claude-3-haiku-20240307"),
            tools=[self.calendar],
            instructions=[
                "Você é um assistente de agendamento inteligente",
                "Sempre verifique disponibilidade antes de confirmar",
                "Envie lembretes automáticos"
            ]
        )
    
    def schedule_appointment(self, message, user_email):
        return self.agent.run(message, user_email=user_email)
```

## 🔧 Desenvolvimento e Customização

### 🛠️ Adicionando Novos Serviços

1. Crie um arquivo em `backend/services/`
2. Implemente a interface de serviço
3. Adicione configurações no `.env`
4. Registre no `main.py`

```python
# backend/services/custom_service.py
class CustomService:
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def process(self, data: dict) -> dict:
        # Sua lógica personalizada
        return {"result": "processed"}
```

### 🎨 Customizando a Interface

A interface usa HTML/CSS/JS vanilla para máxima flexibilidade:

```css
/* Personalizar tema */
:root {
    --primary-color: #your-brand-color;
    --secondary-color: #your-secondary-color;
    --glass-bg: rgba(255, 255, 255, 0.1);
}
```

## 🤝 Contribuição

### 🚀 Como Contribuir

1. **Fork** o repositório
2. **Clone** sua fork: `git clone https://github.com/seu-usuario/geradorsdk.git`
3. **Branch**: `git checkout -b feature/nova-funcionalidade`
4. **Desenvolva** seguindo os padrões do projeto
5. **Teste** suas alterações
6. **Commit**: `git commit -m "feat: adiciona nova funcionalidade"`
7. **Push**: `git push origin feature/nova-funcionalidade`
8. **Pull Request** com descrição detalhada

### 📋 Guidelines de Desenvolvimento

- **Code Style**: PEP 8 para Python, ES6+ para JavaScript
- **Testes**: Adicione testes para novas funcionalidades
- **Documentação**: Atualize docs quando necessário
- **Commits**: Use conventional commits (feat:, fix:, docs:)
- **Issues**: Reporte bugs e sugira melhorias

### 🧪 Executando Testes

```bash
# Instalar dependências de teste
pip install pytest pytest-asyncio

# Executar testes
pytest tests/

# Coverage
pytest --cov=backend tests/
```

## 📄 Licença

Este projeto está licenciado sob a **MIT License**.

### ✅ Permissões
- ✅ Uso comercial
- ✅ Modificação
- ✅ Distribuição
- ✅ Uso privado

### ❌ Limitações
- ❌ Responsabilidade
- ❌ Garantia

### 📋 Condições
- 📋 Incluir licença e copyright

Veja o arquivo [LICENSE](LICENSE) para detalhes completos.

## 🔄 Migração Evolution API v2.2.3

### 📋 Mudanças Principais

- **✅ Servidor Remoto**: Evolution API agora roda em servidor dedicado
- **✅ Versão v2.2.3**: Compatibilidade com a versão mais recente
- **✅ Configuração Simplificada**: Apenas URL e API Key necessários
- **✅ Performance Melhorada**: Sem overhead de containers locais

### 🔧 Configuração Atualizada

```env
# Evolution API v2.2.3 (Servidor Remoto)
EVOLUTION_API_URL=https://evolution.agentecortex.com
EVOLUTION_API_KEY=sua_chave_api_evolution
EVOLUTION_API_VERSION=2.2.3
```

### 🚀 Benefícios da Migração

- **🔧 Manutenção Reduzida**: Sem necessidade de gerenciar containers locais
- **⚡ Performance**: Servidor dedicado otimizado
- **🔄 Atualizações Automáticas**: Sempre na versão mais recente
- **🛡️ Segurança**: Infraestrutura gerenciada profissionalmente
- **📊 Monitoramento**: Logs e métricas centralizados

### ⚠️ Notas Importantes

- **API Key**: Solicite sua chave de acesso ao administrador do sistema
- **Webhook**: Configure o webhook URL para receber eventos
- **Compatibilidade**: Totalmente compatível com versões anteriores
- **Suporte**: Documentação completa da API v2.2.3 disponível

## 🌟 Roadmap

### 🎯 v2.1 - Autenticação & Templates
- [ ] Sistema de usuários e autenticação JWT
- [ ] Biblioteca de templates de agentes
- [ ] Dashboard analytics avançado
- [ ] Multi-tenant support

### 🎯 v2.2 - Escalabilidade
- [ ] Containerização Docker completa
- [ ] Deploy Kubernetes
- [ ] Auto-scaling
- [ ] Cache Redis distribuído

### 🎯 v3.0 - AI-Powered Platform
- [ ] Meta-agents (agentes que criam agentes)
- [ ] Auto-otimização de performance
- [ ] Knowledge base compartilhada
- [ ] Aprendizado contínuo

## 📞 Suporte

### 🔧 Troubleshooting

| Problema | Solução |
|----------|---------|
| **Porta em uso** | Altere `PORT=8001` no `.env` |
| **API Key inválida** | Verifique configuração no `.env` |
| **Banco não conecta** | Verifique `DATABASE_URL` |
| **Módulo não encontrado** | Ative ambiente virtual |

### 📚 Recursos de Ajuda

- **📖 Documentação**: Consulte [SETUP.md](SETUP.md)
- **✅ Checklist**: Veja [CHECKLIST.md](CHECKLIST.md)
- **📋 Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **🐛 Issues**: [GitHub Issues](https://github.com/deveclipsy007/geradorsdk/issues)

### 💡 Comunidade

- **🌟 GitHub**: [deveclipsy007/geradorsdk](https://github.com/deveclipsy007/geradorsdk)
- **📧 E-mail**: suporte@geradorsdk.com
- **💬 Discord**: [Servidor da Comunidade](https://discord.gg/geradorsdk)

---

## 🙏 Agradecimentos

### 💎 Tecnologias Utilizadas

- **[Agno Framework](https://github.com/agno-ai/agno)** - Framework de agentes de nova geração
- **[FastAPI](https://fastapi.tiangolo.com/)** - Framework web moderno e performático
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - ORM Python enterprise
- **[Anthropic Claude](https://www.anthropic.com/)** - Modelos de IA avançados
- **[OpenAI GPT](https://openai.com/)** - Modelos GPT-4 e GPT-3.5
- **[Groq](https://groq.com/)** - Processamento ultrarrápido para Llama/Mixtral

### ❤️ Contributors

Obrigado a todos os contribuidores que tornam este projeto possível!

---

<div align="center">

**🚀 Pronto para revolucionar seus agentes inteligentes?**

[![⭐ Star no GitHub](https://img.shields.io/github/stars/deveclipsy007/geradorsdk?style=social)](https://github.com/deveclipsy007/geradorsdk)
[![🍴 Fork](https://img.shields.io/github/forks/deveclipsy007/geradorsdk?style=social)](https://github.com/deveclipsy007/geradorsdk/fork)
[![🐛 Issues](https://img.shields.io/github/issues/deveclipsy007/geradorsdk)](https://github.com/deveclipsy007/geradorsdk/issues)
[![📝 Pull Requests](https://img.shields.io/github/issues-pr/deveclipsy007/geradorsdk)](https://github.com/deveclipsy007/geradorsdk/pulls)

**[🚀 Começar Agora](SETUP.md)** | **[📚 Documentação](https://docs.geradorsdk.com)** | **[🐛 Reportar Bug](https://github.com/deveclipsy007/geradorsdk/issues)**

</div>

---

<div align="center">
<sub>Construído com ❤️ pela comunidade • Powered by Agno Framework</sub>
</div>
