import * as assert from 'node:assert/strict';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { SearchDedupeService } from '../src/modules/search/application/services/search-dedupe.service';
import { SearchExecutionService } from '../src/modules/search/application/services/search-execution.service';
import { SearchQueryBuilderService } from '../src/modules/search/application/services/search-query-builder.service';
import { SearchRankingService } from '../src/modules/search/application/services/search-ranking.service';
import { SearchRunService } from '../src/modules/search/application/services/search-run.service';

async function testSearchDedupeKeepsMostCompleteRepresentativeForSameExternalId() {
  const service = new SearchDedupeService();

  const results = service.dedupe([
    {
      externalId: 'zp-1',
      source: 'zonaprop',
      sourceUrl: 'https://www.zonaprop.com.ar/departamento-1.html',
      title: 'Departamento en Palermo',
      description: null,
      operation: 'BUY',
      propertyType: 'APARTMENT',
      price: 138000,
      currency: 'USD',
      expenses: null,
      city: 'CABA',
      neighborhood: 'Palermo',
      locationText: 'Palermo, Capital Federal',
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      areaTotal: 48,
      areaCovered: null,
      features: ['BALCONY'],
      images: [],
      scrapedAt: '2026-04-07T10:00:00.000Z',
      publishedAt: '2026-04-07T09:00:00.000Z',
    },
    {
      externalId: 'zp-1',
      source: 'zonaprop',
      sourceUrl: 'https://www.zonaprop.com.ar/departamento-1-duplicado.html',
      title: 'Departamento en Palermo con balcon',
      description: '2 ambientes con balcon y buena luz.',
      operation: 'BUY',
      propertyType: 'APARTMENT',
      price: 138000,
      currency: 'USD',
      expenses: 110000,
      city: 'CABA',
      neighborhood: 'Palermo',
      locationText: 'Palermo, Capital Federal',
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      areaTotal: 48,
      areaCovered: 44,
      features: ['BALCONY'],
      images: ['https://img.zonaprop.com/1.jpg'],
      scrapedAt: '2026-04-08T10:00:00.000Z',
      publishedAt: '2026-04-08T09:00:00.000Z',
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].sourceUrl, 'https://www.zonaprop.com.ar/departamento-1-duplicado.html');
  assert.equal(results[0].images.length, 1);
}

async function testSearchDedupeCollapsesStrongCrossSourceDuplicatesConservatively() {
  const service = new SearchDedupeService();

  const results = service.dedupe([
    {
      externalId: 'zp-1',
      source: 'zonaprop',
      sourceUrl: 'https://www.zonaprop.com.ar/departamento-palermo-1.html',
      title: 'Departamento 2 ambientes en Palermo Hollywood',
      description: 'Con balcon y cochera.',
      operation: 'BUY',
      propertyType: 'APARTMENT',
      price: 140000,
      currency: 'USD',
      expenses: 120000,
      city: 'CABA',
      neighborhood: 'Palermo',
      locationText: 'Palermo Hollywood, Capital Federal',
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      areaTotal: 49,
      areaCovered: 45,
      features: ['BALCONY', 'GARAGE'],
      images: ['https://img.zonaprop.com/1.jpg'],
      scrapedAt: '2026-04-08T10:00:00.000Z',
      publishedAt: '2026-04-08T09:00:00.000Z',
    },
    {
      externalId: 'arg-9',
      source: 'argenprop',
      sourceUrl: 'https://www.argenprop.com/departamento-palermo-9',
      title: 'Departamento en Palermo Hollywood de 2 ambientes',
      description: 'Balcon y cochera.',
      operation: 'BUY',
      propertyType: 'APARTMENT',
      price: 141000,
      currency: 'USD',
      expenses: 119000,
      city: 'CABA',
      neighborhood: 'Palermo',
      locationText: 'Palermo Hollywood, Capital Federal',
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      areaTotal: 50,
      areaCovered: 46,
      features: ['BALCONY', 'GARAGE'],
      images: ['https://img.argenprop.com/9.jpg'],
      scrapedAt: '2026-04-08T11:00:00.000Z',
      publishedAt: '2026-04-08T10:00:00.000Z',
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].source, 'argenprop');
}

async function testSearchRankingPrioritizesLocationBudgetAndFeatures() {
  const service = new SearchRankingService();

  const results = service.rank(
    {
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
      features: ['BALCONY', 'GARAGE'],
      sortPreference: null,
    },
    [
      {
        externalId: 'good-1',
        source: 'zonaprop',
        sourceUrl: 'https://www.zonaprop.com.ar/good-1.html',
        title: 'Departamento en Palermo con balcon y cochera',
        description: '2 ambientes completos.',
        operation: 'BUY',
        propertyType: 'APARTMENT',
        price: 138000,
        currency: 'USD',
        expenses: 120000,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 50,
        areaCovered: 46,
        features: ['BALCONY', 'GARAGE'],
        images: ['https://img.zonaprop.com/1.jpg'],
        scrapedAt: new Date().toISOString(),
        publishedAt: '2026-04-08T09:00:00.000Z',
      },
      {
        externalId: 'weak-1',
        source: 'properati',
        sourceUrl: 'https://www.properati.com.ar/weak-1.html',
        title: 'Departamento en CABA',
        description: null,
        operation: 'BUY',
        propertyType: 'APARTMENT',
        price: 165000,
        currency: 'USD',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Belgrano',
        locationText: 'Belgrano, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 42,
        features: [],
        images: [],
        scrapedAt: '2026-03-28T10:00:00.000Z',
        publishedAt: '2026-03-28T09:00:00.000Z',
      },
    ],
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].externalId, 'good-1');
  assert.equal(results[0].rank.position, 1);
  assert.equal(results[0].rank.score >= 0.8, true);
  assert.equal(results[0].rank.reasons.includes('Coincide con tu zona'), true);
  assert.equal(results[0].rank.reasons.includes('Esta dentro de tu presupuesto'), true);
  assert.equal(results[0].rank.reasonDetails?.matchedFeatures instanceof Array, true);
}

async function testSearchRankingFiltersIncompatibleRentBudgetAndCurrency() {
  const service = new SearchRankingService();

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      priceMin: null,
      priceMax: 800000,
      currency: 'ARS',
      rooms: null,
      roomsAnyOf: [1, 2],
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    },
    [
      {
        externalId: 'ok-ars',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-ok',
        title: 'Departamento monoambiente en alquiler Palermo',
        description: 'Monoambiente publicado en pesos.',
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 930000,
        currency: 'ARS',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 1,
        bedrooms: null,
        bathrooms: 1,
        areaTotal: 35,
        areaCovered: 32,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
      {
        externalId: 'bad-usd',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-usd',
        title: 'Departamento 2 ambientes en alquiler Palermo',
        description: 'Publicado en dolares.',
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 1150,
        currency: 'USD',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 40,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
      {
        externalId: 'bad-over-budget',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-caro',
        title: 'Departamento 2 ambientes en alquiler Palermo',
        description: 'Publicado muy arriba del presupuesto.',
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 980000,
        currency: 'ARS',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 40,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
    ],
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].externalId, 'ok-ars');
}

async function testSearchRankingFiltersRoomsAnyOf() {
  const service = new SearchRankingService();

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      priceMin: null,
      priceMax: null,
      currency: null,
      rooms: null,
      roomsAnyOf: [1, 2],
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    },
    [
      {
        externalId: 'two-rooms',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-2',
        title: 'Departamento 2 ambientes en Palermo',
        description: null,
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 700000,
        currency: 'ARS',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 40,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
      {
        externalId: 'three-rooms',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-3',
        title: 'Departamento 3 ambientes en Palermo',
        description: null,
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 750000,
        currency: 'ARS',
        expenses: null,
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        areaTotal: 55,
        areaCovered: 50,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
    ],
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].externalId, 'two-rooms');
}

