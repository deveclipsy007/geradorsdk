# PROMPT PARA IDE DE IA — GERADOR DE AGENTES (AGNO + FASTAPI + UI WEB + OCM DRIZZY)

## Papel
Você é uma IDE de IA responsável por **gerar um projeto completo** (frontend + backend) de um **Gerador de Agentes** usando **Agno** no backend Python, com **UI web em HTML/CSS/JavaScript** e integração preparada com o **OCM Drizzy** (via stub de notificação). Entregue **código pronto para rodar** e **instruções de execução**.

---
## Objetivo
Criar uma aplicação que permita **criar, listar, configurar, orquestrar e executar agentes** de IA do **Agno** por meio de uma **interface web** simples, comunicando-se com um **backend FastAPI**. A solução deve suportar **equipes de agentes**, **ferramentas** (p. ex. DuckDuckGo e Tavily), e expor endpoints REST para criação e execução. A integração com o **OCM Drizzy** deve estar preparada via uma função `notify_ocm(...)` (stub), de forma desacoplada.

---
## Arquitetura de Alto Nível
- **Frontend**: HTML + CSS + JavaScript puro (sem frameworks). Usa `fetch` para consumir a API.
- **Backend**: Python 3.11+ com **FastAPI**, **Pydantic** (v2), **Uvicorn**, **Agno**.
- **Persistência**: Configurações em memória (MVP) com **opção** de extensão para SQLite; o Agno mantém dados localmente por padrão.
- **Integração**: Função `notify_ocm(event_type, payload)` que hoje apenas **loga/imprime** eventos (`agent_created`, `agent_run`). Em produção, trocar por HTTP/fila.
- **Comunicação**: REST/JSON; CORS habilitado para `http://localhost:5173` e `http://localhost:5500` (e `http://localhost:8000` para testes cruzados).

---
## Entregáveis (estrutura de pastas)
Crie os arquivos abaixo **exatamente com estes caminhos**:
```
/README.md
/requirements.txt
/backend/main.py
/backend/models.py
/backend/ocm_stub.py
/frontend/index.html
/frontend/styles.css
/frontend/script.js
/.env.example
```

---
## Dependências (mínimo)
- **Backend**: `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `httpx` (opcional), `agno` (framework de agentes), `duckduckgo_search` (se usado), `tavily-python` (se usado).
- **Frontend**: apenas HTML/CSS/JS puros.

No `requirements.txt`, inclua versões estáveis e compatíveis.

---
## Modelos de Dados (Pydantic v2)
Crie em `backend/models.py`:
- `ToolConfig`:
  - `type`: `Literal["DuckDuckGo", "Tavily"]`
  - `params`: `dict[str, Any] | None = None` (ex.: profundidade de busca)
- `AgentConfig`:
  - `name: str` (obrigatório)
  - `role: str` (obrigatório)
  - `instructions: str` (obrigatório)
  - `model: str` (ex.: `"gpt-4o"`, obrigatório)
  - `api_key: str | None = None` (opcional; se não vier, usar `OPENAI_API_KEY` do ambiente)
  - `tools: list[ToolConfig] = []`
  - `team_ids: list[str] = []` (IDs de agentes membros)
  - `show_tool_calls: bool = True`
  - `markdown: bool = True`
- `RunRequest`:
  - `prompt: str` (obrigatório)
  - `stream: bool = False` (não implementar streaming neste MVP; apenas campo)
- `AgentInfo` (para resposta ao cliente):
  - `id: str`, `name: str`, `role: str`, `model: str`, `tools: list[str]`, `team_ids: list[str]`

---
## Backend (FastAPI + Agno)
Implemente em `backend/main.py`:
1. **App FastAPI** com CORS configurado.
2. **Armazenamento em memória** de agentes (`dict[str, Agent]` e `dict[str, AgentInfo]`).
3. **Instanciação de modelo**: função `instantiate_model(model_id: str, api_key: str | None)` que retorna um objeto de modelo do Agno. Se `api_key` ausente, use `os.environ["OPENAI_API_KEY"]`.
4. **Instanciação de ferramenta**: `instantiate_tool(cfg: ToolConfig)` com suporte a `DuckDuckGo` e `Tavily` (ler `cfg.params`).
5. **Criação de agente**: endpoint `POST /agents` recebendo `AgentConfig`:
   - Resolve `model` e `tools`.
   - Se `team_ids` vier, monte uma equipe passando a lista de subagentes (instâncias já existentes) ao parâmetro `team` do construtor do Agno.
   - Construa o agente com `name`, `role`, `instructions`, `model`, `tools`, `team`, `show_tool_calls`, `markdown`.
   - Gere `UUID4` como `id`, salve instância e um `AgentInfo` resumido.
   - Chame `notify_ocm("agent_created", {...})`.
   - **Resposta**: `AgentInfo` do agente criado.
6. **Listagem**: `GET /agents` retorna `list[AgentInfo]`.
7. **Execução**: `POST /agents/{agent_id}/run` com `RunRequest`:
   - Executa o agente **de forma síncrona** com o `prompt` e retorna o `text` da resposta.
   - Chame `notify_ocm("agent_run", {...})`.
8. **Saúde**: `GET /health` retorna `{status: "ok"}`.

Crie `backend/ocm_stub.py` com `notify_ocm(event_type: str, payload: dict) -> None` (apenas `print`/`logging`).

**Observações de segurança**:
- **Não** persista `api_key` no frontend ou em logs; use somente no backend.
- Valide tamanho de `instructions` e sanitize inputs básicos.

---
## Frontend (HTML/CSS/JS)
Implemente em `/frontend`:
- **index.html**:
  - Formulário com campos: `name`, `role`, `instructions` (textarea), `model` (select), `api_key` (opcional), `tools` (checkboxes + campos dinâmicos de parâmetros), `show_tool_calls` (checkbox), `markdown` (checkbox), `team_ids` (multi-select populado com agentes existentes).
  - Seção **Lista de Agentes** (cards) renderizando `name`, `role`, `model`, `tools`.
  - Campo de **prompt** + botão **Executar** para um agente selecionado; exibir resposta.
- **styles.css**: layout limpo, responsivo, com estados de carregamento e erros.
- **script.js**:
  - Configuração de `BASE_URL` (ex.: `http://localhost:8000`).
  - `loadAgents()` → GET `/agents` para popular lista e o multi-select `team_ids`.
  - `createAgent(payload)` → POST `/agents` com body `AgentConfig`.
  - `runAgent(agentId, prompt)` → POST `/agents/{id}/run`.
  - Reset e feedback visual após criação; tratamento de erros com mensagens claras.

