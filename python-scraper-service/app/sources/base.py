from __future__ import annotations

from abc import ABC, abstractmethod

from app.contracts.search import PropertyListing, SearchFilters


class SourceAdapter(ABC):
    source_name: str

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def is_detail_url(self, url: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def extract_listing_urls(self, html: str) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def extract(self, url: str, html: str) -> PropertyListing | None:
        raise NotImplementedError

    def requires_browser_fallback(self, url: str) -> bool:
        return False
