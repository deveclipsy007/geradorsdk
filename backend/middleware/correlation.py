from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import uuid
import time

try:
    from backend.utils.logging import set_correlation_id, get_structured_logger
except Exception:
    try:
        from ..utils.logging import set_correlation_id, get_structured_logger
    except Exception:
        from utils.logging import set_correlation_id, get_structured_logger

logger = get_structured_logger(__name__)

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware para gerenciar correlation-id em todas as requisições"""
    
    def __init__(self, app, header_name: str = "X-Correlation-ID"):
        super().__init__(app)
        self.header_name = header_name
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Obter ou gerar correlation-id
        correlation_id = request.headers.get(self.header_name)
        if not correlation_id:
            correlation_id = str(uuid.uuid4())
        
        # Definir correlation-id no contexto
        set_correlation_id(correlation_id)
        
        # Log da requisição
        start_time = time.time()
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                'extra_data': {
                    'method': request.method,
                    'path': request.url.path,
                    'query_params': str(request.query_params),
                    'client_ip': request.client.host if request.client else None,
                    'user_agent': request.headers.get('user-agent'),
                    'correlation_id': correlation_id
                }
            }
        )
        
        try:
            # Processar requisição
            response = await call_next(request)
            
            # Adicionar correlation-id ao header da resposta
            response.headers[self.header_name] = correlation_id
            
            # Log da resposta
            duration = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    'extra_data': {
                        'method': request.method,
                        'path': request.url.path,
                        'status_code': response.status_code,
                        'duration_ms': round(duration * 1000, 2),
                        'correlation_id': correlation_id
                    }
                }
            )
            
            return response
            
        except Exception as e:
            # Log do erro
            duration = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path} - {str(e)}",
                extra={
                    'extra_data': {
                        'method': request.method,
                        'path': request.url.path,
                        'error': str(e),
                        'error_type': type(e).__name__,
                        'duration_ms': round(duration * 1000, 2),
                        'correlation_id': correlation_id
                    }
                },
                exc_info=True
            )
            
            # Re-raise a exceção para que o FastAPI possa tratá-la
            raise
