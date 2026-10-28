import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';

type SearchExecutionCacheEntry = {
  queryText: string;
  results: SearchResultItem[];
  sourcesUsed: string[];
};

@Injectable()
export class SearchResultsCacheService {
  private static readonly TTL_SECONDS = 120;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async get(filters: SearchFilters) {
    const cacheKey = this.buildCacheKey(filters);
    const cached = await this.redisService.getJson<SearchExecutionCacheEntry>(cacheKey);

    if (cached) {
      this.logger.logEvent(
        'search result cache hit',
        {
          module: 'SearchResultsCacheService',
          action: 'search_results_cache_hit',
          cacheKey,
          resultCount: cached.results.length,
        },
        SearchResultsCacheService.name,
      );
    }

    return cached;
  }

  async set(filters: SearchFilters, payload: SearchExecutionCacheEntry) {
    const cacheKey = this.buildCacheKey(filters);
    const persisted = await this.redisService.setJson(cacheKey, payload, SearchResultsCacheService.TTL_SECONDS);

    if (persisted) {
      this.logger.logEvent(
        'search result cache stored',
        {
          module: 'SearchResultsCacheService',
          action: 'search_results_cache_set',
          cacheKey,
          resultCount: payload.results.length,
          ttlSeconds: SearchResultsCacheService.TTL_SECONDS,
        },
        SearchResultsCacheService.name,
      );
    }
  }

  private buildCacheKey(filters: SearchFilters) {
    const normalizedPayload = JSON.stringify(filters);
    const hash = createHash('sha1').update(normalizedPayload).digest('hex');
    return `search:results:${hash}`;
  }
}
