from fastapi import FastAPI

from app.api.routes.capabilities import router as capabilities_router
from app.api.routes.extract import router as extract_router
from app.api.routes.health import router as health_router
from app.api.routes.search import router as search_router
from app.core.config import get_settings
from app.services.runtime import search_service


settings = get_settings()

app = FastAPI(
    title="Python Scraper Service",
    version="0.1.0",
    description="Servicio Python de scraping y adquisicion de datos para Real State Chat Bot.",
)

app.include_router(health_router)
app.include_router(capabilities_router)
app.include_router(extract_router)
app.include_router(search_router)


@app.get("/")
async def root() -> dict[str, object]:
    return {
        "service": "python-scraper-service",
        "version": "0.1.0",
        "environment": settings.environment,
        "stubMode": False,
    }


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await search_service.close()