async function testSearchRankingRejectsSamePoiNameInWrongProvince() {
  const service = new SearchRankingService();

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      geoConstraints: [
        {
          kind: 'PROXIMITY',
          sourceText: 'Alto Palermo',
          label: 'Alto Palermo Shopping',
          province: 'CABA',
          city: 'CABA',
          neighborhood: 'Palermo',
          latitude: -34.5881,
          longitude: -58.4106,
          radiusMeters: 1000,
          confidence: 0.95,
          provider: 'local-poi',
        },
      ],
      priceMin: null,
      priceMax: 1000000,
      currency: 'ARS',
      rooms: null,
      roomsAnyOf: [],
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    },
    [
      {
        externalId: 'cordoba-alto-palermo',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-en-alquiler-en-alto-palermo-2-ambientes-19476467',
        title: 'Emilio Pettoruti 2100',
        description: null,
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 690000,
        currency: 'ARS',
        expenses: null,
        province: 'Cordoba',
        city: 'Cordoba',
        neighborhood: 'Alto Palermo',
        locationText: 'Alto Palermo, Cordoba',
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 40,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
    ],
  );

  assert.equal(results.length, 0);
}

async function testSearchRankingRejectsExactGeoOutsideProximityRadius() {
  const service = new SearchRankingService();

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      geoConstraints: [
        {
          kind: 'PROXIMITY',
          sourceText: 'Alto Palermo',
          label: 'Alto Palermo Shopping',
          province: 'CABA',
          city: 'CABA',
          neighborhood: 'Palermo',
          latitude: -34.5881,
          longitude: -58.4106,
          radiusMeters: 1000,
          confidence: 0.95,
          provider: 'local-poi',
        },
      ],
      priceMin: null,
      priceMax: 1000000,
      currency: 'ARS',
      rooms: null,
      roomsAnyOf: [],
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    },
    [
      {
        externalId: 'palermo-far',
        source: 'argenprop',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-far',
        title: 'Departamento en Palermo lejos del Alto Palermo',
        description: null,
        operation: 'RENT',
        propertyType: 'APARTMENT',
        price: 690000,
        currency: 'ARS',
        expenses: null,
        province: 'CABA',
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        geo: {
          latitude: -34.5799,
          longitude: -58.4368,
          precision: 'exact',
          provider: 'test',
        },
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        areaTotal: 45,
        areaCovered: 40,
        features: [],
        images: [],
        scrapedAt: new Date().toISOString(),
        publishedAt: null,
      },
    ],
  );

  assert.equal(results.length, 0);
}

