import unittest

from app.services.fetch_service import FetchService


class FetchServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = FetchService(timeout_ms=12000, enable_browser_fallback=True)

    def test_decode_content_prefers_non_mojibake_result_over_declared_charset(self) -> None:
        content = "Jerónimo Salguero 2700, Palermo Chico".encode("utf-8")

        decoded = self.service.decode_content(content, "text/html; charset=iso-8859-1")

        self.assertEqual(decoded, "Jerónimo Salguero 2700, Palermo Chico")
        self.assertNotIn("Ã", decoded)
        self.assertNotIn("Â", decoded)

    def test_should_prefer_browser_fetch_for_zonaprop_when_fallback_is_allowed(self) -> None:
        self.assertTrue(
            self.service.should_prefer_browser_fetch(
                "https://www.zonaprop.com.ar/departamentos-venta-palermo.html",
                allow_browser_fallback=True,
            )
        )
        self.assertFalse(
            self.service.should_prefer_browser_fetch(
                "https://www.argenprop.com/departamento-en-venta-en-palermo-12345678",
                allow_browser_fallback=True,
            )
        )


if __name__ == "__main__":
    unittest.main()
