import os
import sys
from decimal import Decimal
from unittest.mock import MagicMock
import pytest

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(PROJECT_ROOT)
sys.path.append(os.path.join(PROJECT_ROOT, 'backend'))

# Mock stripe module before importing service
sys.modules['stripe'] = MagicMock()

from backend.services.payment_service import PaymentManager


@pytest.mark.asyncio
async def test_create_payment_link_without_provider():
    manager = PaymentManager()
    result = await manager.create_payment_link('stripe', Decimal('10.00'))
    assert result['success'] is False
    assert 'Provider stripe not configured' in result['error']


def test_get_available_providers():
    manager = PaymentManager(stripe_config={'api_key': 'sk_test'})
    providers = manager.get_available_providers()
    assert providers == ['stripe']
