import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { AllowedSourceDomainsService } from '../../../sources/application/services/allowed-source-domains.service';
import { SearchDiscoveryProvider, SearchDiscoveryResult } from '../../domain/types/search-discovery.type';

@Injectable()
export class GoogleDiscoveryService {
  private static readonly TTL_SECONDS = 300;
  private static readonly PROVIDER: SearchDiscoveryProvider = 'google-programmable-search';

  constructor(
    private readonly configService: ConfigService,
    private readonly allowedSourceDomainsService: AllowedSourceDomainsService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  getProvider(): SearchDiscoveryProvider {
    return GoogleDiscoveryService.PROVIDER;
  }

  isConfigured() {
    const apiKey = this.configService.get<string>('search.googleApiKey', '').trim();
    const searchEngineId = this.configService.get<string>('search.googleSearchEngineId', '').trim();
    return apiKey.length > 0 && searchEngineId.length > 0;
  }

  getCredentialGaps() {
    const gaps: string[] = [];

    if (!this.configService.get<string>('search.googleApiKey', '').trim()) {
      gaps.push('GOOGLE_SEARCH_API_KEY');
    }

    if (!this.configService.get<string>('search.googleSearchEngineId', '').trim()) {
      gaps.push('GOOGLE_SEARCH_ENGINE_ID');
    }

    return gaps;
  }

  async discover(queries: string[]): Promise<SearchDiscoveryResult> {
    const apiKey = this.configService.get<string>('search.googleApiKey', '');
    const searchEngineId = this.configService.get<string>('search.googleSearchEngineId', '');
    const attemptedQueries = queries.slice(0, 4).filter((query) => query.length > 0);

    if (!apiKey || !searchEngineId || attemptedQueries.length === 0) {
      return {
        provider: GoogleDiscoveryService.PROVIDER,
        enabled: false,
        attemptedQueries,
        candidateUrls: [],
      };
    }

    const cacheKey = this.buildCacheKey(attemptedQueries);
    const cached = await this.redisService.getJson<SearchDiscoveryResult>(cacheKey);
    if (cached) {
      this.logger.logEvent(
        'google discovery cache hit',
        {
          module: 'GoogleDiscoveryService',
          action: 'google_discovery_cache_hit',
          attemptedQueriesCount: attemptedQueries.length,
          candidateCount: cached.candidateUrls.length,
        },
        GoogleDiscoveryService.name,
      );
      return cached;
    }

    const discoveryStartedAt = Date.now();
    const discoveredUrls: string[] = [];

    for (const query of attemptedQueries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const searchParams = new URLSearchParams({
          key: apiKey,
          cx: searchEngineId,
          q: query,
          num: '10',
        });

        const response = await fetch(`https://www.googleapis.com/customsearch/v1?${searchParams.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          this.logger.warn(
            `Google discovery failed with status ${response.status} for query "${query}".`,
            GoogleDiscoveryService.name,
          );
          continue;
        }

        const payload = (await response.json()) as {
          items?: Array<{
            link?: string;
          }>;
        };

        for (const item of payload.items ?? []) {
          if (item.link) {
            discoveredUrls.push(item.link);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown discovery error';
        this.logger.warn(`Google discovery request failed for query "${query}": ${message}`, GoogleDiscoveryService.name);
      } finally {
        clearTimeout(timeout);
      }
    }

    const result: SearchDiscoveryResult = {
      provider: GoogleDiscoveryService.PROVIDER,
      enabled: true,
      attemptedQueries,
      candidateUrls: this.allowedSourceDomainsService.filterCandidateUrls(discoveredUrls),
    };

    await this.redisService.setJson(cacheKey, result, GoogleDiscoveryService.TTL_SECONDS);
    this.logger.logEvent(
      'google discovery completed',
      {
        module: 'GoogleDiscoveryService',
        action: 'google_discovery_completed',
        attemptedQueriesCount: attemptedQueries.length,
        candidateCount: result.candidateUrls.length,
        durationMs: Date.now() - discoveryStartedAt,
      },
      GoogleDiscoveryService.name,
    );

    return result;
  }

  private buildCacheKey(attemptedQueries: string[]) {
    const hash = createHash('sha1').update(attemptedQueries.join('||')).digest('hex');
    return `search:discovery:${hash}`;
  }
}
