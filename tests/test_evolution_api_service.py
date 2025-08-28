import pytest
from backend.services.evolution_api_service import EvolutionAPIService

@pytest.mark.asyncio
async def test_generate_qr_code_image():
    service = EvolutionAPIService("http://example.com")
    data = await service._generate_qr_code_image("hello")
    assert data.startswith("data:image/png;base64,")
