from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models import User
from app.schemas.ai_schema import AIHealthResponse, AITestRequest, AITestResponse
from app.services.ai.base_provider import AIProviderError
from app.services.ai.provider import AIProviderFactory

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.get("/health", response_model=AIHealthResponse)
async def ai_health_check():
    try:
        provider = AIProviderFactory.create()
        return await provider.health_check()
    except AIProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.post("/test", response_model=AITestResponse)
async def test_ai_provider(
    payload: AITestRequest,
    current_user: User = Depends(get_current_user),
):
    """Endpoint test/debug gọi thẳng AI provider — trước đây không auth, cho phép bất kỳ
    ai gọi miễn phí (tốn API cost thật, không qua credit). Bắt buộc đăng nhập để chặn
    lạm dụng; không trừ credit vì đây là công cụ debug nội bộ, không phải tính năng chính."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        provider = AIProviderFactory.create()
        response = await provider.generate(payload.prompt)
        return AITestResponse(response=response)
    except AIProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
