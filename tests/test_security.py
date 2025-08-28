import pathlib
import sys
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))
sys.path.append(str(ROOT / "backend"))

# Stub service modules to avoid heavy dependencies during import
import types
services_module = types.ModuleType("services")
payment_module = types.ModuleType("payment_service")
payment_module.PaymentManager = object
evolution_module = types.ModuleType("evolution_api_service")
evolution_module.EvolutionAPIService = object
calendar_module = types.ModuleType("calendar_service")
calendar_module.GoogleCalendarService = object
email_module = types.ModuleType("email_service")
email_module.EmailManager = object
services_module.payment_service = payment_module
services_module.evolution_api_service = evolution_module
services_module.calendar_service = calendar_module
services_module.email_service = email_module
sys.modules.setdefault("services", services_module)
sys.modules.setdefault("services.payment_service", payment_module)
sys.modules.setdefault("services.evolution_api_service", evolution_module)
sys.modules.setdefault("services.calendar_service", calendar_module)
sys.modules.setdefault("services.email_service", email_module)

# Stub config module
config_module = types.ModuleType("config")
class _Config:
    HOST = "127.0.0.1"
    PORT = 8000
    DEBUG = False
    DATABASE_URL = "sqlite:///:memory:"
    DATABASE_ECHO = False
config_module.config = _Config()
sys.modules.setdefault("config", config_module)
from backend.main import SDKAgentRequest, generate_sdk_agent_code, sanitize_input


def test_sanitize_input_removes_dangerous_chars():
    raw = 'bad\nvalue";<script>\r'
    sanitized = sanitize_input(raw)
    assert '\n' not in sanitized
    assert '\r' not in sanitized
    assert '"' not in sanitized
    assert '<' not in sanitized
    assert '>' not in sanitized
    assert ';' not in sanitized


def test_generate_sdk_agent_code_escapes_instructions():
    req = SDKAgentRequest(
        name="agent",
        specialization="customer_service",
        description="",
        model="gpt-4",
        instructions="<script>alert(1)</script>",
        whatsapp_config={},
        scheduling_config={},
    )
    code = generate_sdk_agent_code(req)
    assert '<script>' not in code
    assert 'scriptalert1/script' in code


def test_generate_sdk_agent_code_sanitizes_name():
    malicious = 'Agent";\nimport os;'
    req = SDKAgentRequest(
        name=malicious,
        specialization="customer_service",
        description="",
        model="gpt-4",
        instructions="",
        whatsapp_config={},
        scheduling_config={},
    )
    code = generate_sdk_agent_code(req)
    sanitized = sanitize_input(malicious)
    assert sanitized in code
    assert '";' not in code
