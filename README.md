# 🤖 Gerador de Agentes v2.0

Sistema enterprise para criação e gerenciamento de agentes inteligentes usando o framework Agno, com persistência robusta, interface moderna e integração OCM Drizzy.

## ✨ Características Principais

### 🧠 **Criação Inteligente de Agentes**
- **Framework Agno**: Utiliza o poderoso framework Agno para agentes multi-modais
- **Múltiplos Modelos**: Claude 3 (Sonnet/Haiku), GPT-4, GPT-3.5, Llama 3, Mixtral
- **Ferramentas Avançadas**: Raciocínio, dados financeiros, busca web, Python, arquivos
- **Configuração Visual**: Interface intuitiva com tooltips e validação em tempo real

### 🗄️ **Persistência Robusta**
- **Banco de Dados**: SQLite, PostgreSQL ou MySQL com SQLAlchemy ORM
- **Histórico Completo**: Todas as conversas e execuções são salvas
- **Gestão de Sessões**: Controle automático de expiração e limpeza
- **Backup Ready**: Estrutura preparada para backups e replicação

### 🔄 **Integração OCM Drizzy**
- **Notificações Inteligentes**: Sistema completo de alertas e monitoramento
- **Webhooks Assíncronos**: Notificações não-bloqueantes em tempo real
- **Múltiplas Prioridades**: Low, Normal, High, Critical
- **Fila de Notificações**: Sistema de retry e processamento em lote

### 🎨 **Interface Moderna**
- **Design Responsivo**: Otimizada para desktop, tablet e mobile
- **Busca Avançada**: Filtros e busca em tempo real
- **Visualizações Múltiplas**: Grid e lista com controles intuitivos
- **Feedback Visual**: Loading states, progress bars e notificações toast
- **Quick Actions**: Botões flutuantes para ações rápidas

### ⚡ **Performance & Monitoramento**
- **Operações Assíncronas**: I/O não-bloqueante para máxima performance
- **Health Checks**: Monitoramento contínuo de todos os serviços
- **Métricas Detalhadas**: Estatísticas de uso e performance
- **Logs Estruturados**: Sistema avançado de logging e debugging

## 📁 Estrutura do Projeto

```
gerador-de-agentes/
├── backend/
│   ├── main.py              # 🚀 Servidor FastAPI principal
│   ├── config.py            # ⚙️ Sistema de configuração centralizada
│   ├── database.py          # 🗄️ ORM SQLAlchemy e modelos
│   ├── services.py          # 🏗️ Lógica de negócio (Agent/Chat/System)
│   ├── drizzy_integration.py # 🔄 Cliente OCM Drizzy
│   ├── agent_generator.py   # 🤖 Gerador de código Agno
│   ├── agent_executor.py    # ⚡ Executor de agentes
│   └── models.py            # 📋 Modelos Pydantic
├── frontend/
│   ├── index.html           # 🎨 Interface principal (moderna)
│   ├── styles.css           # 💎 Estilos responsivos (glassmorphism)
│   └── script.js            # ⚡ JavaScript interativo
├── .env.example             # 🔧 Template de configuração
├── SETUP.md                 # 📖 Guia completo de instalação
├── CHANGELOG.md             # 📋 Documentação de mudanças
├── CHECKLIST.md             # ✅ Lista de funcionalidades
├── start.bat                # 🖥️ Script de inicialização Windows
├── start.sh                 # 🐧 Script de inicialização Unix
├── requirements.txt         # 📦 Dependências Python
└── README.md                # 📄 Este arquivo
```

## 🚀 Instalação Rápida

### Método 1: Script Automático (Recomendado)

**Windows:**
```bash
# Execute o script de inicialização
start.bat
```

**Linux/Mac:**
```bash
# Torne o script executável e execute
chmod +x start.sh
./start.sh
```

### Método 2: Instalação Manual

