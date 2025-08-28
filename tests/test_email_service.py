import pytest
import smtplib
from backend.services.email_service import SMTPEmailService

class DummySMTP:
    def __init__(self, *args, **kwargs):
        pass
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        pass
    def starttls(self):
        pass
    def login(self, user, pwd):
        pass
    def send_message(self, msg):
        pass

@pytest.mark.asyncio
async def test_smtp_send_email(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", DummySMTP)
    service = SMTPEmailService("smtp.test", 25, "user", "pass")
    result = await service.send_email(
        to_emails=["a@example.com"],
        subject="Hi",
        content="<p>Hello</p>",
        from_email="from@example.com"
    )
    assert result["success"] is True
