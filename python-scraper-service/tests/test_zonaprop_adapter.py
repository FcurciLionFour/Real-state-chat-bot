import unittest

from app.sources.zonaprop.adapter import ZonapropSourceAdapter


class ZonapropSourceAdapterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = ZonapropSourceAdapter()

    def test_build_search_urls_uses_portal_pattern(self) -> None:
        urls = self.adapter.build_search_urls(
            type(
                "Filters",
                (),
                {
                    "operation": "buy",
                    "propertyType": "apartment",
                    "locations": ["Palermo Hollywood"],
                },
            )()
        )

        self.assertEqual(urls, ["https://www.zonaprop.com.ar/departamentos-venta-palermo-hollywood.html"])

    def test_extract_listing_urls_keeps_only_detail_pages(self) -> None:
        html = """
        <a href="/departamentos-venta-palermo.html">Listado</a>
        <a href="/departamento-en-venta-palermo-hollywood-1234567890.html?n_src=Listado&amp;n_pos=1">Ficha 1</a>
        <a href="https://www.zonaprop.com.ar/departamento-en-venta-belgrano-999999999.html">Ficha 2</a>
        """

        urls = self.adapter.extract_listing_urls(html)

        self.assertEqual(
            urls,
            [
                "https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html?n_src=Listado&n_pos=1",
                "https://www.zonaprop.com.ar/departamento-en-venta-belgrano-999999999.html",
            ],
        )

    def test_extract_structured_listing_from_html(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento en venta en Palermo Hollywood - Zonaprop</title>
            <meta property="og:title" content="Departamento en venta en Palermo Hollywood" />
            <meta property="og:description" content="2 ambientes con balcon y cochera. Expensas 120000." />
            <meta property="og:image" content="https://img.zonaprop.com/123.jpg" />
            <meta property="product:price:amount" content="140000" />
            <meta property="product:price:currency" content="USD" />
            <meta property="article:published_time" content="2026-04-07T12:00:00.000Z" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Departamento en venta en Palermo Hollywood",
                "description": "2 ambientes con balcon y cochera. Expensas 120000.",
                "image": ["https://img.zonaprop.com/123.jpg"],
                "offers": {
                  "@type": "Offer",
                  "price": "140000",
                  "priceCurrency": "USD"
                },
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Palermo Hollywood, Capital Federal",
                  "addressLocality": "CABA",
                  "addressRegion": "CABA",
                  "addressCountry": "AR"
                },
                "floorSize": {
                  "@type": "QuantitativeValue",
                  "value": "48"
                },
                "numberOfRooms": 2,
                "numberOfBedrooms": 1,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>
            <div>48 m2 totales</div>
            <div>44 m2 cubiertos</div>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.source, "zonaprop")
        self.assertEqual(listing.externalId, "1234567890")
        self.assertEqual(listing.operation, "buy")
        self.assertEqual(listing.propertyType, "apartment")
        self.assertEqual(listing.price, 140000)
        self.assertEqual(listing.currency, "USD")
        self.assertEqual(listing.city, "CABA")
        self.assertEqual(listing.neighborhood, "Palermo")
        self.assertEqual(listing.rooms, 2)
        self.assertEqual(listing.bedrooms, 1)
        self.assertEqual(listing.bathrooms, 1)
        self.assertEqual(listing.areaTotal, 48)
        self.assertEqual(listing.areaCovered, 44)
        self.assertEqual(listing.images, ["https://img.zonaprop.com/123.jpg"])
        self.assertEqual(listing.features, ["balcony", "garage"])

    def test_extract_external_id_from_detail_url_with_query_string(self) -> None:
        external_id = self.adapter.extract_external_id(
            "https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html?n_src=Listado&n_pos=1"
        )

        self.assertEqual(external_id, "1234567890")


if __name__ == "__main__":
    unittest.main()
