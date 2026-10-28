from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.internal_token import require_internal_token
from app.contracts.search import ExtractUrlRequest, ExtractUrlResponse
from app.services.runtime import search_service


router = APIRouter(prefix="/v1", tags=["extract"], dependencies=[Depends(require_internal_token)])


@router.post("/extract-url", response_model=ExtractUrlResponse)
async def extract_url(payload: ExtractUrlRequest) -> ExtractUrlResponse:
    response = await search_service.extract_url(payload)
    if response.meta.get("error"):
        raise HTTPException(status_code=400, detail=response.meta)
    return response
