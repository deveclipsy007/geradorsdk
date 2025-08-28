"""
Sistema de Configuração Centralizada
"""
import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import json
from pathlib import Path

# Carregar variáveis de ambiente
load_dotenv()

class Config:
    """Configuração centralizada do sistema"""
    
    # Configurações do Banco de Dados
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agents.db")
    DATABASE_ECHO = os.getenv("DATABASE_ECHO", "false").lower() == "true"
    
    # Configurações do Servidor
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8001"))  # Alinhado com frontend
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    # Configurações de API Keys
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    
    # Configurações de Segurança
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # Configurações de Upload e Armazenamento
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
    MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB
    
    # Configurações de Cache
    CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))  # 1 hora
    
    # Configurações de Logs
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "app.log")
    
    # Configurações do OCM Drizzy (Stub)
    DRIZZY_ENABLED = os.getenv("DRIZZY_ENABLED", "true").lower() == "true"
    DRIZZY_WEBHOOK_URL = os.getenv("DRIZZY_WEBHOOK_URL")
    DRIZZY_API_KEY = os.getenv("DRIZZY_API_KEY")
    
    # Configurações de Sessão Chat
    CHAT_SESSION_TIMEOUT = int(os.getenv("CHAT_SESSION_TIMEOUT", "7200"))  # 2 horas
    MAX_CHAT_HISTORY = int(os.getenv("MAX_CHAT_HISTORY", "100"))
    
    # Configurações RAG e Vector Database
    VECTOR_DB_URL = os.getenv("VECTOR_DB_URL")  # PostgreSQL com pgvector
    TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
    EXA_API_KEY = os.getenv("EXA_API_KEY")
    
    @classmethod
    def get_db_config(cls) -> Dict[str, Any]:
        """Retorna configuração do banco de dados"""
        return {
            "url": cls.DATABASE_URL,
            "echo": cls.DATABASE_ECHO,
        }
    
    @classmethod
    def get_api_keys(cls) -> Dict[str, Optional[str]]:
        """Retorna todas as API keys configuradas"""
        return {
            "anthropic": cls.ANTHROPIC_API_KEY,
            "openai": cls.OPENAI_API_KEY,
            "groq": cls.GROQ_API_KEY,
        }
    
    @classmethod
    def validate_api_keys(cls) -> Dict[str, bool]:
        """Valida se as API keys estão configuradas"""
        keys = cls.get_api_keys()
        return {provider: bool(key) for provider, key in keys.items()}
    
    @classmethod
    def get_cors_config(cls) -> Dict[str, Any]:
        """Retorna configuração CORS"""
        return {
            "allow_origins": cls.CORS_ORIGINS,
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }
    
    @classmethod
    def get_vector_db_url(cls) -> Optional[str]:
        """Retorna URL do banco de vetores PgVector"""
        return cls.VECTOR_DB_URL
    
    @classmethod
    def get_advanced_api_keys(cls) -> Dict[str, Optional[str]]:
        """Retorna API keys para ferramentas avançadas"""
        return {
            "tavily": cls.TAVILY_API_KEY,
            "exa": cls.EXA_API_KEY,
        }
    
    @classmethod
    def ensure_directories(cls):
        """Garante que os diretórios necessários existem"""
        cls.UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """Converte configuração para dicionário (sem secrets)"""
        return {
            "database_url": cls.DATABASE_URL.replace(cls.DATABASE_URL.split("@")[-1] if "@" in cls.DATABASE_URL else "", "***") if cls.DATABASE_URL else None,
            "host": cls.HOST,
            "port": cls.PORT,
            "debug": cls.DEBUG,
            "api_keys_configured": cls.validate_api_keys(),
            "cors_origins": cls.CORS_ORIGINS,
            "upload_dir": str(cls.UPLOAD_DIR),
            "max_upload_size": cls.MAX_UPLOAD_SIZE,
            "cache_ttl": cls.CACHE_TTL,
            "log_level": cls.LOG_LEVEL,
            "drizzy_enabled": cls.DRIZZY_ENABLED,
            "chat_session_timeout": cls.CHAT_SESSION_TIMEOUT,
            "max_chat_history": cls.MAX_CHAT_HISTORY,
            "vector_db_configured": bool(cls.VECTOR_DB_URL),
            "advanced_api_keys_configured": {k: bool(v) for k, v in cls.get_advanced_api_keys().items()},
        }

# Configuração de desenvolvimento
class DevelopmentConfig(Config):
    DEBUG = True
    DATABASE_ECHO = True
    LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")

# Configuração de produção
class ProductionConfig(Config):
    DEBUG = False
    DATABASE_ECHO = False
    LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING")
    CORS_ORIGINS = ["https://your-domain.com"]

# Configuração de teste
class TestingConfig(Config):
    DATABASE_URL = "sqlite:///:memory:"
    DEBUG = True
    DATABASE_ECHO = False
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Determinar configuração atual
def get_config() -> Config:
    """Retorna a configuração apropriada baseada na variável de ambiente"""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionConfig()
    elif env == "testing":
        return TestingConfig()
    else:
        return DevelopmentConfig()

# Instância global da configuração
config = get_config()

# Garantir que os diretórios existem
config.ensure_directories()