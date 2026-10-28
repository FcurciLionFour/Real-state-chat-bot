import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { RequestContextService } from '../src/infrastructure/observability/request-context.service';
import { SearchDedupeService } from '../src/modules/search/application/services/search-dedupe.service';
import { SearchExecutionService } from '../src/modules/search/application/services/search-execution.service';
import { SearchQueryBuilderService } from '../src/modules/search/application/services/search-query-builder.service';
import { SearchRankingService } from '../src/modules/search/application/services/search-ranking.service';
import { GoogleDiscoveryService } from '../src/modules/search/application/services/google-discovery.service';
import { SearchResultsCacheService } from '../src/modules/search/application/services/search-results-cache.service';
import { SearchFilters } from '../src/modules/search-state/domain/types/search-filters.type';
import { HtmlFetchService } from '../src/modules/sources/application/services/html-fetch.service';
import { AllowedSourceDomainsService } from '../src/modules/sources/application/services/allowed-source-domains.service';

function createLoggerStub() {
  return {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    logEvent: () => undefined,
    warnEvent: () => undefined,
    errorEvent: () => undefined,
  } as unknown as LoggerService;
}

async function testRequestContextStoresCorrelationFieldsAcrossTheFlow() {
  const service = new RequestContextService();

  service.run(
    {
      requestId: 'req-123',
      httpMethod: 'POST',
      httpPath: '/api/conversations/abc/messages',
    },
    () => {
      service.set({
        userId: 'user-1',
        conversationId: 'conversation-1',
      });
      service.set({
        searchRunId: 'search-run-1',
      });

      assert.deepEqual(service.snapshot(), {
        requestId: 'req-123',
        httpMethod: 'POST',
        httpPath: '/api/conversations/abc/messages',
        userId: 'user-1',
        conversationId: 'conversation-1',
        searchRunId: 'search-run-1',
      });
    },
  );
}

async function testStructuredLoggerMergesRequestContextAutomatically() {
  const requestContextService = new RequestContextService();
  const logger = new LoggerService(requestContextService);

  requestContextService.run(
    {
      requestId: 'req-999',
      userId: 'user-5',
      conversationId: 'conversation-9',
    },
    () => {
      const rawMessage = logger['serialize']('log', 'search execution completed', {
        module: 'SearchExecutionService',
        action: 'search_execution_completed',
      }) as string;
      const parsed = JSON.parse(rawMessage) as Record<string, unknown>;

      assert.equal(parsed.requestId, 'req-999');
      assert.equal(parsed.userId, 'user-5');
      assert.equal(parsed.conversationId, 'conversation-9');
      assert.equal(parsed.action, 'search_execution_completed');
    },
  );
}

async function testSearchResultsCacheReturnsStoredPayloadForSameFilters() {
  const store = new Map<string, string>();
  const service = new SearchResultsCacheService(
    {
      getJson: async (key: string) => {
        const value = store.get(key);
        return value ? JSON.parse(value) : null;
      },
      setJson: async (key: string, value: unknown) => {
        store.set(key, JSON.stringify(value));
        return true;
      },
    } as never,
    createLoggerStub(),
  );

  const filters: SearchFilters = {
    operation: 'BUY',
    propertyTypes: ['APARTMENT'],
    locations: ['Palermo'],
    priceMin: null,
    priceMax: 140000,
    currency: 'USD',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  };

  await service.set(filters, {
    queryText: 'departamento venta Palermo 2 ambientes balcon',
    results: [
      {
        externalId: 'zp-1',
        source: 'zonaprop',
        sourceUrl: 'https://www.zonaprop.com.ar/departamento-1.html',
        title: 'Departamento en Palermo con balcon',
        description: '2 ambientes',
        operation: 'BUY',
        propertyType: 'APARTMENT',
        price: 139000,
        currency: 'USD',
        expenses: 120000,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 49,
        areaCovered: 45,
        features: ['BALCONY'],
        images: [],
        scrapedAt: '2026-04-08T10:00:00.000Z',
        publishedAt: '2026-04-08T09:00:00.000Z',
        rank: {
          position: 1,
          score: 0.91,
          reasons: ['Coincide con tu zona'],
        },
      },
    ],
    sourcesUsed: ['zonaprop'],
  });

  const cached = await service.get(filters);

  assert.ok(cached);
  assert.equal(cached?.queryText, 'departamento venta Palermo 2 ambientes balcon');
  assert.equal(cached?.results.length, 1);
}

