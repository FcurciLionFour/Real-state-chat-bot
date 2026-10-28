from __future__ import annotations

from app.contracts.search import SearchFilters
from app.services.fetch_service import FetchService
from app.sources.registry import SourceRegistry


class PortalNativeDiscoveryProvider:
    def __init__(self, registry: SourceRegistry, fetch_service: FetchService) -> None:
        self.registry = registry
        self.fetch_service = fetch_service

    async def discover(
        self,
        filters: SearchFilters,
        requested_sources: list[str],
        max_candidate_urls: int,
        allow_browser_fallback: bool,
    ) -> tuple[list[str], list[dict[str, str]]]:
        candidate_urls: list[str] = []
        partial_failures: list[dict[str, str]] = []

        for adapter in self.registry.get_enabled_adapters(requested_sources):
            search_urls = adapter.build_search_urls(filters)

            for search_url in search_urls:
                try:
                    allow_fallback_for_url = allow_browser_fallback or adapter.requires_browser_fallback(search_url)
                    html = await self.fetch_service.fetch(
                        search_url,
                        allow_browser_fallback=allow_fallback_for_url,
                    )
                    extracted_urls = adapter.extract_listing_urls(html)
                    candidate_urls.extend(extracted_urls)
                    if len(candidate_urls) >= max_candidate_urls:
                        return list(dict.fromkeys(candidate_urls))[:max_candidate_urls], partial_failures
                except Exception as error:
                    partial_failures.append(
                        {
                            "source": adapter.source_name,
                            "stage": "portal-native-discovery",
                            "reason": str(error) or type(error).__name__,
                        }
                    )

        return list(dict.fromkeys(candidate_urls))[:max_candidate_urls], partial_failures
