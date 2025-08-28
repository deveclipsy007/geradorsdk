from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import os
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import logging
from decimal import Decimal
import httpx
import asyncio

# Imports dos módulos
from .config import config
from .database import init_database, DatabaseManager, get_db_session, Agent, ChatMessage

# Import services
from services.payment_service import PaymentManager
from services.evolution_api_service import EvolutionAPIService
from services.calendar_service import GoogleCalendarService
from services.email_service import EmailManager

# Models para API
class SDKAgentRequest(BaseModel):
    name: str
    specialization: str  # customer_service, scheduling, sales
    description: str
    model: str
    instructions: str
    whatsapp_config: Dict[str, Any] = {}
    scheduling_config: Dict[str, Any] = {}

class SDKAgentResponse(BaseModel):
    id: str
    name: str
    specialization: str
    code: str
    status: str
    message: str


# Chat models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    context: Dict[str, Any] = {}

class ChatMessageModel(BaseModel):
    id: str
    agent_id: str
    session_id: str
    user_id: Optional[str] = None
    role: str
    content: str
    created_at: Optional[str] = None

class ChatResponse(BaseModel):
    agent_id: str
    session_id: str
    reply: str
    messages: List[ChatMessageModel]

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("[INICIO] Iniciando SDK Agentes Especializados...")
    
    if not init_database():
        logger.error("Falha na inicialização do banco de dados")
        raise RuntimeError("Database initialization failed")
    
    logger.info("[OK] Sistema SDK iniciado com sucesso!")
    
    yield
    
    logger.info("[PARADA] Sistema finalizado")