---
## Formato da Resposta (muito importante)
**Entregue o projeto em UMA ÚNICA RESPOSTA**, segmentando por arquivos assim:
```
```path:/README.md
# conteúdo do arquivo
```
```path:/requirements.txt
# conteúdo
```
... (demais arquivos)
```
> Use exatamente o marcador `path:` para cada bloco de código. Não inclua explicações fora dos arquivos, exceto um curto aviso inicial “Build gerado”.

---
## Execução Local
- `.env.example` com `OPENAI_API_KEY=` e, opcionalmente, `TAVILY_API_KEY=`.
- Comandos:
  - `python -m venv .venv && source .venv/bin/activate` (Windows: `.venv\\Scripts\\activate`)
  - `pip install -r requirements.txt`
  - `uvicorn backend.main:app --reload --port 8000`
  - Servir `frontend` com um servidor estático simples (ex.: `python -m http.server 5500` dentro da pasta `frontend`).

---
## Critérios de Aceitação (teste rápido)
1. **Criação**: Preencher formulário e criar agente `Researcher-1`. Ele aparece na lista e pode ser selecionado.
2. **Equipe**: Criar `Writer-1`; depois criar `Coordinator-1` com `team_ids=[Researcher-1, Writer-1]`. A listagem mostra os três.
3. **Ferramentas**: Criar agente com `DuckDuckGo` e/ou `Tavily` (com parâmetros). A criação não falha.
4. **Execução**: Selecionar `Coordinator-1`, enviar prompt → resposta textual exibida.
5. **OCM Stub**: Ao criar/executar, o console do backend registra eventos `agent_created`/`agent_run`.
6. **Saúde**: `GET /health` retorna `{status:"ok"}`.

---
## Requisitos Não-Funcionais
- **Código limpo** com tipagem, docstrings e separação de camadas.
- **Resiliência**: tratar erros de rede/API e informar o usuário.
- **Escalabilidade**: design desacoplado; fácil ativar **streaming** (SSE/WebSocket) futuramente.
- **Privacidade**: nenhuma chave/sigilo no frontend; nada de telemetry oculta.

---
## Regras de Negócio e UX
- `name` e `role` são obrigatórios para clareza nos logs e na organização de equipes.
- `instructions` deve orientar claramente o fluxo e as ferramentas obrigatórias.
- Multi-seleção de `team_ids` deve evitar auto-referência (um agente não pode ser equipe de si mesmo).
- Feedback visual (loading/success/error) em todas as operações.

---
## Observações Finais
- Não utilizar frameworks no frontend.
- Não implementar streaming neste MVP; mantenha o campo `stream` para compatibilidade.
- Prepare o código para fácil persistência futura (ex.: trocar o dicionário em memória por SQLite com um repositório).

> **Entregue agora o código seguindo o formato de arquivos definido acima.**

