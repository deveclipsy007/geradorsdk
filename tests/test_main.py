import os
import sys
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(PROJECT_ROOT)
sys.path.append(os.path.join(PROJECT_ROOT, 'backend'))

# Mock external dependencies
sys.modules['stripe'] = MagicMock()
sys.modules['qrcode'] = MagicMock()
pil_mock = MagicMock()
sys.modules['PIL'] = pil_mock
sys.modules['PIL.Image'] = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.oauth2'] = MagicMock()
sys.modules['google.oauth2.credentials'] = MagicMock()
sys.modules['google.auth'] = MagicMock()
sys.modules['google.auth.transport'] = MagicMock()
sys.modules['google.auth.transport.requests'] = MagicMock()
sys.modules['google_auth_oauthlib'] = MagicMock()
sys.modules['google_auth_oauthlib.flow'] = MagicMock()
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()
sys.modules['googleapiclient.errors'] = MagicMock()

# Configure test database before importing app
os.environ['DATABASE_URL'] = 'sqlite:///./test.db'

from backend.database import DatabaseManager
from backend.main import app

@pytest.fixture(autouse=True)
def setup_database():
    DatabaseManager.reset_db()
    yield

client = TestClient(app)

def test_health_endpoint():
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'healthy'

def test_create_and_get_agent():
    payload = {
        'name': 'Test Agent',
        'specialization': 'sales',
        'description': 'Agent for testing',
        'model': 'openai/gpt-3.5-turbo',
        'instructions': 'Be helpful',
        'whatsapp_config': {},
        'scheduling_config': {}
    }
    create_resp = client.post('/api/agents', json=payload)
    assert create_resp.status_code == 200
    created = create_resp.json()
    agent_id = created['id']

    list_resp = client.get('/api/agents')
    assert list_resp.status_code == 200
    agents = list_resp.json()
    assert any(a['id'] == agent_id for a in agents)

    get_resp = client.get(f'/api/agents/{agent_id}')
    assert get_resp.status_code == 200
    agent = get_resp.json()
    assert agent['name'] == payload['name']
