from __future__ import annotations

import asyncio
import shutil
import time
from contextlib import suppress
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import BrowserContext
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


class PlaywrightFetcher:
    def __init__(self, timeout_ms: int, session_root: Path | None = None) -> None:
        self.timeout_ms = timeout_ms
        self.session_root = session_root or Path("/tmp/python-scraper-browser-sessions")
        self._playwright = None
        self._contexts: dict[str, BrowserContext] = {}
        self._context_locks: dict[str, asyncio.Lock] = {}
        self._runtime_lock = asyncio.Lock()
        self._host_warmup_until: dict[str, float] = {}

    async def fetch(self, url: str) -> str:
        host = self.extract_host(url)
        lock = self._context_locks.setdefault(host, asyncio.Lock())

        async with lock:
            last_error: RuntimeError | None = None

            for attempt in range(2):
                context = await self.get_context(host)
                page = await context.new_page()

                try:
                    await self.ensure_warm_session(host, context, page, url)
                    await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                    await self.wait_for_usable_page(page)
                    html = await page.content()

                    if self.looks_like_challenge(html):
                        raise RuntimeError("browser_challenge_not_solved")

                    self._host_warmup_until[host] = time.monotonic() + 12 * 60
                    return html
                except RuntimeError as error:
                    if str(error) != "browser_challenge_not_solved":
                        raise

                    last_error = error
                    await self.reset_context(host)
                    if attempt == 0:
                        continue
                    raise
                finally:
                    with suppress(Exception):
                        await page.close()

            raise last_error or RuntimeError("browser_challenge_not_solved")

    async def close(self) -> None:
        for context in list(self._contexts.values()):
            await context.close()
        self._contexts.clear()
        self._host_warmup_until.clear()

        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None

    def prefers_browser(self, url: str) -> bool:
        host = self.extract_host(url)
        return "zonaprop.com.ar" in host

    def build_warmup_urls(self, url: str) -> list[str]:
        parsed = urlparse(url)
        host_root = f"{parsed.scheme}://{parsed.netloc}"

        if "zonaprop.com.ar" not in parsed.netloc:
            return [host_root]

        generic_listing = f"{host_root}/departamentos-venta-capital-federal.html"
        return [host_root, generic_listing]

    def extract_host(self, url: str) -> str:
        return (urlparse(url).hostname or "").lower()

    async def ensure_runtime(self) -> None:
        if self._playwright is not None:
            return

        async with self._runtime_lock:
            if self._playwright is None:
                self.session_root.mkdir(parents=True, exist_ok=True)
                self._playwright = await async_playwright().start()

    async def get_context(self, host: str) -> BrowserContext:
        await self.ensure_runtime()

        context = self._contexts.get(host)
        if context is not None:
            return context

        browser_type = self._playwright.chromium
        session_dir = self.session_root / self.sanitize_host(host)
        session_dir.mkdir(parents=True, exist_ok=True)

        context = await browser_type.launch_persistent_context(
            user_data_dir=str(session_dir),
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--lang=es-AR",
                "--window-size=1366,900",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            locale="es-AR",
            timezone_id="America/Argentina/Buenos_Aires",
            viewport={"width": 1366, "height": 900},
            color_scheme="light",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/135.0.0.0 Safari/537.36"
            ),
        )
        await context.set_extra_http_headers(
            {
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                "Upgrade-Insecure-Requests": "1",
            }
        )
        await context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['es-AR', 'es', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
            window.chrome = window.chrome || { runtime: {} };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters && parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters)
            );
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
              if (parameter === 37445) {
                return 'Intel Inc.';
              }
              if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
              }
              return getParameter.call(this, parameter);
            };
            """
        )
        self._contexts[host] = context
        return context

    async def ensure_warm_session(self, host: str, context: BrowserContext, page, target_url: str) -> None:
        if not self.prefers_browser(target_url):
            return

        if await self.has_clearance_cookie(context):
            return

        # Zonaprop resuelve mejor el challenge sobre la URL objetivo que con un
        # warmup previo a home/listados genéricos. Dejamos que la primera visita
        # al target construya la clearance y reutilizamos esa sesión después.
        self._host_warmup_until.setdefault(host, time.monotonic())

    async def has_clearance_cookie(self, context: BrowserContext) -> bool:
        cookies = await context.cookies()
        return any(cookie.get("name") == "cf_clearance" for cookie in cookies)

    async def reset_context(self, host: str) -> None:
        context = self._contexts.pop(host, None)
        if context is not None:
            await context.close()

        self._host_warmup_until.pop(host, None)
        session_dir = self.session_root / self.sanitize_host(host)
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)

    async def wait_for_usable_page(self, page, allow_reload: bool = True) -> None:
        deadline = time.monotonic() + min(max(self.timeout_ms / 1000, 18), 35)
        html = await page.content()
        reloaded = False

        while time.monotonic() < deadline:
            if not self.looks_like_challenge(html):
                return

            await page.mouse.move(180, 140)
            await page.mouse.move(520, 420)
            await page.evaluate("window.scrollTo(0, Math.min(document.body.scrollHeight, 640))")
            await page.wait_for_timeout(1800)

            try:
                await page.wait_for_load_state("networkidle", timeout=3500)
            except PlaywrightTimeoutError:
                pass

            if allow_reload and not reloaded:
                try:
                    await page.reload(wait_until="domcontentloaded", timeout=self.timeout_ms)
                    reloaded = True
                except PlaywrightTimeoutError:
                    pass

            html = await page.content()

        if self.looks_like_challenge(html):
            raise RuntimeError("browser_challenge_not_solved")

    def looks_like_challenge(self, html: str) -> bool:
        normalized = html.lower()
        challenge_title = "<title>just a moment" in normalized or "<title>un momento" in normalized
        hard_markers = (
            "cf-mitigated" in normalized
            or "checking your browser" in normalized
            or "__cf_chl_rt_tk" in normalized
            or "enable javascript and cookies to continue" in normalized
        )
        cloudflare_shell = (
            "challenge-platform" in normalized
            and "challenges.cloudflare.com" in normalized
            and ("noindex,nofollow" in normalized or "default-src 'none'" in normalized)
        )
        return challenge_title or hard_markers or cloudflare_shell

    def sanitize_host(self, host: str) -> str:
        return host.replace(":", "_")
