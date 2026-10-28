import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { AllowedSourceDomainsService } from '../../../sources/application/services/allowed-source-domains.service';
import { SearchDiscoveryProvider, SearchDiscoveryResult } from '../../domain/types/search-discovery.type';

type VertexSearchLiteResponse = {
  results?: Array<{
    document?: {
      derivedStructData?: Record<string, unknown>;
      structData?: Record<string, unknown>;
      id?: string;
    };
  }>;
};

@Injectable()
export class VertexDiscoveryService {
  private static readonly TTL_SECONDS = 300;
  private static readonly PROVIDER: SearchDiscoveryProvider = 'vertex-ai-search';

  constructor(
    private readonly configService: ConfigService,
    private readonly allowedSourceDomainsService: AllowedSourceDomainsService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  getProvider(): SearchDiscoveryProvider {
    return VertexDiscoveryService.PROVIDER;
  }

  isConfigured() {
    return this.getCredentialGaps().length === 0;
  }

  getCredentialGaps() {
    const gaps: string[] = [];

    if (!this.configService.get<string>('search.vertexApiKey', '').trim()) {
      gaps.push('VERTEX_AI_SEARCH_API_KEY');
    }

    if (!this.configService.get<string>('search.vertexProjectId', '').trim()) {
      gaps.push('VERTEX_AI_SEARCH_PROJECT_ID');
    }

    if (!this.configService.get<string>('search.vertexAppId', '').trim()) {
      gaps.push('VERTEX_AI_SEARCH_APP_ID');
    }

    return gaps;
  }

  async discover(queries: string[]): Promise<SearchDiscoveryResult> {
    const apiKey = this.configService.get<string>('search.vertexApiKey', '').trim();
    const projectId = this.configService.get<string>('search.vertexProjectId', '').trim();
    const location = this.configService.get<string>('search.vertexLocation', 'global').trim() || 'global';
    const collection = this.configService.get<string>('search.vertexCollection', 'default_collection').trim() || 'default_collection';
    const appId = this.configService.get<string>('search.vertexAppId', '').trim();
    const servingConfig =
      this.configService.get<string>('search.vertexServingConfig', 'default_search').trim() || 'default_search';
    const attemptedQueries = queries.slice(0, 4).filter((query) => query.length > 0);

    if (!apiKey || !projectId || !appId || attemptedQueries.length === 0) {
      return {
        provider: VertexDiscoveryService.PROVIDER,
        enabled: false,
        attemptedQueries,
        candidateUrls: [],
      };
    }

    const cacheKey = this.buildCacheKey({
      attemptedQueries,
      projectId,
      location,
      collection,
      appId,
      servingConfig,
    });
    const cached = await this.redisService.getJson<SearchDiscoveryResult>(cacheKey);
    if (cached) {
      this.logger.logEvent(
        'vertex discovery cache hit',
        {
          module: 'VertexDiscoveryService',
          action: 'vertex_discovery_cache_hit',
          attemptedQueriesCount: attemptedQueries.length,
          candidateCount: cached.candidateUrls.length,
        },
        VertexDiscoveryService.name,
      );
      return cached;
    }

    const discoveryStartedAt = Date.now();
    const discoveredUrls: string[] = [];
    const endpoint = this.buildEndpoint({
      apiKey,
      projectId,
      location,
      collection,
      appId,
      servingConfig,
    });

    for (const query of attemptedQueries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            query,
            pageSize: 10,
            userPseudoId: this.buildUserPseudoId(query),
          }),
        });

        if (!response.ok) {
          this.logger.warn(
            `Vertex discovery failed with status ${response.status} for query "${query}".`,
            VertexDiscoveryService.name,
          );
          continue;
        }

        const payload = (await response.json()) as VertexSearchLiteResponse;
        discoveredUrls.push(...this.extractCandidateUrls(payload));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown discovery error';
        this.logger.warn(`Vertex discovery request failed for query "${query}": ${message}`, VertexDiscoveryService.name);
      } finally {
        clearTimeout(timeout);
      }
    }

    const result: SearchDiscoveryResult = {
      provider: VertexDiscoveryService.PROVIDER,
      enabled: true,
      attemptedQueries,
      candidateUrls: this.allowedSourceDomainsService.filterCandidateUrls(discoveredUrls),
    };

    await this.redisService.setJson(cacheKey, result, VertexDiscoveryService.TTL_SECONDS);
    this.logger.logEvent(
      'vertex discovery completed',
      {
        module: 'VertexDiscoveryService',
        action: 'vertex_discovery_completed',
        attemptedQueriesCount: attemptedQueries.length,
        candidateCount: result.candidateUrls.length,
        durationMs: Date.now() - discoveryStartedAt,
      },
      VertexDiscoveryService.name,
    );

    return result;
  }

  private buildEndpoint(input: {
    apiKey: string;
    projectId: string;
    location: string;
    collection: string;
    appId: string;
    servingConfig: string;
  }) {
    return `https://discoveryengine.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/collections/${input.collection}/engines/${input.appId}/servingConfigs/${input.servingConfig}:searchLite?key=${encodeURIComponent(input.apiKey)}`;
  }

  private extractCandidateUrls(payload: VertexSearchLiteResponse) {
    const candidates: string[] = [];

    for (const result of payload.results ?? []) {
      const document = result.document;
      const possibleValues = [
        document?.derivedStructData?.['link'],
        document?.derivedStructData?.['url'],
        document?.structData?.['link'],
        document?.structData?.['url'],
        document?.id,
      ];

      for (const value of possibleValues) {
        if (typeof value === 'string' && value.startsWith('http')) {
          candidates.push(value);
        }
      }
    }

    return candidates;
  }

  private buildCacheKey(input: {
    attemptedQueries: string[];
    projectId: string;
    location: string;
    collection: string;
    appId: string;
    servingConfig: string;
  }) {
    const hash = createHash('sha1')
      .update(
        [
          VertexDiscoveryService.PROVIDER,
          input.projectId,
          input.location,
          input.collection,
          input.appId,
          input.servingConfig,
          input.attemptedQueries.join('||'),
        ].join('||'),
      )
      .digest('hex');
    return `search:discovery:${hash}`;
  }

  private buildUserPseudoId(query: string) {
    return createHash('sha1').update(query).digest('hex').slice(0, 32);
  }
}
