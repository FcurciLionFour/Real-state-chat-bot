from fastapi import APIRouter, Depends

from app.api.dependencies.internal_token import require_internal_token
from app.core.config import get_settings
from app.sources.registry import SourceRegistry


router = APIRouter(prefix="/v1", tags=["capabilities"], dependencies=[Depends(require_internal_token)])
registry = SourceRegistry()


@router.get("/capabilities")
async def capabilities() -> dict[str, object]:
    settings = get_settings()
    return {
        "service": "python-scraper-service",
        "supportedSources": registry.get_supported_source_names(),
        "activeSourceAdapters": registry.get_default_source_names(),
        "supportedDiscoveryProviders": ["portal-native", "google"],
        "browserFallbackEnabled": settings.enable_browser_fallback,
        "googleDiscoveryEnabled": settings.enable_google_discovery,
        "maxUrlsPerSource": settings.max_urls_per_source,
        "stubMode": False,
    }
