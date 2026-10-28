from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    environment: str = "development"
    enable_cache: bool = False
    enable_browser_fallback: bool = False
    default_timeout_ms: int = 12000
    max_urls_per_source: int = 10
    internal_token: str | None = None
    enable_google_discovery: bool = False
    google_api_key: str | None = None
    google_cx: str | None = None

    model_config = SettingsConfigDict(
        env_prefix="PY_SCRAPER_",
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
