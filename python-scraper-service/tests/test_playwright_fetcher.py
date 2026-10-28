import unittest

from app.browser.playwright_fetcher import PlaywrightFetcher


class PlaywrightFetcherTest(unittest.TestCase):
    def setUp(self) -> None:
        self.fetcher = PlaywrightFetcher(timeout_ms=12000)

    def test_prefers_browser_for_zonaprop(self) -> None:
        self.assertTrue(self.fetcher.prefers_browser("https://www.zonaprop.com.ar/departamentos-venta-palermo.html"))
        self.assertFalse(self.fetcher.prefers_browser("https://www.argenprop.com/departamentos/venta/palermo"))

    def test_build_warmup_urls_for_zonaprop_includes_home_generic_listing_and_target(self) -> None:
        target = "https://www.zonaprop.com.ar/departamentos-venta-palermo.html"

        self.assertEqual(
            self.fetcher.build_warmup_urls(target),
            [
                "https://www.zonaprop.com.ar",
                "https://www.zonaprop.com.ar/departamentos-venta-capital-federal.html",
            ],
        )

    def test_looks_like_challenge_detects_real_cloudflare_shell(self) -> None:
        html = """
        <html>
          <head>
            <title>Un momento...</title>
            <meta name="robots" content="noindex,nofollow">
            <meta http-equiv="content-security-policy" content="default-src 'none'">
            <script src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
          </head>
        </html>
        """

        self.assertTrue(self.fetcher.looks_like_challenge(html))

    def test_looks_like_challenge_ignores_legitimate_listing_with_embedded_cloudflare_script(self) -> None:
        html = """
        <html>
          <head>
            <title>12.498 Departamentos en venta en Palermo, CABA - Zonaprop</title>
            <script>
              window.__cf$cv$params={r:'abc',t:'def'};
              var a=document.createElement('script');
              a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';
              document.getElementsByTagName('head')[0].appendChild(a);
            </script>
          </head>
          <body>
            <a href="/propiedades/departamento-en-palermo-1234567890.html">Ver ficha</a>
          </body>
        </html>
        """

        self.assertFalse(self.fetcher.looks_like_challenge(html))


if __name__ == "__main__":
    unittest.main()