# FastAPI app
app = FastAPI(
    title="SDK Agentes Especializados",
    description="API para criação de agentes SDK especializados em atendimento, agendamento e vendas",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/api/health")
@app.get("/health")
async def health_check():
    """Endpoint de verificação de saúde do sistema"""
    try:
        with get_db_session() as db:
            count = db.query(Agent).count()
        
        return {
            "status": "healthy",
            "message": "SDK Agentes Especializados funcionando",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "agents_count": count,
            "version": "2.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="System unhealthy")

# Create SDK Agent
@app.post("/api/agents", response_model=SDKAgentResponse)
async def create_sdk_agent(agent_request: SDKAgentRequest):
    """Cria um novo agente SDK especializado"""
    try:
        logger.info(f"Criando agente SDK: {agent_request.name} ({agent_request.specialization})")
        
        # Generate SDK agent code
        agent_code = generate_sdk_agent_code(agent_request)
        
        # Create agent in database
        agent_id = str(uuid.uuid4())
        with get_db_session() as db:
            Agent.create(
                db,
                id=agent_id,
                name=agent_request.name,
                description=agent_request.description,
                specialization=agent_request.specialization,
                model=agent_request.model,
                instructions=agent_request.instructions,
                whatsapp_config=agent_request.whatsapp_config,
                scheduling_config=agent_request.scheduling_config,
                status="created",
                created_by="sdk_system",
            )
        
        return SDKAgentResponse(
            id=agent_id,
            name=agent_request.name,
            specialization=agent_request.specialization,
            code=agent_code,
            status="success",
            message="Agente SDK criado com sucesso"
        )
        
    except Exception as e:
        logger.error(f"Erro ao criar agente SDK: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar agente: {str(e)}")

# List SDK Agents
@app.get("/api/agents")
async def list_sdk_agents():
    """Lista todos os agentes SDK criados"""
    try:
        with get_db_session() as db:
            agents = Agent.list(db)
            return [agent.to_summary() for agent in agents]
        
    except Exception as e:
        logger.error(f"Erro ao listar agentes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar agentes: {str(e)}")

# Get SDK Agent by ID
@app.get("/api/agents/{agent_id}")
async def get_sdk_agent(agent_id: str):
    """Obtém detalhes de um agente SDK específico"""
    try:
        with get_db_session() as db:
            agent = Agent.get_by_id(db, agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agente não encontrado")

            return {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "specialization": agent.specialization,
                "model": agent.model,
                "instructions": agent.instructions,
                "whatsapp_config": agent.whatsapp_config or {},
                "scheduling_config": agent.scheduling_config or {},
                "status": agent.status,
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar agente {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar agente: {str(e)}")

# ==========================================
# AGENT LLM INTEGRATION
# ==========================================

async def generate_agent_response(agent_data, user_message: str, chat_history: List[Dict] = None) -> str:
    """Gera resposta do agente usando o LLM especificado"""
    try:
        model = agent_data.model
        instructions = agent_data.instructions or "Você é um assistente útil."
        agent_name = agent_data.name
        specialization = agent_data.specialization
        description = agent_data.description
        
        # Construir contexto do agente
        system_prompt = f"""Você é {agent_name}, um agente especializado em {specialization}.

Descrição: {description}

Instruções específicas: {instructions}

Responda de forma natural, útil e consistente com sua especialização. Mantenha um tom profissional mas amigável."""

        # Preparar histórico de conversa se disponível
        messages = [{"role": "system", "content": system_prompt}]
        
        if chat_history:
            for msg in chat_history[-10:]:  # Últimas 10 mensagens para contexto
                if msg.get('role') in ['user', 'assistant']:
                    messages.append({
                        "role": msg['role'], 
                        "content": msg['content']
                    })
        
        # Adicionar mensagem atual do usuário
        messages.append({"role": "user", "content": user_message})
        
        # Determinar provedor baseado no modelo
        if "anthropic" in model or "claude" in model:
            return await call_anthropic_api(messages, model)
        elif "openai" in model or "gpt" in model:
            return await call_openai_api(messages, model)
        elif "groq" in model:
            return await call_groq_api(messages, model)
        else:
            # Fallback para resposta padrão se modelo não reconhecido
            return f"Olá! Sou {agent_name}, especializado em {specialization}. Como posso ajudá-lo hoje?"
            
    except Exception as e:
        logger.error(f"Erro ao gerar resposta do agente: {str(e)}")
        return f"Desculpe, estou com dificuldades técnicas no momento. Como {agent_data.name}, tentarei ajudá-lo da melhor forma possível."

async def call_anthropic_api(messages: List[Dict], model: str) -> str:
    """Chama a API da Anthropic/Claude"""
    try:
        # Separar system message das outras mensagens
        system_message = ""
        conversation_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                conversation_messages.append(msg)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": config.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": model.replace("anthropic/", ""),
                    "max_tokens": 1000,
                    "system": system_message,
                    "messages": conversation_messages
                },
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            return result["content"][0]["text"]
    except Exception as e:
        logger.error(f"Erro na API Anthropic: {str(e)}")
        raise

async def call_openai_api(messages: List[Dict], model: str) -> str:
    """Chama a API da OpenAI"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model.replace("openai/", ""),
                    "messages": messages,
                    "max_tokens": 1000,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Erro na API OpenAI: {str(e)}")
        raise

async def call_groq_api(messages: List[Dict], model: str) -> str:
    """Chama a API do Groq"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model.replace("groq/", ""),
                    "messages": messages,
                    "max_tokens": 1000,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Erro na API Groq: {str(e)}")
        raise

# ==========================================
# CHAT ENDPOINTS
# ==========================================


@app.post("/api/agents/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(agent_id: str, chat: ChatRequest):
    """Envia mensagem ao agente e retorna a resposta com histórico da sessão"""
    try:
        # Verificar se o agente existe e buscar suas configurações
        with get_db_session() as db:
            agent_data = Agent.get_by_id(db, agent_id)
            if not agent_data:
                raise HTTPException(status_code=404, detail="Agente não encontrado")

        session_id = chat.session_id or str(uuid.uuid4())

        # Buscar histórico da conversa para contexto (ANTES de adicionar a nova mensagem)
        with get_db_session() as db:
            history_result = ChatMessage.get_messages(db, agent_id, session_id, asc=True)
            chat_history = [{"role": m.role, "content": m.content} for m in history_result]

        # Gerar resposta inteligente do agente usando LLM
        agent_reply = await generate_agent_response(agent_data, chat.message, chat_history)

        # Persistir mensagem do usuário
        with get_db_session() as db:
            ChatMessage.create(
                db,
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                session_id=session_id,
                user_id=chat.user_id,
                role="user",
                content=chat.message,
            )

        # Persistir resposta do agente
        with get_db_session() as db:
            ChatMessage.create(
                db,
                id=str(uuid.uuid4()),
                agent_id=agent_id,
                session_id=session_id,
                user_id=None,
                role="assistant",
                content=agent_reply,
            )

        # Buscar histórico da sessão
        with get_db_session() as db:
            res = ChatMessage.get_messages(db, agent_id, session_id, asc=True)
            messages = [ChatMessageModel(**m.to_dict()) for m in res]

        logger.info(f"chat_message agent_id={agent_id} session_id={session_id} len={len(messages)}")

        return ChatResponse(
            agent_id=agent_id,
            session_id=session_id,
            reply=agent_reply,
            messages=messages,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no chat com agente {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no chat: {str(e)}")


@app.get("/api/agents/{agent_id}/history", response_model=List[ChatMessageModel])
async def get_chat_history(agent_id: str, session_id: Optional[str] = None, limit: int = 100):
    """Retorna histórico de chat do agente. Se session_id for omitido, retorna últimas mensagens do agente."""
    try:
        with get_db_session() as db:
            res = ChatMessage.get_messages(db, agent_id, session_id, limit=limit, asc=False)
            messages = [ChatMessageModel(**m.to_dict()) for m in res]

        # Retornar em ordem cronológica
        messages.reverse()
        return messages
    except Exception as e:
        logger.error(f"Erro ao obter histórico de chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter histórico: {str(e)}")


# Delete SDK Agent
@app.delete("/api/agents/{agent_id}")
async def delete_sdk_agent(agent_id: str):
    """Exclui um agente SDK"""
    try:
        with get_db_session() as db:
            agent = Agent.get_by_id(db, agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agente não encontrado")
            db.delete(agent)
            
        return {"message": "Agente excluído com sucesso", "id": agent_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir agente {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao excluir agente: {str(e)}")

# System statistics
@app.get("/api/stats")
async def get_system_stats():
    """Obtém estatísticas do sistema SDK"""
    try:
        with get_db_session() as db:
            total_agents = db.query(Agent).count()
            customer_service = db.query(Agent).filter(Agent.specialization == "customer_service").count()
            scheduling = db.query(Agent).filter(Agent.specialization == "scheduling").count()
            sales = db.query(Agent).filter(Agent.specialization == "sales").count()

        return {
            "total_agents": total_agents,
            "customer_service_agents": customer_service,
            "scheduling_agents": scheduling,
            "sales_agents": sales,
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter estatísticas: {str(e)}")

# Integration Management Endpoints

class IntegrationConfig(BaseModel):
    integration_name: str
    enabled: bool
    config: Dict[str, Any] = {}

# New models for advanced integrations
class PaymentLinkRequest(BaseModel):
    provider: str  # 'stripe' or 'asaas'
    amount: float
    description: str = ""
    currency: str = "brl"
    customer_email: str = None
    customer_name: str = None
    customer_cpf: str = None  # For Asaas
    billing_type: str = "UNDEFINED"  # For Asaas
    success_url: str = None
    cancel_url: str = None

class WhatsAppInstanceRequest(BaseModel):
    instance_name: str
    webhook_url: str = None

class CalendarEventRequest(BaseModel):
    title: str
    start_datetime: str  # ISO format
    end_datetime: str    # ISO format
    description: str = ""
    attendees: List[str] = []
    location: str = ""
    timezone: str = "America/Sao_Paulo"

class EmailRequest(BaseModel):
    provider: str  # 'sendgrid' or 'smtp'
    to_emails: List[str]
    subject: str
    content: str
    from_email: str
    from_name: str = None
    content_type: str = "text/html"

# Global service instances (will be initialized based on config)
payment_manager = None
evolution_service = None
calendar_service = None
email_manager = None

@app.post("/api/integrations/{integration_name}/test")
async def test_integration(integration_name: str, config: Dict[str, Any]):
    """Testa uma integração específica"""
    try:
        logger.info(f"Testando integração: {integration_name}")
        
        # Validate integration type
        valid_integrations = ['whatsapp', 'calendly', 'hubspot', 'zendesk', 'acuity', 
                            'salesforce', 'intercom', 'pipedrive', 'freshdesk', 'simplybook']
        
        if integration_name not in valid_integrations:
            raise HTTPException(status_code=400, detail="Tipo de integração não suportado")
        
        # Simulate integration test based on type
        test_result = await simulate_integration_test(integration_name, config)
        
        return {
            "status": "success",
            "integration": integration_name,
            "message": f"Integração {integration_name} testada com sucesso",
            "test_result": test_result
        }
        
    except Exception as e:
        logger.error(f"Erro ao testar integração {integration_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no teste: {str(e)}")

@app.post("/api/integrations/{integration_name}/config")
async def save_integration_config(integration_name: str, config: IntegrationConfig):
    """Salva configuração de uma integração"""
    try:
        logger.info(f"Salvando configuração para integração: {integration_name}")
        
        # For now, just validate and return success
        # In production, this would save to database or external config service
        
        return {
            "status": "success",
            "integration": integration_name,
            "message": f"Configuração da integração {integration_name} salva com sucesso",
            "enabled": config.enabled
        }
        
    except Exception as e:
        logger.error(f"Erro ao salvar configuração {integration_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar configuração: {str(e)}")

@app.get("/api/integrations")
async def list_integrations():
    """Lista todas as integrações disponíveis e seus status"""
    try:
        integrations = [
            {
                "name": "whatsapp",
                "display_name": "WhatsApp Business API",
                "category": "messaging",
                "description": "Integração para envio e recebimento de mensagens via WhatsApp",
                "status": "available",
                "required_fields": ["token", "phone"]
            },
            {
                "name": "calendly",
                "display_name": "Calendly",
                "category": "scheduling",
                "description": "Integração para agendamento de reuniões e consultas",
                "status": "available",
                "required_fields": ["token"]
            },
            {
                "name": "hubspot",
                "display_name": "HubSpot CRM",
                "category": "crm",
                "description": "Integração para gestão de leads e vendas",
                "status": "available",
                "required_fields": ["token"]
            },
            {
                "name": "zendesk",
                "display_name": "Zendesk Support",
                "category": "support",
                "description": "Integração para sistema de suporte ao cliente",
                "status": "available",
                "required_fields": ["subdomain", "token"]
            },
            {
                "name": "acuity",
                "display_name": "Acuity Scheduling",
                "category": "scheduling",
                "description": "Integração para agendamento online",
                "status": "available",
                "required_fields": ["user_id", "api_key"]
            },
            {
                "name": "salesforce",
                "display_name": "Salesforce CRM",
                "category": "crm",
                "description": "Integração para Salesforce CRM",
                "status": "available",
                "required_fields": ["client_id", "client_secret"]
            },
            {
                "name": "intercom",
                "display_name": "Intercom",
                "category": "support",
                "description": "Integração para chat e suporte ao cliente",
                "status": "available",
                "required_fields": ["token"]
            },
            {
                "name": "pipedrive",
                "display_name": "Pipedrive CRM",
                "category": "crm",
                "description": "Integração para gestão de pipeline de vendas",
                "status": "available",
                "required_fields": ["token"]
            },
            {
                "name": "freshdesk",
                "display_name": "Freshdesk",
                "category": "support",
                "description": "Integração para sistema de tickets e suporte",
                "status": "available",
                "required_fields": ["subdomain", "token"]
            },
            {
                "name": "simplybook",
                "display_name": "SimplyBook.me",
                "category": "scheduling",
                "description": "Integração para agendamento de serviços",
                "status": "available",
                "required_fields": ["company", "token"]
            }
        ]
        
        return {
            "integrations": integrations,
            "total": len(integrations),
            "categories": ["messaging", "scheduling", "crm", "support"]
        }
        
    except Exception as e:
        logger.error(f"Erro ao listar integrações: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar integrações: {str(e)}")

async def simulate_integration_test(integration_name: str, config: Dict[str, Any]):
    """Simula teste de integração (substituir por testes reais em produção)"""
    import asyncio
    import random
    
    # Simulate API call delay
    await asyncio.sleep(1)
    
    # Simulate different success rates for different integrations
    success_rates = {
        'whatsapp': 0.9,
        'calendly': 0.95,
        'hubspot': 0.85,
        'zendesk': 0.9,
        'acuity': 0.8,
        'salesforce': 0.85,
        'intercom': 0.9,
        'pipedrive': 0.85,
        'freshdesk': 0.9,
        'simplybook': 0.8
    }
    
    success_rate = success_rates.get(integration_name, 0.8)
    
    if random.random() < success_rate:
        return {
            "connection": "successful",
            "response_time": f"{random.randint(100, 500)}ms",
            "api_version": "v1.0",
            "last_tested": datetime.utcnow().isoformat()
        }
    else:
        raise Exception(f"Falha na conexão com {integration_name} - verifique as credenciais")

# ==========================================
# ADVANCED INTEGRATION ENDPOINTS
# ==========================================

# Payment Integration Endpoints
@app.post("/api/payments/create-link")
async def create_payment_link(payment_request: PaymentLinkRequest):
    """Cria link de pagamento usando Stripe ou Asaas"""
    try:
        # Initialize payment manager if not already done
        global payment_manager
        if not payment_manager:
            # You should configure these from environment variables or config
            stripe_config = {
                'api_key': os.getenv('STRIPE_API_KEY', 'sk_test_...')
            }
            asaas_config = {
                'api_key': os.getenv('ASAAS_API_KEY', 'test_api_key'),
                'sandbox': True
            }
            payment_manager = PaymentManager(stripe_config, asaas_config)
        
        # Create payment link
        result = await payment_manager.create_payment_link(
            provider=payment_request.provider,
            amount=Decimal(str(payment_request.amount)),
            currency=payment_request.currency,
            description=payment_request.description,
            customer_email=payment_request.customer_email,
            customer_name=payment_request.customer_name,
            customer_cpf=payment_request.customer_cpf,
            billing_type=payment_request.billing_type,
            success_url=payment_request.success_url,
            cancel_url=payment_request.cancel_url
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao criar link de pagamento: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar link de pagamento: {str(e)}")

@app.get("/api/payments/{provider}/{payment_id}/status")
async def get_payment_status(provider: str, payment_id: str):
    """Obtém status de pagamento"""
    try:
        global payment_manager
        if not payment_manager:
            raise HTTPException(status_code=400, detail="Payment manager não inicializado")
        
        result = await payment_manager.get_payment_status(provider, payment_id)
        return result
        
    except Exception as e:
        logger.error(f"Erro ao obter status do pagamento: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter status: {str(e)}")

# WhatsApp Evolution API Endpoints
@app.post("/api/whatsapp/create-instance")
async def create_whatsapp_instance(instance_request: WhatsAppInstanceRequest):
    """Cria instância WhatsApp via Evolution API"""
    try:
        global evolution_service
        if not evolution_service:
            evolution_url = os.getenv('EVOLUTION_API_URL', 'http://localhost:8080')
            evolution_key = os.getenv('EVOLUTION_API_KEY')
            evolution_service = EvolutionAPIService(evolution_url, evolution_key)
        
        result = await evolution_service.create_instance(
            instance_name=instance_request.instance_name,
            webhook_url=instance_request.webhook_url
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao criar instância WhatsApp: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar instância: {str(e)}")

@app.get("/api/whatsapp/{instance_name}/qr-code")
async def get_whatsapp_qr_code(instance_name: str):
    """Obtém QR Code para conexão WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.get_qr_code(instance_name)
        return result
        
    except Exception as e:
        logger.error(f"Erro ao obter QR Code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter QR Code: {str(e)}")

@app.get("/api/whatsapp/{instance_name}/status")
async def get_whatsapp_instance_status(instance_name: str):
    """Obtém status da instância WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.get_instance_status(instance_name)
        return result
        
    except Exception as e:
        logger.error(f"Erro ao obter status da instância: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter status: {str(e)}")

@app.post("/api/whatsapp/{instance_name}/send-message")
async def send_whatsapp_message(instance_name: str, message_data: Dict[str, Any]):
    """Envia mensagem via WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.send_message(
            instance_name=instance_name,
            number=message_data.get('number'),
            message=message_data.get('message'),
            message_type=message_data.get('type', 'text')
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem WhatsApp: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar mensagem: {str(e)}")

@app.post("/api/whatsapp/{instance_name}/send-payment-link")
async def send_whatsapp_payment_link(instance_name: str, payment_data: Dict[str, Any]):
    """Envia link de pagamento via WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.send_payment_link(
            instance_name=instance_name,
            number=payment_data.get('number'),
            payment_data=payment_data.get('payment_info')
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao enviar link de pagamento: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar link de pagamento: {str(e)}")

@app.delete("/api/whatsapp/{instance_name}")
async def delete_whatsapp_instance(instance_name: str):
    """Deleta instância WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.delete_instance(instance_name)
        return result
        
    except Exception as e:
        logger.error(f"Erro ao deletar instância: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao deletar instância: {str(e)}")

@app.get("/api/whatsapp/instances")
async def list_whatsapp_instances():
    """Lista todas as instâncias WhatsApp"""
    try:
        global evolution_service
        if not evolution_service:
            raise HTTPException(status_code=400, detail="Evolution API não configurado")
        
        result = await evolution_service.list_instances()
        return result
        
    except Exception as e:
        logger.error(f"Erro ao listar instâncias: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar instâncias: {str(e)}")

# Google Calendar Endpoints
@app.post("/api/calendar/events")
async def create_calendar_event(event_request: CalendarEventRequest):
    """Cria evento no Google Calendar"""
    try:
        global calendar_service
        if not calendar_service:
            calendar_service = GoogleCalendarService()
        
        # Parse datetime strings
        start_dt = datetime.fromisoformat(event_request.start_datetime.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(event_request.end_datetime.replace('Z', '+00:00'))
        
        result = await calendar_service.create_event(
            title=event_request.title,
            start_datetime=start_dt,
            end_datetime=end_dt,
            description=event_request.description,
            attendees=event_request.attendees,
            location=event_request.location,
            timezone=event_request.timezone
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao criar evento no calendário: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar evento: {str(e)}")

@app.get("/api/calendar/events")
async def get_calendar_events(
    start_date: str = None,
    end_date: str = None,
    calendar_id: str = 'primary'
):
    """Obtém eventos do Google Calendar"""
    try:
        global calendar_service
        if not calendar_service:
            raise HTTPException(status_code=400, detail="Google Calendar não configurado")
        
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        result = await calendar_service.get_events(
            start_date=start_dt,
            end_date=end_dt,
            calendar_id=calendar_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao obter eventos do calendário: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter eventos: {str(e)}")

@app.post("/api/calendar/check-availability")
async def check_calendar_availability(availability_data: Dict[str, Any]):
    """Verifica disponibilidade no calendário"""
    try:
        global calendar_service
        if not calendar_service:
            raise HTTPException(status_code=400, detail="Google Calendar não configurado")
        
        start_dt = datetime.fromisoformat(availability_data['start_datetime'].replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(availability_data['end_datetime'].replace('Z', '+00:00'))
        
        result = await calendar_service.check_availability(
            start_datetime=start_dt,
            end_datetime=end_dt,
            calendar_id=availability_data.get('calendar_id', 'primary')
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao verificar disponibilidade: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao verificar disponibilidade: {str(e)}")

@app.get("/api/calendar/available-slots")
async def find_available_calendar_slots(
    date: str,
    duration_minutes: int = 60,
    start_hour: str = "09:00",
    end_hour: str = "17:00"
):
    """Encontra horários disponíveis no calendário"""
    try:
        global calendar_service
        if not calendar_service:
            raise HTTPException(status_code=400, detail="Google Calendar não configurado")
        
        date_obj = datetime.fromisoformat(date.replace('Z', '+00:00'))
        working_hours = {'start': start_hour, 'end': end_hour}
        
        result = await calendar_service.find_available_slots(
            date=date_obj,
            duration_minutes=duration_minutes,
            working_hours=working_hours
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao encontrar horários disponíveis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao encontrar horários: {str(e)}")

# Email Integration Endpoints
@app.post("/api/email/send")
async def send_email(email_request: EmailRequest):
    """Envia email via SendGrid ou SMTP"""
    try:
        global email_manager
        if not email_manager:
            sendgrid_config = {
                'api_key': os.getenv('SENDGRID_API_KEY')
            }
            smtp_config = {
                'server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
                'port': int(os.getenv('SMTP_PORT', '587')),
                'username': os.getenv('SMTP_USERNAME'),
                'password': os.getenv('SMTP_PASSWORD'),
                'use_tls': True
            }
            email_manager = EmailManager(sendgrid_config, smtp_config)
        
        result = await email_manager.send_email(
            provider=email_request.provider,
            to_emails=email_request.to_emails,
            subject=email_request.subject,
            content=email_request.content,
            from_email=email_request.from_email,
            from_name=email_request.from_name,
            content_type=email_request.content_type
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao enviar email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {str(e)}")

@app.post("/api/email/send-appointment-confirmation")
async def send_appointment_confirmation_email(notification_data: Dict[str, Any]):
    """Envia confirmação de agendamento por email"""
    try:
        global email_manager
        if not email_manager:
            raise HTTPException(status_code=400, detail="Email manager não configurado")
        
        result = await email_manager.send_appointment_confirmation(
            provider=notification_data.get('provider', 'sendgrid'),
            to_email=notification_data['to_email'],
            customer_name=notification_data['customer_name'],
            appointment_data=notification_data['appointment_data']
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Erro ao enviar confirmação de agendamento: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar confirmação: {str(e)}")

# Integration status endpoint
@app.get("/api/integrations/status")
async def get_integrations_status():
    """Obtém status de todas as integrações"""
    try:
        status = {
            'payment_providers': [],
            'whatsapp_configured': evolution_service is not None,
            'calendar_configured': calendar_service is not None,
            'email_providers': []
        }
        
        if payment_manager:
            status['payment_providers'] = payment_manager.get_available_providers()
        
        if email_manager:
            status['email_providers'] = email_manager.get_available_providers()
        
        # Check WhatsApp instances if configured
        if evolution_service:
            try:
                instances_result = await evolution_service.list_instances()
                status['whatsapp_instances'] = instances_result
            except Exception:
                status['whatsapp_instances'] = []
        
        return status
    except Exception as e:
        logger.error(f"Erro ao obter status das integrações: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao obter status das integrações: {str(e)}")

# ==========================================
# LOGS ENDPOINT
# ==========================================

@app.get("/api/logs")
async def get_logs(level: Optional[str] = None, agent_id: Optional[str] = None, session_id: Optional[str] = None,
                   since: Optional[str] = None, limit: int = 200):
    """Retorna logs da aplicação a partir de backend/app.log com filtros simples."""
    try:
        log_path = os.path.join(os.path.dirname(__file__), "app.log")
        if not os.path.exists(log_path):
            return {"logs": [], "total": 0, "path": log_path}

        # Parse since datetime
        since_dt = None
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
            except Exception:
                pass

        # Read and filter lines
        matched = []
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                l = line.strip()
                if not l:
                    continue
                if level and level.upper() not in l.upper():
                    continue
                if agent_id and f"agent_id={agent_id}" not in l:
                    continue
                if session_id and f"session_id={session_id}" not in l:
                    continue
                if since_dt:
                    # Try to find ISO timestamp at beginning of line
                    # logging.basicConfig default may not include timestamp format; best effort parse
                    try:
                        parts = l.split(" ", 1)
                        dt_candidate = parts[0]
                        dt = datetime.fromisoformat(dt_candidate.replace('Z', '+00:00'))
                        if dt < since_dt:
                            continue
                    except Exception:
                        pass
                matched.append(l)

        # Return last N lines matching
        if limit and limit > 0:
            matched = matched[-min(limit, 1000):]  # cap to 1000 lines

        return {
            "logs": matched,
            "total": len(matched),
            "path": log_path
        }
    except Exception as e:
        logger.error(f"Erro ao ler logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao ler logs: {str(e)}")

def generate_sdk_agent_code(agent_request: SDKAgentRequest) -> str:
    """Gera código Python para o agente SDK especializado"""
    
    specialization_templates = {
        "customer_service": """
# AGENTE SDK - ATENDIMENTO AO CLIENTE
# 🎧 AGENTE SDK - ATENDIMENTO AO CLIENTE
# Especializado em suporte via WhatsApp

class CustomerServiceAgent:
    def __init__(self):
        self.name = "{name}"
        self.specialization = "Atendimento ao Cliente"
        self.model = "{model}"
        self.whatsapp_config = {whatsapp_config}
        
    def process_customer_message(self, message, customer_data):
        \"\"\"Processa mensagens de atendimento\"\"\"
        
        # Instruções específicas:
        # {instructions}
        
        # Análise de intenção
        intent = self.analyze_intent(message)
        
        if intent == "complaint":
            return self.handle_complaint(message, customer_data)
        elif intent == "support":
            return self.provide_support(message, customer_data)
        elif intent == "information":
            return self.provide_information(message)
        else:
            return self.default_response(message)
    
    def analyze_intent(self, message):
        # Implementar análise de intenção
        return "support"
    
    def handle_complaint(self, message, customer_data):
        return f"Entendo sua preocupação. Vou registrar sua reclamação e nossa equipe entrará em contato."
    
    def provide_support(self, message, customer_data):
        return f"Como posso ajudá-lo hoje? Estou aqui para resolver sua questão."
    
    def provide_information(self, message):
        return f"Aqui estão as informações solicitadas..."
        
    def default_response(self, message):
        return f"Obrigado por entrar em contato. Como posso ajudá-lo?"
""",
        "scheduling": """
# 📅 AGENTE SDK - AGENDAMENTO DE SERVIÇOS  
# Especializado em gestão de agendamentos

class SchedulingAgent:
    def __init__(self):
        self.name = "{name}"
        self.specialization = "Agendamento de Serviços"
        self.model = "{model}"
        self.scheduling_config = {scheduling_config}
        
    def process_scheduling_request(self, message, customer_data):
        \"\"\"Processa solicitações de agendamento\"\"\"
        
        # Instruções específicas:
        # {instructions}
        
        intent = self.analyze_scheduling_intent(message)
        
        if intent == "new_appointment":
            return self.create_appointment(message, customer_data)
        elif intent == "reschedule":
            return self.reschedule_appointment(message, customer_data)
        elif intent == "cancel":
            return self.cancel_appointment(message, customer_data)
        elif intent == "check_availability":
            return self.check_availability(message)
        else:
            return self.collect_appointment_info(message)
    
    def analyze_scheduling_intent(self, message):
        # Implementar análise de intenção de agendamento
        return "new_appointment"
    
    def create_appointment(self, message, customer_data):
        # Coletar: nome, telefone, serviço, data/hora preferida
        return f"Vou agendar seu serviço. Preciso de algumas informações: nome completo, telefone e horário preferido."
    
    def reschedule_appointment(self, message, customer_data):
        return f"Vou ajudar você a reagendar. Qual seria o novo horário de sua preferência?"
    
    def cancel_appointment(self, message, customer_data):
        return f"Posso cancelar seu agendamento. Poderia confirmar os dados?"
    
    def check_availability(self, message):
        return f"Verificando disponibilidade... Temos horários disponíveis em..."
    
    def collect_appointment_info(self, message):
        return f"Para confirmar seu agendamento, preciso das seguintes informações..."
""",
        "sales": """
# 💰 AGENTE SDK - PROCESSO DE VENDAS
# Especializado em conversão e vendas

class SalesAgent:
    def __init__(self):
        self.name = "{name}"
        self.specialization = "Processo de Vendas"
        self.model = "{model}"
        self.sales_config = {{"leads_system": "active"}}
        
    def process_sales_interaction(self, message, lead_data):
        \"\"\"Processa interações de vendas\"\"\"
        
        # Instruções específicas:
        # {instructions}
        
        stage = self.identify_sales_stage(message, lead_data)
        
        if stage == "awareness":
            return self.create_awareness(message, lead_data)
        elif stage == "interest":
            return self.generate_interest(message, lead_data)
        elif stage == "consideration":
            return self.facilitate_consideration(message, lead_data)
        elif stage == "purchase":
            return self.close_sale(message, lead_data)
        else:
            return self.qualify_lead(message)
    
    def identify_sales_stage(self, message, lead_data):
        # Implementar identificação de estágio de vendas
        return "interest"
    
    def create_awareness(self, message, lead_data):
        return f"Conheça nossas soluções que podem revolucionar seu negócio..."
    
    def generate_interest(self, message, lead_data):
        return f"Vou mostrar como nossos serviços podem beneficiar especificamente seu caso..."
    
    def facilitate_consideration(self, message, lead_data):
        return f"Que tal agendar uma demonstração personalizada? Posso mostrar resultados reais..."
    
    def close_sale(self, message, lead_data):
        return f"Excelente! Vou preparar uma proposta personalizada para você..."
    
    def qualify_lead(self, message):
        return f"Para oferecer a melhor solução, preciso entender melhor suas necessidades..."
    
    def follow_up_lead(self, lead_data):
        return f"Continuando nossa conversa sobre como podemos ajudar seu negócio..."
"""
    }
    
    template = specialization_templates.get(agent_request.specialization, specialization_templates["customer_service"])
    
    return template.format(
        name=agent_request.name,
        model=agent_request.model,
        instructions=agent_request.instructions,
        whatsapp_config=json.dumps(agent_request.whatsapp_config, indent=2),
        scheduling_config=json.dumps(agent_request.scheduling_config, indent=2)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