#### 1. Pré-requisitos
- **Python 3.8+** (Recomendado: 3.10+)
- **pip** ou **uv** (gerenciador de pacotes)
- **Uma API Key** (Anthropic, OpenAI ou Groq)

#### 2. Configuração

```bash
# Clone ou baixe o projeto
cd gerador-de-agentes

# Crie um ambiente virtual
python -m venv venv

# Ative o ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Configure o ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

#### 3. Configuração de API Keys

Edite o arquivo `.env` e adicione pelo menos uma chave:

```env
# Anthropic Claude (Recomendado)
ANTHROPIC_API_KEY=sk-ant-api03-sua-chave-aqui

# OpenAI GPT
OPENAI_API_KEY=sk-sua-chave-openai-aqui

# Groq (Llama/Mixtral)
GROQ_API_KEY=gsk_sua-chave-groq-aqui

# OCM Drizzy (Opcional)
DRIZZY_ENABLED=true
DRIZZY_WEBHOOK_URL=https://seu-webhook-drizzy
DRIZZY_API_KEY=sua-api-key-drizzy
```

## ⚡ Execução

### Inicialização Automática
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

### Inicialização Manual
```bash
cd backend
python main.py
```

### 🌐 Acesso ao Sistema

Após inicializar, acesse:

| Serviço | URL | Descrição |
|---------|-----|------------|
| **🎨 Interface Principal** | http://localhost:8000/static/index.html | Interface web completa |
| **📚 Documentação API** | http://localhost:8000/docs | Swagger/OpenAPI interativo |
| **❤️ Health Check** | http://localhost:8000/health | Status de saúde do sistema |
| **📊 Estatísticas** | http://localhost:8000/api/system/stats | Métricas do sistema |
| **⚙️ Configurações** | http://localhost:8000/api/config | Configurações ativas |

## 📖 Como Usar

### 🤖 1. Criar um Agente

1. **Acesse a aba "Criar Agente"**
2. **Preencha as informações:**
   - **📝 Nome**: Nome descritivo (até 100 caracteres)
   - **📄 Descrição**: Propósito detalhado (até 500 caracteres)
   - **🧠 Modelo**: Claude 3, GPT-4, Llama 3, etc. (com validação de API key)
   - **🛠️ Ferramentas**: Cards interativos para seleção visual
   - **📋 Instruções**: Orientações específicas (até 1000 caracteres)
   - **⚙️ Configurações**: Raciocínio, memória, markdown
3. **Clique em "Gerar Agente"**
4. **Visualize o código** gerado com syntax highlighting
5. **Copie ou baixe** o código do agente

### 📊 2. Gerenciar Agentes

- **🔍 Busca Avançada**: Pesquise por nome ou descrição
- **📋 Visualizações**: Alterne entre grid e lista
- **📈 Estatísticas**: Veja métricas em tempo real
- **👁️ Visualizar**: Examine detalhes e código
- **🗑️ Excluir**: Remova agentes com confirmação
- **🔄 Atualizar**: Sincronize a lista automaticamente

### 💬 3. Chat com Agentes

1. **Selecione um agente** na aba "Testar Agente"
2. **Inicie o chat** - o agente é carregado automaticamente
3. **Converse naturalmente** - todas as mensagens são salvas
4. **Histórico persistente** - recupere conversas anteriores
5. **Sessões inteligentes** - expiração automática para otimização

### 📱 4. Funcionalidades Avançadas

- **⚡ Quick Actions**: Botões flutuantes para ações rápidas
- **❤️ Health Check**: Monitore a saúde do sistema
- **📊 Estatísticas**: Acesse métricas detalhadas
- **🔔 Notificações**: Sistema toast com múltiplos tipos
- **📱 Responsivo**: Interface adaptada para todos os dispositivos

## 🔧 Especificações Técnicas

### 🧠 Modelos de IA Suportados

| Modelo | Versão | Características |
|--------|--------|------------------|
| **Claude 3 Sonnet** | `claude-3-sonnet-20240229` | ⭐ Recomendado - Equilibrio perfeito |
| **Claude 3 Haiku** | `claude-3-haiku-20240307` | ⚡ Rápido e eficiente |
| **GPT-4** | `gpt-4` | 💪 Poderoso para tarefas complexas |
| **GPT-3.5 Turbo** | `gpt-3.5-turbo` | 💰 Econômico e versátil |
| **Llama 3 70B** | `llama-3-70b` | 🔓 Open source via Groq |
| **Mixtral 8x7B** | `mixtral-8x7b` | 🌍 Multilingual via Groq |

### 🛠️ Ferramentas Integradas

- **🧠 Raciocínio Avançado**: Capacidades de reasoning complexo
- **📈 Dados Financeiros**: Integração YFinance para mercados
- **🔍 Busca Web**: Pesquisas em tempo real via DuckDuckGo
- **🐍 Execução Python**: Interpretador Python integrado
- **📄 Manipulação de Arquivos**: I/O completo de arquivos

### 🌐 API Endpoints Completos

#### 🤖 Gestão de Agentes
- `POST /api/agents/create` - Criar novo agente
- `GET /api/agents` - Listar com paginação e filtros
- `GET /api/agents/search` - Busca avançada
- `GET /api/agents/{id}` - Obter agente específico
- `DELETE /api/agents/{id}` - Excluir agente
- `GET /api/agents/{id}/verify` - Verificar integridade
- `POST /api/agents/{id}/test` - Teste rápido
- `POST /api/agents/{id}/unload` - Descarregar da memória

#### 💬 Sistema de Chat
- `POST /api/agents/{id}/chat/start` - Iniciar sessão
- `POST /api/chat/{session_id}/message` - Enviar mensagem
- `GET /api/chat/{session_id}/history` - Histórico completo
- `DELETE /api/chat/{session_id}` - Finalizar sessão

#### 📊 Sistema e Monitoramento
- `GET /health` - Health check completo
- `GET /api/system/stats` - Estatísticas detalhadas
- `GET /api/config` - Configurações ativas
- `POST /api/system/maintenance` - Manutenção automática
- `POST /api/drizzy/test` - Teste integração Drizzy

### 🗄️ Persistência de Dados

- **SQLite** (padrão): Pronto para uso, zero configuração
- **PostgreSQL**: Recomendado para produção
- **MySQL**: Suporte completo via SQLAlchemy
- **Migrations**: Sistema automático de versionamento
- **Backup Ready**: Estrutura preparada para backup

## 🎨 Interface Moderna

### ✨ Design System
- **🌌 Glassmorphism**: Efeitos de vidro com blur e transparência
- **🎭 Dark Theme**: Tema escuro otimizado para desenvolvedores
- **📱 Mobile First**: Design responsivo para todos os dispositivos
- **⚡ Micro-interactions**: Animações suaves e feedback visual
- **🎯 Accessibility**: WCAG 2.1 compliant com ARIA labels

### 🔧 Funcionalidades da Interface
- **📊 Dashboard Visual**: Status do sistema em tempo real
- **🔍 Busca Inteligente**: Busca instantânea com highlighting
- **📋 Múltiplas Visualizações**: Grid e lista com controles
- **💾 Auto-save**: Salvamento automático de dados
- **🔔 Sistema de Notificações**: Toast multi-tipo com persistência
- **⚡ Quick Actions**: Botões flutuantes para ações frequentes
- **📈 Progress Tracking**: Barras de progresso e loading states
- **🎨 Syntax Highlighting**: Código com cores e formatação
- **📋 Copy/Download**: Facilita compartilhamento de código

### 🚀 Performance
- **⚡ Lazy Loading**: Carregamento sob demanda
- **🔄 Virtual Scrolling**: Listas grandes otimizadas
- **💾 Caching Inteligente**: Cache de dados e interface
- **📱 Touch Optimized**: Otimizada para dispositivos touch

## 🔒 Segurança Enterprise

### 🛡️ Validação e Sanitização
- **Pydantic Models**: Validação rigorosa de tipos e formatos
- **SQL Injection Protection**: ORM SQLAlchemy com prepared statements
- **XSS Protection**: Sanitização completa de inputs e outputs
- **Input Validation**: Limites de tamanho e formato
- **File Upload Security**: Validação de tipos e tamanhos

### 🔐 Configuração Segura
- **Environment Variables**: Secrets via .env (não commitados)
- **CORS Configurável**: Origins específicos para produção
- **API Key Validation**: Verificação em tempo real
- **Session Management**: Tokens seguros e expiração automática
- **Error Sanitization**: Logs detalhados sem exposição de dados

### 📊 Auditoria e Monitoramento
- **Activity Logging**: Todas as ações são registradas
- **Error Tracking**: Stack traces completos para debugging
- **Health Monitoring**: Verificação contínua de componentes
- **Performance Metrics**: Monitoramento de performance

## 🚀 Exemplo de Uso

```python
# Código gerado pelo sistema
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.tools.reasoning import ReasoningTools

