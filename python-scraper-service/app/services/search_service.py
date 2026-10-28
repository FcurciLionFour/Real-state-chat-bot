from __future__ import annotations

from app.contracts.search import (
    ExtractUrlRequest,
    ExtractUrlResponse,
    PartialFailure,
    SearchMeta,
    SearchRequest,
    SearchResponse,
)
from app.core.config import get_settings
from app.discovery.portal_native_provider import PortalNativeDiscoveryProvider
from app.services.fetch_service import FetchService
from app.services.listing_dedupe_service import ListingDedupeService
from app.sources.registry import SourceRegistry


class PythonScraperSearchService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.registry = SourceRegistry()
        self.fetch_service = FetchService(
            self.settings.default_timeout_ms,
            enable_browser_fallback=self.settings.enable_browser_fallback,
        )
        self.portal_native_provider = PortalNativeDiscoveryProvider(self.registry, self.fetch_service)
        self.listing_dedupe_service = ListingDedupeService()

    async def close(self) -> None:
        await self.fetch_service.close()

    async def search(self, payload: SearchRequest) -> SearchResponse:
        requested_sources = payload.sources or self.registry.get_default_source_names()
        requested_providers = payload.discovery.providers or ["portal-native"]
        candidate_urls: list[str] = []
        items = []
        partial_failures: list[PartialFailure] = []

        if "portal-native" in requested_providers:
            discovered_urls, discovery_failures = await self.portal_native_provider.discover(
                filters=payload.filters,
                requested_sources=requested_sources,
                max_candidate_urls=payload.discovery.maxCandidateUrls,
                allow_browser_fallback=payload.execution.allowBrowserFallback,
            )
            candidate_urls.extend(discovered_urls)
            partial_failures.extend(PartialFailure(**failure) for failure in discovery_failures)

        if "google" in requested_providers and not self.settings.enable_google_discovery:
            partial_failures.append(
                PartialFailure(
                    source="google",
                    stage="discovery",
                    reason="google_provider_not_enabled",
                )
            )

        unique_candidate_urls = list(dict.fromkeys(candidate_urls))
        processed_per_source: dict[str, int] = {}
        actual_processed_urls = 0

        for url in unique_candidate_urls:
            adapter = self.registry.find_adapter_for_url(url)
            if adapter is None:
                continue

            current_count = processed_per_source.get(adapter.source_name, 0)
            if current_count >= payload.execution.limitPerSource:
                continue

            try:
                actual_processed_urls += 1
                allow_fallback_for_url = payload.execution.allowBrowserFallback or adapter.requires_browser_fallback(url)
                html = await self.fetch_service.fetch(
                    url,
                    allow_browser_fallback=allow_fallback_for_url,
                )
                listing = adapter.extract(url, html)
                if listing is not None:
                    items.append(listing)
                    processed_per_source[adapter.source_name] = current_count + 1
            except Exception as error:
                partial_failures.append(
                    PartialFailure(
                        source=adapter.source_name,
                        stage="extract",
                        reason=str(error) or type(error).__name__,
                    )
                )

        raw_items_before_dedupe = len(items)
        deduped_items, duplicates_collapsed = self.listing_dedupe_service.dedupe_listings(items)

        meta = SearchMeta(
            sourcesRequested=requested_sources,
            sourcesUsed=sorted({item.source for item in deduped_items}),
            discoveryProvidersUsed=requested_providers,
            candidateUrlsFound=len(unique_candidate_urls),
            candidateUrlsProcessed=actual_processed_urls,
            detailPagesAccepted=len(deduped_items),
            rawItemsBeforeDedupe=raw_items_before_dedupe,
            duplicatesCollapsed=duplicates_collapsed,
            itemsReturned=len(deduped_items),
            durationsMs={"total": 0},
            partialFailures=partial_failures,
            stubMode=False,
        )
        return SearchResponse(items=deduped_items, meta=meta)

    async def extract_url(self, payload: ExtractUrlRequest) -> ExtractUrlResponse:
        adapter = self.registry.find_adapter_for_url(payload.url)
        if adapter is None:
            return ExtractUrlResponse(
                item=None,
                meta={
                    "error": "unsupported_url",
                    "url": payload.url,
                    "sourceHint": payload.sourceHint,
                },
            )

        try:
            allow_fallback_for_url = payload.allowBrowserFallback or adapter.requires_browser_fallback(payload.url)
            html = await self.fetch_service.fetch(
                payload.url,
                allow_browser_fallback=allow_fallback_for_url,
            )
            item = adapter.extract(payload.url, html)
            return ExtractUrlResponse(
                item=item,
                meta={
                    "source": adapter.source_name,
                    "detailUrl": adapter.is_detail_url(payload.url),
                },
            )
        except Exception as error:
            return ExtractUrlResponse(
                item=None,
                meta={
                    "error": str(error) or type(error).__name__,
                    "url": payload.url,
                    "source": adapter.source_name,
                },
            )
