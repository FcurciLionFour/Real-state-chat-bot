from __future__ import annotations

from app.sources.argenprop.adapter import ArgenpropSourceAdapter
from app.sources.base import SourceAdapter
from app.sources.mudafy.adapter import MudafySourceAdapter
from app.sources.properati.adapter import ProperatiSourceAdapter
from app.sources.zonaprop.adapter import ZonapropSourceAdapter


class SourceRegistry:
    def __init__(self) -> None:
        self._supported_adapters: list[SourceAdapter] = [
            ArgenpropSourceAdapter(),
            ZonapropSourceAdapter(),
            MudafySourceAdapter(),
            ProperatiSourceAdapter(),
        ]
        self._default_active_sources = {"argenprop", "mudafy", "properati"}

    def get_supported_source_names(self) -> list[str]:
        return [adapter.source_name for adapter in self._supported_adapters]

    def get_default_source_names(self) -> list[str]:
        return [adapter.source_name for adapter in self._supported_adapters if adapter.source_name in self._default_active_sources]

    def get_enabled_adapters(self, requested_sources: list[str]) -> list[SourceAdapter]:
        if not requested_sources:
            return [adapter for adapter in self._supported_adapters if adapter.source_name in self._default_active_sources]
        requested = set(requested_sources)
        return [adapter for adapter in self._supported_adapters if adapter.source_name in requested]

    def find_adapter_for_url(self, url: str) -> SourceAdapter | None:
        for adapter in self._supported_adapters:
            if adapter.can_handle(url):
                return adapter
        return None
