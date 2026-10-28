import unittest

from app.contracts.search import PropertyListing
from app.services.listing_dedupe_service import ListingDedupeService


def make_listing(
    *,
    source: str,
    source_url: str,
    external_id: str | None,
    title: str,
    location_text: str,
    price: int,
    currency: str = "USD",
    rooms: int | None = None,
    bedrooms: int | None = None,
    bathrooms: int | None = None,
    area_total: int | None = None,
    area_covered: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    description: str | None = None,
) -> PropertyListing:
    return PropertyListing(
        source=source,
        sourceUrl=source_url,
        externalId=external_id,
        title=title,
        locationText=location_text,
        price=price,
        currency=currency,
        rooms=rooms,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        areaTotal=area_total,
        areaCovered=area_covered,
        latitude=latitude,
        longitude=longitude,
        description=description,
        scrapedAt="2026-04-11T21:30:00+00:00",
    )


class ListingDedupeServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ListingDedupeService()

    def test_collapses_same_source_duplicate_by_external_id(self) -> None:
        first = make_listing(
            source="argenprop",
            source_url="https://www.argenprop.com/a",
            external_id="123",
            title="Depto Palermo",
            location_text="Soler 5800, Palermo",
            price=120000,
            rooms=2,
            bedrooms=1,
            bathrooms=1,
            area_total=45,
        )
        second = make_listing(
            source="argenprop",
            source_url="https://www.argenprop.com/b",
            external_id="123",
            title="Depto Palermo con balcon",
            location_text="Soler 5800, Palermo",
            price=120000,
            rooms=2,
            bedrooms=1,
            bathrooms=1,
            area_total=45,
            description="Mas completa",
        )

        deduped, collapsed = self.service.dedupe_listings([first, second])

        self.assertEqual(len(deduped), 1)
        self.assertEqual(collapsed, 1)
        self.assertEqual(deduped[0].duplicateCount, 2)
        self.assertEqual(len(deduped[0].sourceEntries), 2)
        self.assertIsNotNone(deduped[0].duplicateGroupId)
        self.assertEqual(deduped[0].description, "Mas completa")

    def test_collapses_cross_source_duplicate_when_strong_signals_match(self) -> None:
        argenprop = make_listing(
            source="argenprop",
            source_url="https://www.argenprop.com/depto-palermo",
            external_id="123",
            title="Departamento 2 ambientes en Palermo",
            location_text="Soler 5800, Palermo Hollywood, Capital Federal",
            price=129000,
            rooms=2,
            bedrooms=1,
            bathrooms=1,
            area_total=45,
            area_covered=41,
            latitude=-34.58800,
            longitude=-58.43100,
        )
        zonaprop = make_listing(
            source="zonaprop",
            source_url="https://www.zonaprop.com.ar/depto-palermo",
            external_id="zp-888",
            title="Venta depto 2 amb Palermo Hollywood",
            location_text="Soler 5800, Palermo Hollywood, CABA",
            price=130000,
            rooms=2,
            bedrooms=1,
            bathrooms=1,
            area_total=46,
            area_covered=42,
            latitude=-34.58840,
            longitude=-58.43070,
            description="Con balcon al frente",
        )

        deduped, collapsed = self.service.dedupe_listings([argenprop, zonaprop])

        self.assertEqual(len(deduped), 1)
        self.assertEqual(collapsed, 1)
        self.assertEqual(deduped[0].duplicateCount, 2)
        self.assertEqual({entry.source for entry in deduped[0].sourceEntries}, {"argenprop", "zonaprop"})
        self.assertEqual(deduped[0].source, "zonaprop")
        self.assertEqual(deduped[0].description, "Con balcon al frente")

    def test_keeps_distinct_listings_separate_when_signals_do_not_match(self) -> None:
        first = make_listing(
            source="argenprop",
            source_url="https://www.argenprop.com/depto-palermo",
            external_id="123",
            title="Departamento Palermo",
            location_text="Soler 5800, Palermo, CABA",
            price=129000,
            rooms=2,
            bedrooms=1,
            bathrooms=1,
            area_total=45,
        )
        second = make_listing(
            source="zonaprop",
            source_url="https://www.zonaprop.com.ar/depto-caballito",
            external_id="zp-999",
            title="Departamento Caballito",
            location_text="Rosario 500, Caballito, CABA",
            price=210000,
            rooms=3,
            bedrooms=2,
            bathrooms=2,
            area_total=72,
            latitude=-34.61900,
            longitude=-58.44300,
        )

        deduped, collapsed = self.service.dedupe_listings([first, second])

        self.assertEqual(len(deduped), 2)
        self.assertEqual(collapsed, 0)
        self.assertEqual({item.duplicateCount for item in deduped}, {1})


if __name__ == "__main__":
    unittest.main()