async function testSearchRankingPrioritizesCheaperRentResultsNearBudget() {
  const service = new SearchRankingService();
  const baseCandidate = {
    source: 'argenprop',
    operation: 'RENT' as const,
    propertyType: 'APARTMENT' as const,
    currency: 'ARS' as const,
    expenses: null,
    city: 'CABA',
    neighborhood: 'Palermo',
    locationText: 'Palermo, Capital Federal',
    rooms: 1,
    bedrooms: null,
    bathrooms: 1,
    areaTotal: 35,
    areaCovered: 32,
    features: [],
    images: ['https://img.argenprop.com/1.jpg'],
    scrapedAt: new Date().toISOString(),
    publishedAt: null,
  };

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      priceMin: null,
      priceMax: 700000,
      currency: 'ARS',
      rooms: 1,
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    },
    [
      {
        ...baseCandidate,
        externalId: 'above-flex-margin',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-850',
        title: 'Alquiler Departamento monoambiente en Palermo',
        price: 850000,
      },
      {
        ...baseCandidate,
        externalId: 'below-budget',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-650',
        title: 'Alquiler Departamento monoambiente en Palermo',
        price: 650000,
      },
    ],
  );

  assert.equal(results.length, 2);
  assert.equal(results[0].externalId, 'below-budget');
  assert.equal(
    (results[0].rank.reasonDetails?.budgetScore as number) >
      (results[1].rank.reasonDetails?.budgetScore as number),
    true,
  );
}

async function testSearchRankingRespectsPriceAscendingPreference() {
  const service = new SearchRankingService();
  const baseCandidate = {
    source: 'argenprop',
    operation: 'RENT' as const,
    propertyType: 'APARTMENT' as const,
    currency: 'ARS' as const,
    expenses: null,
    city: 'CABA',
    neighborhood: 'Palermo',
    locationText: 'Palermo, Capital Federal',
    rooms: 1,
    bedrooms: null,
    bathrooms: 1,
    areaTotal: 35,
    areaCovered: 32,
    features: [],
    images: ['https://img.argenprop.com/1.jpg'],
    scrapedAt: new Date().toISOString(),
    publishedAt: null,
  };

  const results = service.rank(
    {
      operation: 'RENT',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      priceMin: null,
      priceMax: 700000,
      currency: 'ARS',
      rooms: 1,
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: 'PRICE_ASC',
    },
    [
      {
        ...baseCandidate,
        externalId: 'known-expensive',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-700',
        title: 'Alquiler Departamento monoambiente en Palermo',
        price: 700000,
      },
      {
        ...baseCandidate,
        externalId: 'unknown-price',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-sin-precio',
        title: 'Alquiler Departamento monoambiente en Palermo',
        price: null,
      },
      {
        ...baseCandidate,
        externalId: 'known-cheaper',
        sourceUrl: 'https://www.argenprop.com/departamento-palermo-550',
        title: 'Alquiler Departamento monoambiente en Palermo',
        price: 550000,
      },
    ],
  );

  assert.equal(results.length, 3);
  assert.equal(results[0].externalId, 'known-cheaper');
  assert.equal(results[1].externalId, 'known-expensive');
  assert.equal(results[2].externalId, 'unknown-price');
}

