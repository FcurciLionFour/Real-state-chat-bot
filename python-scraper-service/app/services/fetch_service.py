from __future__ import annotations

import re

import httpx
from charset_normalizer import from_bytes

from app.browser.playwright_fetcher import PlaywrightFetcher
from app.utils.text import text_quality_score


class FetchService:
    def __init__(self, timeout_ms: int, enable_browser_fallback: bool = False) -> None:
        self.timeout = timeout_ms / 1000
        self.enable_browser_fallback = enable_browser_fallback
        self.browser_fetcher = PlaywrightFetcher(timeout_ms)

    async def fetch(self, url: str, allow_browser_fallback: bool = False) -> str:
        if self.should_prefer_browser_fetch(url, allow_browser_fallback):
            return await self.browser_fetcher.fetch(url)

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/135.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        }
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            html = self.decode_content(
                response.content,
                response.headers.get("content-type"),
            )

            if self.should_try_browser_fallback(response, html, allow_browser_fallback):
                return await self.browser_fetcher.fetch(url)

            response.raise_for_status()
            return html

    async def close(self) -> None:
        await self.browser_fetcher.close()

    def should_prefer_browser_fetch(self, url: str, allow_browser_fallback: bool) -> bool:
        if not self.enable_browser_fallback or not allow_browser_fallback:
            return False

        return self.browser_fetcher.prefers_browser(url)

    def should_try_browser_fallback(
        self,
        response: httpx.Response,
        html: str,
        allow_browser_fallback: bool,
    ) -> bool:
        if not self.enable_browser_fallback or not allow_browser_fallback:
            return False

        status_code = response.status_code
        challenge_header = response.headers.get("cf-mitigated", "").lower()
        server_header = response.headers.get("server", "").lower()

        return (
            status_code in (403, 429)
            or challenge_header == "challenge"
            or "cloudflare" in server_header
            or self.browser_fetcher.looks_like_challenge(html)
        )

    def decode_content(self, content: bytes, content_type: str | None = None) -> str:
        if not content:
            return ""

        candidate_encodings: list[str] = []
        declared_encoding = self.extract_declared_encoding(content_type)
        if declared_encoding:
            candidate_encodings.append(declared_encoding)

        detected_match = from_bytes(content).best()
        if detected_match and detected_match.encoding:
            candidate_encodings.append(detected_match.encoding)

        candidate_encodings.extend(["utf-8", "cp1252", "latin-1"])

        best_text: str | None = None
        best_score: tuple[int, int, int] | None = None

        for encoding in dict.fromkeys(candidate_encodings):
            try:
                decoded = content.decode(encoding)
            except (LookupError, UnicodeDecodeError):
                continue

            score = text_quality_score(decoded)
            if best_score is None or score < best_score:
                best_text = decoded
                best_score = score

            if score == (0, 0, len(decoded)):
                break

        if best_text is not None:
            return best_text

        return content.decode("utf-8", errors="replace")

    def extract_declared_encoding(self, content_type: str | None) -> str | None:
        if not content_type:
            return None

        match = re.search(r"charset=([^\s;]+)", content_type, flags=re.IGNORECASE)
        if not match:
            return None

        return match.group(1).strip("\"' ")
