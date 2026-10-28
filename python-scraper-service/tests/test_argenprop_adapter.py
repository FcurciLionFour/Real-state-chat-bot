import unittest
from pathlib import Path

from app.sources.argenprop.adapter import ArgenpropSourceAdapter


class ArgenpropSourceAdapterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.adapter = ArgenpropSourceAdapter()

    def test_extract_expenses_handles_labelled_detail_block(self) -> None:
        html = """
        <section>
          <div class="card">
            <span>Expensas:</span>
            <strong>$ 85.000</strong>
          </div>
        </section>
        """

        self.assertEqual(self.adapter.extract_expenses(html), 85000)

    def test_extract_covered_area_handles_split_html_markup(self) -> None:
        html = """
        <li class="property-feature">
          <p>Sup. Cubierta:</p>
          <p><strong>47</strong> m2</p>
        </li>
        """

        self.assertEqual(self.adapter.extract_covered_area(html), 47)

    def test_extract_bathrooms_handles_number_words_in_plain_text(self) -> None:
        html = """
        <meta
          property="og:description"
          content="Semipiso en suite con dos baños completos y toilette."
        />
        """

        self.assertEqual(self.adapter.extract_bathrooms_normalized(html), 2)

    def test_extract_publisher_and_whatsapp_from_contact_widget(self) -> None:
        html = """
        <div class="form-widget-details">
          <p class="form-details-heading">
            <a id="avisos-anunciante-inf" href="terrazas-y-balcones" data-agent-more-properties>
              Terrazas &amp; Balcones
            </a>
          </p>
        </div>
        <div class="property-contacto__footer" data-goal-mobile>
          <a
            href="https://wa.me/5491166009000/?text=Hola, vi este aviso"
            class="btn btn-icon--wa"
            data-whatsapp-target
          >
            WhatsApp
          </a>
        </div>
        """

        self.assertEqual(self.adapter.extract_publisher(html), "Terrazas & Balcones")
        self.assertEqual(self.adapter.extract_contact_whatsapp(html), "https://wa.me/5491166009000")
        self.assertIsNone(self.adapter.extract_contact_phone(html))

    def test_extract_listing_uses_plain_text_fallback_for_pending_fields(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento 2 ambientes en Palermo</title>
            <meta property="og:title" content="Departamento 2 ambientes en Palermo" />
            <meta property="og:description" content="Muy buen estado" />
            <meta property="product:price:amount" content="129000" />
            <meta property="product:price:currency" content="USD" />
            <meta property="og:locality" content="Palermo, Capital Federal, Argentina" />
          </head>
          <body>
            <ul>
              <li><span>Sup. Cubierta:</span><span>44 m2</span></li>
              <li><span>Expensas:</span><span>$ 120.000</span></li>
            </ul>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-venta-en-palermo-12345678",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.areaCovered, 44)
        self.assertEqual(listing.expenses, 120000)
        self.assertEqual(listing.price, 129000)
        self.assertEqual(listing.currency, "USD")

    def test_extract_listing_uses_argenprop_hidden_price_inputs(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento Alquiler 2 ambientes en Caballito</title>
            <meta property="og:title" content="Departamento Alquiler 2 ambientes en Caballito" />
            <meta property="og:description" content="Alquiler departamento con balcon." />
          </head>
          <body>
            <input id="Moneda" name="Moneda" type="hidden" value="ARS" />
            <input id="Precio" name="Precio" type="hidden" value="890000" />
            <nav>Departamentos en venta Casas en venta Locales en venta</nav>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-alquiler-en-caballito-2-ambientes--15427160",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.price, 890000)
        self.assertEqual(listing.currency, "ARS")
        self.assertEqual(listing.operation, "rent")

    def test_extract_listing_uses_argenprop_data_price_attributes(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento Alquiler monoambiente en Palermo</title>
            <meta property="og:title" content="Departamento Alquiler monoambiente en Palermo" />
          </head>
          <body>
            <button data-id-aviso="15427160" data-moneda="$" data-price="760000">
              Consultar
            </button>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-alquiler-en-palermo-monoambiente--15427160",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.price, 760000)
        self.assertEqual(listing.currency, "ARS")

    def test_extract_listing_uses_normalized_bathrooms_from_meta_description(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento 4 ambientes en Palermo Viejo</title>
            <meta property="og:title" content="Departamento 4 ambientes en Palermo Viejo" />
            <meta
              property="og:description"
              content="Venta semipiso 4 ambientes, suite con dos baños completos y balcón."
            />
            <meta property="product:price:amount" content="219000" />
            <meta property="product:price:currency" content="USD" />
          </head>
          <body></body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-venta-en-palermo-viejo-9070214",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.bathrooms, 2)

    def test_extract_listing_includes_publisher_and_contact_whatsapp(self) -> None:
        html = """
        <html>
          <head>
            <title>Departamento 4 ambientes en Palermo Viejo</title>
            <meta property="og:title" content="Departamento 4 ambientes en Palermo Viejo" />
            <meta
              property="og:description"
              content="Venta semipiso 4 ambientes, suite con dos baños completos y balcón."
            />
            <meta property="product:price:amount" content="219000" />
            <meta property="product:price:currency" content="USD" />
          </head>
          <body>
            <p class="form-details-heading">
              <a id="avisos-anunciante-inf" href="terrazas-y-balcones" data-agent-more-properties>
                Terrazas &amp; Balcones
              </a>
            </p>
            <div class="property-contacto__footer" data-goal-mobile>
              <a
                href="https://wa.me/5491166009000/?text=Hola, vi este aviso"
                class="btn btn-icon--wa"
                data-whatsapp-target
              >
                WhatsApp
              </a>
            </div>
          </body>
        </html>
        """

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-venta-en-palermo-viejo-9070214",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(listing.publisher, "Terrazas & Balcones")
        self.assertEqual(listing.contactWhatsApp, "https://wa.me/5491166009000")
        self.assertIsNone(listing.contactPhone)

    def test_extract_real_fixture_cleans_mojibake_text(self) -> None:
        html = (Path(__file__).parent / "fixtures" / "argenprop_real_excerpt.html").read_text(encoding="utf-8")

        listing = self.adapter.extract(
            "https://www.argenprop.com/departamento-en-venta-en-palermo-chico-5-ambientes--18799423",
            html,
        )

        self.assertIsNotNone(listing)
        assert listing is not None
        self.assertEqual(
            listing.title,
            "Venta Departamento 3 dormitorios 17 años, Frente, 2 cocheras, Jerónimo Salguero 2700, Palermo Chico | Argenprop",
        )
        self.assertEqual(
            listing.description,
            "TORRE BELLINI! Piso alto de revista! Balcón con espectacular vista panorámica a la ciudad y al río! Todo a nuevo! Full amenities! 3 Coch! ÚNICO!",
        )
        self.assertEqual(
            listing.locationText,
            "Jerónimo Salguero 2700, Capital Federal, Argentina, Palermo Chico",
        )
        self.assertEqual(listing.publisher, "LOPEZ CASTROMIL PROPIEDADES")
        self.assertEqual(listing.contactWhatsApp, "https://wa.me/5491125676643")
        self.assertEqual(listing.expenses, 2400000)
        self.assertEqual(listing.areaCovered, 280)

        for value in (listing.title, listing.description, listing.locationText):
            self.assertNotIn("Ã", value)
            self.assertNotIn("Â", value)


if __name__ == "__main__":
    unittest.main()
