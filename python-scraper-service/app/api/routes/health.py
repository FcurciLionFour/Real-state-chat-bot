from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health/live")
async def health_live() -> dict[str, object]:
    return {"status": "ok", "service": "python-scraper-service"}


@router.get("/health/ready")
async def health_ready() -> dict[str, object]:
    return {
        "status": "ready",
        "service": "python-scraper-service",
    }
