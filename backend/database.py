"""
Sistema de Banco de Dados com SQLAlchemy (Simulando ORM Drizzy)
Implementação robusta para armazenamento de agentes e sessões
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid
from contextlib import contextmanager

from .config import config

# Base para modelos
Base = declarative_base()

# Configuração do engine
engine = create_engine(
    config.DATABASE_URL,
    echo=config.DATABASE_ECHO,
    connect_args={"check_same_thread": False} if "sqlite" in config.DATABASE_URL else {}
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Agent(Base):
    """Modelo para agentes SDK especializados"""
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    specialization = Column(String(50), nullable=False)  # 'customer_service', 'scheduling', 'sales'
    model = Column(String(100), nullable=False)
    instructions = Column(Text, nullable=False)
    
    # Configurações de integração
    whatsapp_config = Column(JSON, default=dict)  # WhatsApp integration settings
    scheduling_config = Column(JSON, default=dict)  # Scheduling platform settings
    
    status = Column(String(50), default="created")
    
    # Metadados
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(String(255), default="system")
    
    # Relacionamentos
    messages = relationship("ChatMessage", back_populates="agent", cascade="all, delete-orphan")
    
    
    def to_dict(self) -> Dict[str, Any]:
        """Converte o agente para dicionário"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "specialization": self.specialization,
            "model": self.model,
            "instructions": self.instructions,
            "whatsapp_config": self.whatsapp_config or {},
            "scheduling_config": self.scheduling_config or {},
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }
    
    def to_summary(self) -> Dict[str, Any]:
        """Retorna versão resumida do agente"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "specialization": self.specialization,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "model": self.model,
        }

    @classmethod
    def create(cls, db: Session, **kwargs) -> "Agent":
        """Cria e persiste um novo agente"""
        agent = cls(**kwargs)
        db.add(agent)
        db.flush()
        db.refresh(agent)
        return agent

    @classmethod
    def get_by_id(cls, db: Session, agent_id: str) -> Optional["Agent"]:
        """Busca um agente pelo ID"""
        return db.query(cls).filter(cls.id == agent_id).first()

    @classmethod
    def list(cls, db: Session) -> List["Agent"]:
        """Lista todos os agentes ordenados por nome"""
        return db.query(cls).order_by(cls.name.asc()).all()


class ChatMessage(Base):
    """Mensagens de chat por agente/sessão"""
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=True)
    role = Column(String(20), nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    agent = relationship("Agent", back_populates="messages")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def create(cls, db: Session, **kwargs) -> "ChatMessage":
        """Cria e persiste uma nova mensagem de chat"""
        message = cls(**kwargs)
        db.add(message)
        db.flush()
        db.refresh(message)
        return message

    @classmethod
    def get_messages(
        cls,
        db: Session,
        agent_id: str,
        session_id: Optional[str] = None,
        limit: int = 100,
        asc: bool = True,
    ) -> List["ChatMessage"]:
        """Recupera mensagens de um agente/sessão"""
        query = db.query(cls).filter(cls.agent_id == agent_id)
        if session_id:
            query = query.filter(cls.session_id == session_id)
        order = cls.created_at.asc() if asc else cls.created_at.desc()
        query = query.order_by(order)
        if limit:
            query = query.limit(limit)
        return query.all()


# Função para obter sessão do banco
@contextmanager
def get_db_session():
    """Context manager para sessões do banco de dados"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def get_db():
    """Dependency para FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DatabaseManager:
    """Manager para operações do banco de dados"""
    
    @staticmethod
    def init_db():
        """Inicializa o banco de dados criando todas as tabelas"""
        Base.metadata.create_all(bind=engine)
    
    @staticmethod
    def drop_db():
        """Remove todas as tabelas (cuidado!)"""
        Base.metadata.drop_all(bind=engine)
    
    @staticmethod
    def reset_db():
        """Reseta o banco de dados (drop + create)"""
        DatabaseManager.drop_db()
        DatabaseManager.init_db()
    
    
    @staticmethod
    def get_agent_stats() -> Dict[str, Any]:
        """Retorna estatísticas dos agentes SDK"""
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

# Inicializar banco de dados
def init_database():
    """Inicializa o banco de dados e cria as tabelas"""
    try:
        DatabaseManager.init_db()
        print(f"[OK] Banco de dados inicializado: {config.DATABASE_URL}")
        return True
    except Exception as e:
        print(f"[ERRO] Erro ao inicializar banco de dados: {str(e)}")
        return False

# Auto-inicialização quando o módulo é importado
if __name__ != "__main__":
    init_database()
