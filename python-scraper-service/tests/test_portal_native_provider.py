import unittest

from app.contracts.search import SearchFilters
from app.discovery.portal_native_provider import PortalNativeDiscoveryProvider
from app.sources.base import SourceAdapter


class FakeAdapter(SourceAdapter):
    def __init__(self, source_name: str, search_url: str, discovered_url: str, requires_browser: bool = False) -> None:
        self.source_name = source_name
        self._search_url = search_url
        self._discovered_url = discovered_url
        self._requires_browser = requires_browser

    def can_handle(self, url: str) -> bool:
        return self._discovered_url in url

    def is_detail_url(self, url: str) -> bool:
        return url == self._discovered_url

    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        return [self._search_url]

    def extract_listing_urls(self, html: str) -> list[str]:
        return [self._discovered_url]

    def extract(self, url: str, html: str):
        raise NotImplementedError

    def requires_browser_fallback(self, url: str) -> bool:
        return self._requires_browser


class FakeRegistry:
    def __init__(self, adapters: list[SourceAdapter]) -> None:
        self._adapters = adapters

    def get_enabled_adapters(self, requested_sources: list[str]) -> list[SourceAdapter]:
        return [adapter for adapter in self._adapters if adapter.source_name in requested_sources]


class FakeFetchService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, bool]] = []

    async def fetch(self, url: str, allow_browser_fallback: bool = False) -> str:
        self.calls.append((url, allow_browser_fallback))
        if "zonaprop" in url:
            raise RuntimeError("browser_challenge_not_solved")
        return '<a href="https://mudafy.com.ar/departamento/test-12345">Ficha</a>'


class PortalNativeDiscoveryProviderTest(unittest.IsolatedAsyncioTestCase):
    async def test_continues_with_other_sources_when_zonaprop_fails(self) -> None:
        zonaprop = FakeAdapter(
            source_name="zonaprop",
            search_url="https://www.zonaprop.com.ar/departamentos-venta-palermo.html",
            discovered_url="https://www.zonaprop.com.ar/departamento-en-venta-palermo-1234567890.html",
            requires_browser=True,
        )
        mudafy = FakeAdapter(
            source_name="mudafy",
            search_url="https://mudafy.com.ar/venta/departamentos/caba-palermo",
            discovered_url="https://mudafy.com.ar/departamento/test-12345",
        )
        fetch_service = FakeFetchService()
        provider = PortalNativeDiscoveryProvider(FakeRegistry([zonaprop, mudafy]), fetch_service)

        urls, failures = await provider.discover(
            filters=SearchFilters(operation="buy", propertyType="apartment", locations=["Palermo"]),
            requested_sources=["zonaprop", "mudafy"],
            max_candidate_urls=10,
            allow_browser_fallback=False,
        )

        self.assertEqual(urls, ["https://mudafy.com.ar/departamento/test-12345"])
        self.assertEqual(
            failures,
            [
                {
                    "source": "zonaprop",
                    "stage": "portal-native-discovery",
                    "reason": "browser_challenge_not_solved",
                }
            ],
        )
        self.assertEqual(
            fetch_service.calls,
            [
                ("https://www.zonaprop.com.ar/departamentos-venta-palermo.html", True),
                ("https://mudafy.com.ar/venta/departamentos/caba-palermo", False),
            ],
        )


if __name__ == "__main__":
    unittest.main()
