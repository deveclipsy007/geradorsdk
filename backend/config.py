import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve project root and load .env from the repository root regardless of CWD
BASE_DIR = Path(__file__).parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env", override=True)

# Evolution API Configuration - v2.2.3 Remote
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "https://evolution.agentecortex.com")
EVOLUTION_API_BASE_URL = EVOLUTION_API_URL  # Alias for compatibility
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_GLOBAL_API_KEY = os.getenv("EVOLUTION_GLOBAL_API_KEY", "")
EVOLUTION_API_VERSION = "2.2.3"

# Baileys Configuration - Fix for QR code generation issues
CONFIG_SESSION_PHONE_VERSION = os.getenv("CONFIG_SESSION_PHONE_VERSION", "2.3000.1023204200")

# ==========================================
# CONFIGURAÇÃO CENTRALIZADA DE PORTAS
# ==========================================
# Frontend: Porta 8005 (única autorizada)
# Backend:  Porta 8001 (API apenas)

FRONTEND_PORT = 8005  # Porta única do frontend
BACKEND_HOST = os.getenv("BACKEND_HOST", "localhost") 
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8001"))
BASE_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"  # Base URL for backend
HOST = BACKEND_HOST  # Alias for compatibility
PORT = BACKEND_PORT  # Alias for compatibility
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agno_agents.db")
DATABASE_ECHO = os.getenv("DATABASE_ECHO", "False").lower() == "true"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "logs/agno_backend.log")

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here_change_in_production")
# CORS - Frontend usando configuração centralizada
ALLOWED_ORIGINS = [
    f"http://localhost:{FRONTEND_PORT}",    # Frontend único endpoint
    f"http://127.0.0.1:{FRONTEND_PORT}"     # Alternative localhost  
]

# Performance Settings
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))
TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))

# Agno Configuration
AGNO_CONFIG = {
    "default_model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4000,
    "temperature": 0.7,
    "timeout": TIMEOUT_SECONDS,
    "retry_attempts": RETRY_ATTEMPTS
}

# Evolution API Settings
EVOLUTION_CONFIG = {
    "base_url": EVOLUTION_API_URL,
    "api_key": EVOLUTION_API_KEY,
    "global_api_key": EVOLUTION_GLOBAL_API_KEY,
    "version": EVOLUTION_API_VERSION,
    "config_session_phone_version": CONFIG_SESSION_PHONE_VERSION,
    "timeout": TIMEOUT_SECONDS,
    "retry_attempts": RETRY_ATTEMPTS,
    "webhook_url": f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/whatsapp/webhook",
    "headers": {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY or EVOLUTION_GLOBAL_API_KEY,
        "Authorization": f"Bearer {EVOLUTION_API_KEY or EVOLUTION_GLOBAL_API_KEY}"
    }
}

# Directories
DATA_DIR = BASE_DIR / "data"
AGENT_MEMORY_DIR = DATA_DIR / "agent_memory"
AGENT_STORAGE_DIR = DATA_DIR / "agent_storage"
LOGS_DIR = Path("logs")

# Ensure directories exist
for directory in [DATA_DIR, AGENT_MEMORY_DIR, AGENT_STORAGE_DIR, LOGS_DIR]:
    directory.mkdir(exist_ok=True)

# Configuration object for backward compatibility
class Config:
    def __init__(self):
        self.EVOLUTION_API_URL = EVOLUTION_API_URL
        self.EVOLUTION_API_BASE_URL = EVOLUTION_API_BASE_URL
        self.EVOLUTION_API_KEY = EVOLUTION_API_KEY
        self.CONFIG_SESSION_PHONE_VERSION = CONFIG_SESSION_PHONE_VERSION
        self.FRONTEND_PORT = FRONTEND_PORT  # Configuração centralizada de porta
        self.BACKEND_HOST = BACKEND_HOST
        self.BACKEND_PORT = BACKEND_PORT
        self.BASE_URL = BASE_URL
        self.HOST = HOST
        self.PORT = PORT
        self.DEBUG = DEBUG
        self.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY
        self.OPENAI_API_KEY = OPENAI_API_KEY
        self.GROQ_API_KEY = GROQ_API_KEY
        self.DATABASE_URL = DATABASE_URL
        self.DATABASE_ECHO = DATABASE_ECHO
        self.LOG_LEVEL = LOG_LEVEL
        self.LOG_FILE = LOG_FILE
        self.SECRET_KEY = SECRET_KEY
        self.ALLOWED_ORIGINS = ALLOWED_ORIGINS
        self.MAX_WORKERS = MAX_WORKERS
        self.TIMEOUT_SECONDS = TIMEOUT_SECONDS
        self.RETRY_ATTEMPTS = RETRY_ATTEMPTS
        self.AGNO_CONFIG = AGNO_CONFIG
        self.EVOLUTION_CONFIG = EVOLUTION_CONFIG
        self.DATA_DIR = DATA_DIR
        self.AGENT_MEMORY_DIR = AGENT_MEMORY_DIR
        self.AGENT_STORAGE_DIR = AGENT_STORAGE_DIR
        self.LOGS_DIR = LOGS_DIR

# Create config instance for backward compatibility
config = Config()
