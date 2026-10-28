import unittest
from pathlib import Path

from app.sources.mudafy.adapter import MudafySourceAdapter


class MudafySourceAdapterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = MudafySourceAdapter()

    def test_build_search_urls_prioritizes_location_rooms_and_feature(self) -> None:
        urls = self.adapter.build_search_urls(
            type(
                "Filters",
                (),
                {
                    "operation": "buy",
                    "propertyType": "apartment",
                    "locations": ["Palermo"],
                    "rooms": 3,
                    "features": ["balcony"],
                },
            )()
        )

        self.assertEqual(
            urls[:4],
            [
                "https://mudafy.com.ar/venta/departamentos/caba-palermo/3-ambientes/con-balcon",
                "https://mudafy.com.ar/venta/departamentos/caba-palermo/3-ambientes",
                "https://mudafy.com.ar/venta/departamentos/caba-palermo/con-balcon",
                "https://mudafy.com.ar/venta/departamentos/caba-palermo",
            ],
        )

    def test_extract_listing_urls_reads_href_and_embedded_absolute_urls(self) -> None:
        html = """
        <a href="/venta/departamentos/caba-palermo">Listado</a>
        <a href="/departamento/teodoro-garcia-2100-departamento-en-venta-903181">Ficha 1</a>
        <script>
          window.__STATE__ = {
            "items": [
              {
                "url": "https://mudafy.com.ar/departamento/honduras-6038-departamento-en-venta-888222"
              }
            ]
          }
        </script>
        """

        urls = self.adapter.extract_listing_urls(html)

        self.assertEqual(
            urls,
            [
                "https://mudafy.com.ar/departamento/teodoro-garcia-2100-departamento-en-venta-903181",
                "https://mudafy.com.ar/departamento/honduras-6038-departamento-en-venta-888222",
            ],
        )

    def test_extract_structured_listing_from_html(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento en venta en Palermo - Teodoro García 2100 | Mudafy</title>
            <meta property="og:title" content="Departamento en venta en Palermo - Teodoro García 2100" />
            <meta property="og:description" content="Departamento 3 ambientes con balcón, patio, parrilla y acepta mascotas. Expensas $384.250." />
            <meta property="og:image" content="https://img.mudafy.com/999.jpg" />
            <meta property="product:price:amount" content="245000" />
            <meta property="product:price:currency" content="USD" />
            <meta property="article:published_time" content="2026-04-04T11:15:00.000Z" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Departamento en venta en Palermo - Teodoro García 2100",
                "description": "Departamento 3 ambientes con balcón, patio, parrilla y acepta mascotas.",
                "image": ["https://img.mudafy.com/999.jpg"],
                "offers": {
                  "@type": "Offer",
                  "price": "245000",
                  "priceCurrency": "USD"
                },
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Teodoro García 2100",
                  "addressLocality": "Palermo",
                  "addressRegion": "CABA",
                  "addressCountry": "AR"
                },
                "floorSize": {
                  "@type": "QuantitativeValue",
                  "value": "117"
                },
                "numberOfRooms": 3,
                "numberOfBedrooms": 2,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>
            <div>VENTA</div>
            <div>USD 245.000</div>
            <div>Expensas $384.250</div>
            <div>Superficie total 117m²</div>
            <div>Ambientes 3</div>
            <div>Baños 1</div>
            <div>Dormitorios 2</div>
            <div>Sup. Cubierta 93m²</div>
            <div>Características: Balcón, Patio, Parrilla, Aceptan mascotas</div>
            <div>Todas las propiedades publicadas en el perfil de Urbana se encuentran a cargo del corredor inmobiliario responsable.</div>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://mudafy.com.ar/departamento/teodoro-garcia-2100-departamento-en-venta-903181",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.source, "mudafy")
        self.assertEqual(listing.externalId, "903181")
        self.assertEqual(listing.operation, "buy")
        self.assertEqual(listing.propertyType, "apartment")
        self.assertEqual(listing.price, 245000)
        self.assertEqual(listing.currency, "USD")
        self.assertEqual(listing.expenses, 384250)
        self.assertEqual(listing.city, "CABA")
        self.assertEqual(listing.neighborhood, "Palermo")
        self.assertEqual(listing.rooms, 3)
        self.assertEqual(listing.bedrooms, 2)
        self.assertEqual(listing.bathrooms, 1)
        self.assertEqual(listing.areaTotal, 117)
        self.assertEqual(listing.areaCovered, 93)
        self.assertEqual(listing.images, ["https://img.mudafy.com/999.jpg"])
        self.assertEqual(listing.publisher, "Urbana")
        self.assertEqual(listing.features, ["balcony", "patio", "barbecue", "pets_allowed"])

    def test_extract_real_fixture_cleans_mojibake_text(self) -> None:
        html = (Path(__file__).parent / "fixtures" / "mudafy_real_excerpt.html").read_text(encoding="utf-8")

        listing = self.adapter.extract(
            "https://mudafy.com.ar/departamento/fray-justo-santa-maria-de-oro-2553-departamento-en-venta-665486",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(
            listing.title,
            "Departamento en venta en Fray Justo Santa María de Oro 2553, Palermo",
        )
        self.assertEqual(
            listing.description,
            "¡Departamento en Palermo en venta! Conocé esta propiedad ubicada en Fray Justo Santa María de Oro 2553, , 34 m², con 1 baño",
        )
        self.assertEqual(
            listing.locationText,
            "Fray Justo Santa María de Oro 2553, Palermo, CABA, AR",
        )
        self.assertEqual(listing.publisher, "One")
        self.assertEqual(listing.expenses, 180000)
        self.assertEqual(listing.areaCovered, 34)
        self.assertEqual(listing.features, ["terrace", "patio", "garage", "mortgage_eligible", "pets_allowed"])

        for value in (listing.title, listing.description, listing.locationText):
            self.assertNotIn("Ã", value)
            self.assertNotIn("Â", value)


if __name__ == "__main__":
    unittest.main()