async function testGoogleDiscoveryCachesFilteredCandidateUrls() {
  const store = new Map<string, string>();
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({
        items: [
          { link: 'https://www.zonaprop.com.ar/departamento-palermo-1.html' },
          { link: 'https://www.google.com/search?q=palermo' },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const service = new GoogleDiscoveryService(
      {
        get: (key: string, defaultValue: string) => {
          if (key === 'search.googleApiKey') return 'fake-key';
          if (key === 'search.googleSearchEngineId') return 'fake-cx';
          return defaultValue;
        },
      } as unknown as ConfigService,
      new AllowedSourceDomainsService(),
      {
        getJson: async (key: string) => {
          const value = store.get(key);
          return value ? JSON.parse(value) : null;
        },
        setJson: async (key: string, value: unknown) => {
          store.set(key, JSON.stringify(value));
          return true;
        },
      } as never,
      createLoggerStub(),
    );

    const first = await service.discover(['departamento venta Palermo']);
    const second = await service.discover(['departamento venta Palermo']);

    assert.equal(fetchCalls, 1);
    assert.deepEqual(first.candidateUrls, ['https://www.zonaprop.com.ar/departamento-palermo-1.html']);
    assert.deepEqual(second.candidateUrls, ['https://www.zonaprop.com.ar/departamento-palermo-1.html']);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testHtmlFetchUsesRedisCacheBeforeNetwork() {
  const store = new Map<string, string>();
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      headers: {
        get: () => 'text/html; charset=utf-8',
      },
      text: async () => '<html><body>ok</body></html>',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const service = new HtmlFetchService(
      {
        get: async (key: string) => store.get(key) ?? null,
        set: async (key: string, value: string) => {
          store.set(key, value);
          return true;
        },
      } as never,
      createLoggerStub(),
    );

    const first = await service.fetch('https://www.zonaprop.com.ar/departamento-1.html');
    const second = await service.fetch('https://www.zonaprop.com.ar/departamento-1.html');

    assert.equal(fetchCalls, 1);
    assert.equal(first, '<html><body>ok</body></html>');
    assert.equal(second, '<html><body>ok</body></html>');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testSearchExecutionReturnsCachedResultsWithoutCallingDiscovery() {
  let discoveryCalls = 0;
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => {
        discoveryCalls += 1;
        return {
          provider: 'google-programmable-search',
          enabled: true,
          attemptedQueries: ['departamento venta Palermo'],
          candidateUrls: [],
        };
      },
    } as never,
    {
      fetch: async () => null,
    } as never,
    {
      filterSupportedUrls: () => [],
    } as never,
    new SearchDedupeService(),
    new SearchRankingService(),
    {
      get: async () => ({
        queryText: 'departamento venta Palermo 2 ambientes balcon',
        results: [
          {
            externalId: 'zp-1',
            source: 'zonaprop',
            sourceUrl: 'https://www.zonaprop.com.ar/departamento-1.html',
            title: 'Departamento en Palermo con balcon',
            description: '2 ambientes',
            operation: 'BUY',
            propertyType: 'APARTMENT',
            price: 139000,
            currency: 'USD',
            expenses: 120000,
            city: 'CABA',
            neighborhood: 'Palermo',
            locationText: 'Palermo, Capital Federal',
            rooms: 2,
            bedrooms: 1,
            bathrooms: 1,
            areaTotal: 49,
            areaCovered: 45,
            features: ['BALCONY'],
            images: [],
            scrapedAt: '2026-04-08T10:00:00.000Z',
            publishedAt: '2026-04-08T09:00:00.000Z',
            rank: {
              position: 1,
              score: 0.91,
              reasons: ['Coincide con tu zona'],
            },
          },
        ],
        sourcesUsed: ['zonaprop'],
      }),
      set: async () => undefined,
    } as never,
    {
      search: () => [],
    } as never,
    createLoggerStub(),
  );

  const result = await service.execute({
    operation: 'BUY',
    propertyTypes: ['APARTMENT'],
    locations: ['Palermo'],
    priceMin: null,
    priceMax: 140000,
    currency: 'USD',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(discoveryCalls, 0);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['zonaprop']);
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'request context stores correlation fields across the flow',
      execute: testRequestContextStoresCorrelationFieldsAcrossTheFlow,
    },
    {
      name: 'structured logger merges request context automatically',
      execute: testStructuredLoggerMergesRequestContextAutomatically,
    },
    {
      name: 'search result cache returns stored payload for repeated filters',
      execute: testSearchResultsCacheReturnsStoredPayloadForSameFilters,
    },
    {
      name: 'google discovery caches filtered candidate urls',
      execute: testGoogleDiscoveryCachesFilteredCandidateUrls,
    },
    {
      name: 'html fetch uses cache before hitting the network again',
      execute: testHtmlFetchUsesRedisCacheBeforeNetwork,
    },
    {
      name: 'search execution serves cached results without discovery',
      execute: testSearchExecutionReturnsCachedResultsWithoutCallingDiscovery,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-8 cache and observability tests');
  console.error(error);
  process.exitCode = 1;
});
