import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';

@Injectable()
export class HtmlFetchService {
  private static readonly TTL_SECONDS = 900;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async fetch(url: string) {
    const cacheKey = `search:html:${url}`;
    const cachedHtml = await this.redisService.get(cacheKey);

    if (cachedHtml) {
      this.logger.logEvent(
        'html cache hit',
        {
          module: 'HtmlFetchService',
          action: 'html_cache_hit',
          url,
        },
        HtmlFetchService.name,
      );
      return cachedHtml;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const startedAt = Date.now();

    try {
      const response = await globalThis.fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'RealStateChatBotMvp/0.1 (+https://localhost)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`HTML fetch failed with status ${response.status} for ${url}.`, HtmlFetchService.name);
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        this.logger.warn(`Discarding non-HTML content fetched from ${url}.`, HtmlFetchService.name);
        return null;
      }

      const html = await response.text();
      await this.redisService.set(cacheKey, html, HtmlFetchService.TTL_SECONDS);
      this.logger.logEvent(
        'html fetched successfully',
        {
          module: 'HtmlFetchService',
          action: 'html_fetch_completed',
          url,
          durationMs: Date.now() - startedAt,
        },
        HtmlFetchService.name,
      );

      return html;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown HTML fetch error';
      this.logger.warn(`HTML fetch failed for ${url}: ${message}`, HtmlFetchService.name);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
