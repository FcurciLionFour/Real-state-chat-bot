import unittest

from app.sources.properati.adapter import ProperatiSourceAdapter


class ProperatiSourceAdapterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = ProperatiSourceAdapter()

    def test_build_search_urls_uses_current_properati_structure(self) -> None:
        urls = self.adapter.build_search_urls(
            type(
                "Filters",
                (),
                {
                    "operation": "buy",
                    "propertyType": "apartment",
                    "locations": ["Palermo Hollywood"],
                    "priceMin": None,
                    "priceMax": None,
                },
            )()
        )

        self.assertEqual(urls, ["https://www.properati.com.ar/s/palermo-hollywood/departamento/venta"])

    def test_extract_listing_urls_keeps_only_detail_pages(self) -> None:
        html = """
        <a href="/s/palermo/departamento/venta">Listado</a>
        <a href="/detalle/14032-32-fa5e-d31f54f0115b-198badc-a22a-7142">Ficha 1</a>
        <script>
          window.__DATA__ = {
            "items": [
              {
                "url": "https://www.properati.com.ar/detalle/14032-32-d421-650797ff055b-199ed22-b3fa-7f34"
              }
            ]
          }
        </script>
        """

        urls = self.adapter.extract_listing_urls(html)

        self.assertEqual(
            urls,
            [
                "https://www.properati.com.ar/detalle/14032-32-fa5e-d31f54f0115b-198badc-a22a-7142",
                "https://www.properati.com.ar/detalle/14032-32-d421-650797ff055b-199ed22-b3fa-7f34",
            ],
        )

    def test_extract_structured_listing_from_html(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento en venta en Palermo Chico | PROPERATI</title>
            <meta property="og:title" content="Departamento en venta en Palermo Chico" />
            <meta property="og:description" content="Venta de departamento categoria 3 ambientes con balcón y terraza." />
            <meta property="og:image" content="https://img.properati.com/123.jpg" />
            <meta property="product:price:amount" content="582300" />
            <meta property="product:price:currency" content="USD" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Departamento en venta en Palermo Chico",
                "description": "Venta de departamento categoria 3 ambientes con balcón y terraza.",
                "image": ["https://img.properati.com/123.jpg"],
                "offers": {
                  "@type": "Offer",
                  "price": "582300",
                  "priceCurrency": "USD"
                },
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Cabello 3500",
                  "addressLocality": "Palermo Chico",
                  "addressRegion": "Capital Federal",
                  "addressCountry": "AR"
                },
                "floorSize": {
                  "@type": "QuantitativeValue",
                  "value": "101"
                },
                "numberOfBedrooms": 2,
                "numberOfBathroomsTotal": 2
              }
            </script>
          </head>
          <body>
            <h1>Departamento en venta en Palermo Chico</h1>
            <p>Palermo Chico, Palermo, Capital Federal</p>
            <div>2 dormitorios</div>
            <div>2 baños</div>
            <div>101 m²</div>
            <div>Tipo de vivienda: Departamento</div>
            <div>Tipo de operación: Venta</div>
            <div>18 ago 2025 - Publicado por Sumatres Propósito Inmobiliario</div>
            <div>USD 582.300</div>
            <section>
              <h2>Descripción</h2>
              <p>VENTA DE DEPARTAMENTO CATEGORIA 3 AMBIENTES CON BALCÓN TERRAZA EN PALERMO.</p>
            </section>
            <section>
              <h2>Características de la vivienda</h2>
              <ul>
                <li>Balcón</li>
                <li>Gas natural</li>
              </ul>
            </section>
            <section>
              <h2>Características del edificio</h2>
              <ul>
                <li>Pileta</li>
                <li>Parrilla</li>
              </ul>
            </section>
            <div>+541166018376</div>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.properati.com.ar/detalle/14032-32-fa5e-d31f54f0115b-198badc-a22a-7142",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.source, "properati")
        self.assertEqual(listing.externalId, "14032-32-fa5e-d31f54f0115b-198badc-a22a-7142")
        self.assertEqual(listing.operation, "buy")
        self.assertEqual(listing.propertyType, "apartment")
        self.assertEqual(listing.price, 582300)
        self.assertEqual(listing.currency, "USD")
        self.assertEqual(listing.city, "CABA")
        self.assertEqual(listing.neighborhood, "Palermo Chico")
        self.assertEqual(listing.bedrooms, 2)
        self.assertEqual(listing.bathrooms, 2)
        self.assertEqual(listing.areaTotal, 101)
        self.assertEqual(listing.images, ["https://img.properati.com/123.jpg"])
        self.assertEqual(listing.publisher, "Sumatres Propósito Inmobiliario")
        self.assertEqual(listing.contactPhone, "+541166018376")
        self.assertEqual(listing.features, ["balcony", "terrace", "pool", "barbecue"])


if __name__ == "__main__":
    unittest.main()
