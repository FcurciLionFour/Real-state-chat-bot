from fastapi import APIRouter, Depends

from app.api.dependencies.internal_token import require_internal_token
from app.contracts.search import SearchRequest, SearchResponse
from app.services.runtime import search_service


router = APIRouter(prefix="/v1", tags=["search"], dependencies=[Depends(require_internal_token)])


@router.post("/search", response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    return await search_service.search(payload)