class AssistenteFinanceiroAgent:
    def __init__(self):
        self.model = Claude(id="claude-3-sonnet-20240229")
        self.tools = [
            ReasoningTools(add_instructions=True),
        ]
        self.agent = Agent(
            model=self.model,
            tools=self.tools,
            instructions=[
                "Você é um assistente financeiro especializado",
                "Sempre use dados precisos e atualizados",
            ],
            markdown=True,
            reasoning=True,
        )
    
    def run(self, message: str, **kwargs):
        return self.agent.print_response(message, stream=True)
```

## 🤝 Contribuição

### 🚀 Como Contribuir

1. **🍴 Fork** o repositório
2. **🌿 Clone** sua fork localmente
```bash
git clone https://github.com/seu-usuario/gerador-de-agentes.git
cd gerador-de-agentes
```
3. **🌱 Crie** uma branch para sua feature
```bash
git checkout -b feature/sua-nova-funcionalidade
```
4. **💻 Desenvolva** seguindo os padrões do projeto
5. **✅ Teste** suas alterações
6. **📝 Commit** com mensagens descritivas
```bash
git commit -m "feat: adiciona funcionalidade X"
```
7. **🚀 Push** para sua branch
```bash
git push origin feature/sua-nova-funcionalidade
```
8. **🔄 Abra** um Pull Request

### 📋 Guidelines

- **Code Style**: Siga PEP 8 para Python e ES6+ para JavaScript
- **Testes**: Adicione testes para novas funcionalidades
- **Documentação**: Atualize documentação quando necessário
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Issues**: Reporte bugs e sugira melhorias via Issues

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para detalhes.

### 🤝 Uso Comercial

- ✅ **Uso comercial permitido**
- ✅ **Modificação e distribuição livre**
- ✅ **Uso em projetos proprietários**
- ⚠️ **Sem garantias expressas ou implícitas**
- 📋 **Manter créditos originais**

---

## 🌟 Agradecimentos

### 💎 Tecnologias Utilizadas

- **[Agno](https://github.com/agno-ai/agno)** - Framework de agentes inteligentes
- **[FastAPI](https://fastapi.tiangolo.com/)** - Framework web moderno e rápido
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - ORM Python de alta qualidade
- **[Anthropic Claude](https://www.anthropic.com/)** - Modelos de linguagem avançados
- **[OpenAI](https://openai.com/)** - GPT e tecnologias de IA
- **[Groq](https://groq.com/)** - Processamento de IA ultrarrápido

### ❤️ Comunidade

Obrigado a todos os contribuidores, usuários e à comunidade open source que torna projetos como este possíveis.

---

<div align="center">

**🚀 Pronto para criar agentes inteligentes? [Comece agora!](SETUP.md)**

[![GitHub stars](https://img.shields.io/github/stars/seu-usuario/gerador-de-agentes?style=social)](https://github.com/seu-usuario/gerador-de-agentes)
[![GitHub forks](https://img.shields.io/github/forks/seu-usuario/gerador-de-agentes?style=social)](https://github.com/seu-usuario/gerador-de-agentes/fork)
[![GitHub issues](https://img.shields.io/github/issues/seu-usuario/gerador-de-agentes)](https://github.com/seu-usuario/gerador-de-agentes/issues)

**✨ Se este projeto foi útil, considere dar uma ⭐ star!**

</div>

## 🆘 Suporte e Troubleshooting

### 🔧 Verificações Básicas

1. **🐍 Python**: Verifique se Python 3.8+ está instalado
2. **📦 Dependências**: Execute `pip install -r requirements.txt`
3. **🔑 API Keys**: Verifique configuração no `.env`
4. **💾 Banco**: Deixe o sistema criar o banco automaticamente

### 🔍 Debugging

```bash
# Health Check
curl http://localhost:8000/health

