import pytest
from datetime import datetime, timedelta
from backend.services.calendar_service import GoogleCalendarService

@pytest.mark.asyncio
async def test_calendar_uninitialized():
    service = GoogleCalendarService()
    start = datetime.utcnow()
    end = start + timedelta(hours=1)
    result = await service.check_availability(start, end)
    assert result["success"] is False
