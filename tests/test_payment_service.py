import pytest
from decimal import Decimal
import stripe
from backend.services.payment_service import StripePaymentService

class DummyObj:
    def __init__(self, **entries):
        self.__dict__.update(entries)

@pytest.mark.asyncio
async def test_stripe_create_payment_link(monkeypatch):
    monkeypatch.setattr(stripe.Price, "create", lambda **kw: DummyObj(id="price_123"))
    monkeypatch.setattr(stripe.PaymentLink, "create", lambda **kw: DummyObj(id="plink_123", url="https://example.com"))
    service = StripePaymentService("sk_test")
    result = await service.create_payment_link(amount=Decimal("10.00"))
    assert result["success"] is True
    assert result["url"] == "https://example.com"