# Verificar configuração
curl http://localhost:8000/api/config

# Ver logs
tail -f app.log

# Estatísticas do sistema
curl http://localhost:8000/api/system/stats
```

### 🐛 Problemas Comuns

| Problema | Solução |
|----------|----------|
| **Porta em uso** | Altere `PORT=8001` no `.env` |
| **API Key inválida** | Verifique as chaves no `.env` |
| **Banco não conecta** | Verifique `DATABASE_URL` |
| **Módulo não encontrado** | Ative o ambiente virtual |

### 📞 Canais de Suporte

- **📖 Documentação**: Consulte `SETUP.md` para guia completo
- **✅ Checklist**: Veja `CHECKLIST.md` para funcionalidades
- **📋 Changelog**: Consulte `CHANGELOG.md` para mudanças
- **🐛 Issues**: Reporte problemas no GitHub
- **💡 Discussions**: Perguntas e sugestões

## 🔮 Roadmap v2.1+

### 🎯 Próximas Funcionalidades

#### v2.1 - Autenticação e Templates
- [ ] **👤 Sistema de Usuários**: Login, registro e perfis
- [ ] **📋 Templates de Agentes**: Biblioteca de templates prontos
- [ ] **📊 Dashboard Analytics**: Métricas avançadas de uso
- [ ] **🔐 Autenticação JWT**: Sistema de tokens seguro
- [ ] **👥 Multi-tenant**: Suporte para múltiplas organizações

#### v2.2 - Escalabilidade
- [ ] **🐳 Docker Support**: Containerização completa
- [ ] **☸️ Kubernetes**: Deploy para produção
- [ ] **📈 Auto-scaling**: Escalabilidade automática
- [ ] **🗄️ Redis Cache**: Cache distribuído
- [ ] **📊 Prometheus/Grafana**: Monitoramento avançado

#### v2.3 - Extensibilidade
- [ ] **🧩 Plugin System**: Extensões de terceiros
- [ ] **🔗 Webhooks Customizados**: Integrações personalizadas
- [ ] **🤖 Agent Marketplace**: Compartilhamento de agentes
- [ ] **🔄 CI/CD Integration**: Integração com pipelines
- [ ] **📱 Mobile App**: Aplicativo nativo

#### v3.0 - AI-Powered Platform
- [ ] **🤖 Meta-Agents**: Agentes que criam outros agentes
- [ ] **🧠 Auto-optimization**: Otimização automática de performance
- [ ] **📚 Knowledge Base**: Base de conhecimento compartilhada
- [ ] **🎓 Learning System**: Aprendizado contínuo dos agentes
- [ ] **🌐 Multi-language**: Suporte para múltiplas linguagens

### 🏆 Objetivos de Longo Prazo

- **🌟 Torna-se a plataforma de referência** para criação de agentes
- **🚀 Suporte enterprise** com SLA e suporte técnico
- **🌍 Comunidade ativa** de desenvolvedores e usuários
- **🔬 Pesquisa & Desenvolvimento** em parceria com universidades
- **📈 Marketplace** de extensões e integrações