async function testSearchExecutionDedupesBeforeReturningRankedResults() {
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: true,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: [
          'https://www.zonaprop.com.ar/departamento-palermo-1.html',
          'https://www.zonaprop.com.ar/departamento-palermo-1-duplicado.html',
        ],
      }),
    } as never,
    {
      fetch: async () => '<html></html>',
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => ({
        extract: async (url: string) => ({
          externalId: 'zp-1',
          source: 'zonaprop',
          sourceUrl: url,
          title: 'Departamento en Palermo con balcon',
          description: url.includes('duplicado') ? 'Version mas completa' : null,
          operation: 'BUY',
          propertyType: 'APARTMENT',
          price: 139000,
          currency: 'USD',
          expenses: 100000,
          city: 'CABA',
          neighborhood: 'Palermo',
          locationText: 'Palermo, Capital Federal',
          rooms: 2,
          bedrooms: 1,
          bathrooms: 1,
          areaTotal: 49,
          areaCovered: url.includes('duplicado') ? 45 : null,
          features: ['BALCONY'],
          images: url.includes('duplicado') ? ['https://img.zonaprop.com/1.jpg'] : [],
          scrapedAt: url.includes('duplicado') ? '2026-04-08T10:00:00.000Z' : '2026-04-08T09:00:00.000Z',
          publishedAt: '2026-04-08T09:00:00.000Z',
        }),
      }),
    } as never,
    new SearchDedupeService(),
    new SearchRankingService(),
    {
      get: async () => null,
      set: async () => undefined,
    } as never,
    {
      search: () => [],
    } as never,
    {
      warn: () => undefined,
      logEvent: () => undefined,
      warnEvent: () => undefined,
    } as unknown as LoggerService,
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

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].sourceUrl, 'https://www.zonaprop.com.ar/departamento-palermo-1-duplicado.html');
  assert.equal(result.results[0].rank.position, 1);
}

async function testSearchRunServicePersistsRankReasonDetails() {
  const createManyCalls: Array<Array<Record<string, unknown>>> = [];
  const service = new SearchRunService(
    {
      create: async () => ({ id: 'search-run-1' }),
    } as never,
    {
      createMany: async (input: Array<Record<string, unknown>>) => {
        createManyCalls.push(input);
        return undefined;
      },
    } as never,
    {
      logEvent: () => undefined,
    } as never,
  );

  await service.persistSearchRun({
    conversationId: 'conversation-1',
    filtersSnapshot: { locations: ['Palermo'] },
    queryText: 'departamento venta Palermo',
    sourcesUsed: ['zonaprop'],
    results: [
      {
        propertyCacheId: 'property-1',
        rank: {
          position: 1,
          score: 0.91,
          reasons: ['Coincide con tu zona'],
          reasonDetails: {
            locationScore: 1,
            budgetScore: 1,
            matchedFeatures: ['BALCONY'],
            withinBudget: true,
          },
        },
      },
    ],
  });

  assert.equal(createManyCalls.length, 1);
  assert.deepEqual(createManyCalls[0][0].rankReasonJson, {
    reasons: ['Coincide con tu zona'],
    locationScore: 1,
    budgetScore: 1,
    matchedFeatures: ['BALCONY'],
    withinBudget: true,
  });
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'dedupe keeps the most complete representative for duplicate external ids',
      execute: testSearchDedupeKeepsMostCompleteRepresentativeForSameExternalId,
    },
    {
      name: 'dedupe collapses only strong cross-source duplicates',
      execute: testSearchDedupeCollapsesStrongCrossSourceDuplicatesConservatively,
    },
    {
      name: 'ranking prioritizes location budget and requested features',
      execute: testSearchRankingPrioritizesLocationBudgetAndFeatures,
    },
    {
      name: 'ranking filters incompatible rent budget and currency',
      execute: testSearchRankingFiltersIncompatibleRentBudgetAndCurrency,
    },
    {
      name: 'ranking filters room alternatives as essential',
      execute: testSearchRankingFiltersRoomsAnyOf,
    },
    {
      name: 'ranking rejects same POI name in the wrong province',
      execute: testSearchRankingRejectsSamePoiNameInWrongProvince,
    },
    {
      name: 'ranking rejects exact coordinates outside proximity radius',
      execute: testSearchRankingRejectsExactGeoOutsideProximityRadius,
    },
    {
      name: 'ranking prioritizes cheaper rent results near budget',
      execute: testSearchRankingPrioritizesCheaperRentResultsNearBudget,
    },
    {
      name: 'ranking respects price ascending preference',
      execute: testSearchRankingRespectsPriceAscendingPreference,
    },
    {
      name: 'search execution dedupes extracted candidates before ranking',
      execute: testSearchExecutionDedupesBeforeReturningRankedResults,
    },
    {
      name: 'search run persistence stores explainable rank reasons',
      execute: testSearchRunServicePersistsRankReasonDetails,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-6 ranking and dedupe tests');
  console.error(error);
  process.exitCode = 1;
});
