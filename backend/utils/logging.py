import logging
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any
from contextvars import ContextVar
from pathlib import Path

# Context variable para armazenar correlation-id
correlation_id_var: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)

class CorrelationIdFilter(logging.Filter):
    """Filter para adicionar correlation-id aos logs"""
    
    def filter(self, record):
        correlation_id = correlation_id_var.get()
        record.correlation_id = correlation_id or 'no-correlation-id'
        return True

class StructuredFormatter(logging.Formatter):
    """Formatter para logs estruturados em JSON"""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'correlation_id': getattr(record, 'correlation_id', 'no-correlation-id'),
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Adicionar informações extras se disponíveis
        if hasattr(record, 'extra_data'):
            log_entry['extra_data'] = record.extra_data
            
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry, ensure_ascii=False)

def setup_structured_logging(log_level: str = "INFO", log_file: Optional[str] = None):
    """Configura logging estruturado para toda a aplicação"""
    
    # Criar diretório de logs se não existir
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Configurar logger raiz
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remover handlers existentes
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Handler para console (formato legível)
    console_handler = logging.StreamHandler()
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(correlation_id)s] - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(CorrelationIdFilter())
    root_logger.addHandler(console_handler)
    
    # Handler para arquivo (formato JSON estruturado)
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(StructuredFormatter())
        file_handler.addFilter(CorrelationIdFilter())
        root_logger.addHandler(file_handler)
    
    return root_logger

def get_correlation_id() -> str:
    """Obtém o correlation-id atual ou gera um novo"""
    correlation_id = correlation_id_var.get()
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
        correlation_id_var.set(correlation_id)
    return correlation_id

def set_correlation_id(correlation_id: str):
    """Define um correlation-id específico"""
    correlation_id_var.set(correlation_id)

def generate_correlation_id() -> str:
    """Gera e define um novo correlation-id"""
    correlation_id = str(uuid.uuid4())
    correlation_id_var.set(correlation_id)
    return correlation_id

def get_structured_logger(name: str) -> logging.Logger:
    """Obtém um logger estruturado com nome específico"""
    return logging.getLogger(name)

def log_with_extra(logger: logging.Logger, level: str, message: str, extra_data: Optional[Dict[str, Any]] = None):
    """Log com dados extras estruturados"""
    record = logger.makeRecord(
        logger.name, getattr(logging, level.upper()), 
        '', 0, message, (), None
    )
    if extra_data:
        record.extra_data = extra_data
    logger.handle(record)

class LoggerMixin:
    """Mixin para adicionar logging estruturado a classes"""
    
    @property
    def logger(self) -> logging.Logger:
        if not hasattr(self, '_logger'):
            self._logger = get_structured_logger(self.__class__.__name__)
        return self._logger
    
    def log_info(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Log de informação com dados extras"""
        log_with_extra(self.logger, 'INFO', message, extra_data)
    
    def log_error(self, message: str, extra_data: Optional[Dict[str, Any]] = None, exc_info: bool = False):
        """Log de erro com dados extras"""
        if exc_info:
            self.logger.error(message, exc_info=True)
        else:
            log_with_extra(self.logger, 'ERROR', message, extra_data)
    
    def log_warning(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Log de warning com dados extras"""
        log_with_extra(self.logger, 'WARNING', message, extra_data)
    
    def log_debug(self, message: str, extra_data: Optional[Dict[str, Any]] = None):
        """Log de debug com dados extras"""
        log_with_extra(self.logger, 'DEBUG', message, extra_data)