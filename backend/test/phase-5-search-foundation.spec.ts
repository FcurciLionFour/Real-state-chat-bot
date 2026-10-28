import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { PropertiesService } from '../src/modules/properties/application/services/properties.service';
import { GoogleDiscoveryService } from '../src/modules/search/application/services/google-discovery.service';
import { SearchDedupeService } from '../src/modules/search/application/services/search-dedupe.service';
import { SearchExecutionService } from '../src/modules/search/application/services/search-execution.service';
import { PythonScraperSearchService } from '../src/modules/search/application/services/python-scraper-search.service';
import { SearchQueryBuilderService } from '../src/modules/search/application/services/search-query-builder.service';
import { SearchRankingService } from '../src/modules/search/application/services/search-ranking.service';
import { AllowedSourceDomainsService } from '../src/modules/sources/application/services/allowed-source-domains.service';
import { PropertySourceRegistryService } from '../src/modules/sources/application/services/property-source-registry.service';
import { ArgenpropSourceAdapter } from '../src/modules/sources/infrastructure/adapters/argenprop-source.adapter';
import { MudafySourceAdapter } from '../src/modules/sources/infrastructure/adapters/mudafy-source.adapter';
import { ProperatiSourceAdapter } from '../src/modules/sources/infrastructure/adapters/properati-source.adapter';
import { ZonapropSourceAdapter } from '../src/modules/sources/infrastructure/adapters/zonaprop-source.adapter';

async function testSearchQueryBuilderBuildsReasonableQueries() {
  const service = new SearchQueryBuilderService();

  const queries = service.buildDiscoveryQueries({
    operation: 'BUY',
    propertyTypes: ['APARTMENT'],
    locations: ['Palermo'],
    priceMin: null,
    priceMax: 140000,
    currency: 'USD',
    rooms: 2,
    bedrooms: 1,
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(queries.length, 4);
  assert.equal(queries[0], 'departamento venta Palermo 2 ambientes 1 dormitorio balcon');
  assert.equal(queries[1], 'departamento venta Palermo 2 ambientes 1 dormitorio balcon publicacion');
  assert.equal(queries[2], 'departamento venta Palermo 2 ambientes 1 dormitorio balcon ficha');
  assert.equal(queries[3], 'departamento venta Palermo 2 ambientes 1 dormitorio balcon hasta USD 140000 detalle');
}

async function testAllowedSourceDomainsServiceFiltersAndLimitsUrls() {
  const service = new AllowedSourceDomainsService();

  const filtered = service.filterCandidateUrls([
    'https://www.zonaprop.com.ar/departamentos/palermo-1.html#gallery',
    'https://www.zonaprop.com.ar/departamentos/palermo-1.html',
    'https://www.zonaprop.com.ar/departamentos/palermo-2.html',
    'https://www.zonaprop.com.ar/departamentos/palermo-3.html',
    'https://www.zonaprop.com.ar/departamentos/palermo-4.html',
    'https://www.zonaprop.com.ar/departamentos/palermo-5.html',
    'https://www.zonaprop.com.ar/departamentos/palermo-6.html',
    'ftp://www.zonaprop.com.ar/departamentos/palermo-7.html',
    'https://www.google.com/search?q=palermo',
  ]);

  assert.equal(service.canUseUrl('https://www.argenprop.com/departamento-en-palermo'), true);
  assert.equal(service.canUseUrl('https://example.com/departamento-en-palermo'), false);
  assert.equal(filtered.length, 5);
  assert.equal(filtered[0], 'https://www.zonaprop.com.ar/departamentos/palermo-1.html');
}

async function testPropertySourceRegistryPrefersDetailPagesOverCategoryUrls() {
  const service = new PropertySourceRegistryService(
    new ZonapropSourceAdapter(),
    new ArgenpropSourceAdapter(),
    new ProperatiSourceAdapter(),
    new MudafySourceAdapter(),
  );

  const filtered = service.filterSupportedUrls([
    'https://www.zonaprop.com.ar/departamentos-venta-palermo.html',
    'https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html',
    'https://www.argenprop.com/departamentos/venta/palermo',
    'https://www.argenprop.com/departamento-en-venta-en-palermo-1422334455',
  ]);

  assert.deepEqual(filtered, [
    'https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html',
    'https://www.argenprop.com/departamento-en-venta-en-palermo-1422334455',
  ]);
}

async function testPropertySourceRegistryFallsBackToListingUrlsWhenThereAreNoDetailPages() {
  const service = new PropertySourceRegistryService(
    new ZonapropSourceAdapter(),
    new ArgenpropSourceAdapter(),
    new ProperatiSourceAdapter(),
    new MudafySourceAdapter(),
  );

  const filtered = service.filterSupportedUrls([
    'https://www.zonaprop.com.ar/departamentos-venta-palermo.html',
    'https://www.argenprop.com/departamentos/venta/palermo',
  ]);

  assert.deepEqual(filtered, [
    'https://www.zonaprop.com.ar/departamentos-venta-palermo.html',
    'https://www.argenprop.com/departamentos/venta/palermo',
  ]);
}

async function testGoogleDiscoveryStaysDisabledWithoutCredentials() {
  const service = new GoogleDiscoveryService(
    {
      get: (_key: string, defaultValue: string) => defaultValue,
    } as unknown as ConfigService,
    new AllowedSourceDomainsService(),
    {
      getJson: async () => null,
      setJson: async () => true,
    } as never,
    {
      warn: () => undefined,
      logEvent: () => undefined,
    } as unknown as LoggerService,
  );

  const result = await service.discover(['departamento venta Palermo']);

  assert.equal(result.enabled, false);
  assert.deepEqual(result.candidateUrls, []);
  assert.deepEqual(result.attemptedQueries, ['departamento venta Palermo']);
}

async function testSearchExecutionFallsBackToMockWhileRealPipelineIsNotReady() {
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: false,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: [],
      }),
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
      get: async () => null,
      set: async () => undefined,
    } as never,
    {
      search: () => [
        {
          source: 'mock-source',
          sourceUrl: 'https://example.com/mock-property-1',
          title: 'Departamento mock en Palermo',
          operation: 'BUY',
          propertyType: 'APARTMENT',
          price: 140000,
          currency: 'USD',
          expenses: 100,
          city: 'CABA',
          neighborhood: 'Palermo',
          locationText: 'Palermo, Capital Federal',
          rooms: 2,
          bedrooms: 1,
          bathrooms: 1,
          areaTotal: 48,
          areaCovered: 44,
          features: ['BALCONY'],
          images: ['https://example.com/img-1.jpg'],
          scrapedAt: '2026-04-08T00:00:00.000Z',
          publishedAt: '2026-04-07T00:00:00.000Z',
          rank: {
            position: 1,
            score: 0.9,
            reasons: ['Coincide con tu zona'],
          },
        },
      ],
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.queryText, 'departamento venta Palermo 2 ambientes 1 dormitorio balcon');
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['mock-source']);
}

async function testSearchExecutionUsesPythonScraperBeforeLegacyPipeline() {
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => {
        throw new Error('legacy_discovery_should_not_run');
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
    {
      isEnabled: () => true,
      search: async () => ({
        items: [
          {
            source: 'argenprop',
            sourceUrl: 'https://www.argenprop.com/departamento-en-venta-en-palermo-1422334455',
            publisher: 'Terrazas & Balcones',
            contactPhone: null,
            contactWhatsApp: 'https://wa.me/5491166009000',
            title: 'Departamento en venta de 2 ambientes en Palermo',
            description: '2 ambientes con balcon.',
            operation: 'BUY',
            propertyType: 'APARTMENT',
            price: 128000,
            currency: 'USD',
            expenses: 98000,
            city: 'CABA',
            neighborhood: 'Palermo',
            locationText: 'Palermo, Capital Federal',
            rooms: 2,
            bedrooms: 1,
            bathrooms: 1,
            areaTotal: 51,
            areaCovered: 47,
            features: ['BALCONY'],
            images: ['https://img.argenprop.com/456.jpg'],
            scrapedAt: '2026-04-11T00:00:00.000Z',
            publishedAt: '2026-04-06T10:00:00.000Z',
          },
        ],
        sourcesUsed: ['argenprop'],
        partialFailures: [],
      }),
    } as never,
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['argenprop']);
  assert.equal(result.results[0].source, 'argenprop');
  assert.equal(result.results[0].publisher, 'Terrazas & Balcones');
  assert.equal(result.results[0].contactWhatsApp, 'https://wa.me/5491166009000');
  assert.equal(result.results[0].rank.position, 1);
}

async function testZonapropAdapterExtractsStructuredListingFromHtml() {
  const adapter = new ZonapropSourceAdapter();
  const html = `
    <html>
      <head>
        <title>Departamento en venta en Palermo Hollywood - Zonaprop</title>
        <meta property="og:title" content="Departamento en venta en Palermo Hollywood">
        <meta property="og:description" content="2 ambientes con balcon y cochera. Expensas 120000.">
        <meta property="og:image" content="https://img.zonaprop.com/123.jpg">
        <meta property="product:price:amount" content="140000">
        <meta property="product:price:currency" content="USD">
        <meta property="article:published_time" content="2026-04-07T12:00:00.000Z">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Departamento en venta en Palermo Hollywood",
            "description": "2 ambientes con balcon y cochera. Expensas 120000.",
            "image": ["https://img.zonaprop.com/123.jpg"],
            "offers": {
              "@type": "Offer",
              "price": "140000",
              "priceCurrency": "USD"
            },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Palermo Hollywood, Capital Federal",
              "addressLocality": "CABA",
              "addressRegion": "CABA",
              "addressCountry": "AR"
            },
            "floorSize": {
              "@type": "QuantitativeValue",
              "value": "48"
            },
            "numberOfRooms": 2,
            "numberOfBedrooms": 1,
            "numberOfBathroomsTotal": 1
          }
        </script>
      </head>
      <body>
        <div>48 m2 totales</div>
        <div>44 m2 cubiertos</div>
      </body>
    </html>
  `;

  const result = await adapter.extract('https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html', html);

  assert.ok(result);
  assert.equal(result?.source, 'zonaprop');
  assert.equal(result?.operation, 'BUY');
  assert.equal(result?.propertyType, 'APARTMENT');
  assert.equal(result?.price, 140000);
  assert.equal(result?.currency, 'USD');
  assert.equal(result?.city, 'CABA');
  assert.equal(result?.neighborhood, 'Palermo');
  assert.equal(result?.rooms, 2);
  assert.equal(result?.bedrooms, 1);
  assert.equal(result?.bathrooms, 1);
  assert.equal(result?.areaTotal, 48);
  assert.equal(result?.areaCovered, 44);
  assert.deepEqual(result?.images, ['https://img.zonaprop.com/123.jpg']);
  assert.deepEqual(result?.features, ['BALCONY', 'GARAGE']);
}

async function testSearchExecutionExtractsRealListingWhenAdapterCanHandleCandidateUrl() {
  const adapter = new ZonapropSourceAdapter();
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: true,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: ['https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html'],
      }),
    } as never,
    {
      fetch: async () => `
        <html>
          <head>
            <meta property="og:title" content="Departamento en venta en Palermo Hollywood">
            <meta property="og:description" content="2 ambientes con balcon.">
            <meta property="product:price:amount" content="140000">
            <meta property="product:price:currency" content="USD">
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Departamento en venta en Palermo Hollywood",
                "offers": { "price": "140000", "priceCurrency": "USD" },
                "address": { "streetAddress": "Palermo Hollywood, Capital Federal", "addressLocality": "CABA" },
                "floorSize": { "value": "48" },
                "numberOfRooms": 2,
                "numberOfBedrooms": 1,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>48 m2 totales</body>
        </html>
      `,
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['zonaprop']);
  assert.equal(result.results[0].source, 'zonaprop');
  assert.equal(result.results[0].rank.position, 1);
  assert.equal(result.results[0].rank.score > 0.5, true);
}

async function testArgenpropAdapterExtractsStructuredListingFromHtml() {
  const adapter = new ArgenpropSourceAdapter();
  const html = `
    <html>
      <head>
        <title>Departamento en venta de 2 ambientes en Palermo - Argenprop</title>
        <meta property="og:title" content="Departamento en venta de 2 ambientes en Palermo">
        <meta property="og:description" content="2 ambientes con balcon, cochera y expensas 98000.">
        <meta property="og:image" content="https://img.argenprop.com/456.jpg">
        <meta property="product:price:amount" content="128000">
        <meta property="product:price:currency" content="USD">
        <meta property="article:published_time" content="2026-04-06T10:00:00.000Z">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Departamento en venta de 2 ambientes en Palermo",
            "description": "2 ambientes con balcon, cochera y expensas 98000.",
            "image": ["https://img.argenprop.com/456.jpg"],
            "offers": {
              "@type": "Offer",
              "price": "128000",
              "priceCurrency": "USD"
            },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Palermo, Capital Federal",
              "addressLocality": "CABA",
              "addressRegion": "CABA",
              "addressCountry": "AR"
            },
            "floorSize": {
              "@type": "QuantitativeValue",
              "value": "51"
            },
            "numberOfRooms": 2,
            "numberOfBedrooms": 1,
            "numberOfBathroomsTotal": 1
          }
        </script>
      </head>
      <body>
        <div>51 m2 totales</div>
        <div>47 m2 cubiertos</div>
      </body>
    </html>
  `;

  const result = await adapter.extract(
    'https://www.argenprop.com/departamento-en-venta-en-palermo-1422334455',
    html,
  );

  assert.ok(result);
  assert.equal(result?.source, 'argenprop');
  assert.equal(result?.operation, 'BUY');
  assert.equal(result?.propertyType, 'APARTMENT');
  assert.equal(result?.price, 128000);
  assert.equal(result?.currency, 'USD');
  assert.equal(result?.city, 'CABA');
  assert.equal(result?.neighborhood, 'Palermo');
  assert.equal(result?.rooms, 2);
  assert.equal(result?.bedrooms, 1);
  assert.equal(result?.bathrooms, 1);
  assert.equal(result?.areaTotal, 51);
  assert.equal(result?.areaCovered, 47);
  assert.deepEqual(result?.images, ['https://img.argenprop.com/456.jpg']);
  assert.deepEqual(result?.features, ['BALCONY', 'GARAGE']);
}

async function testSearchExecutionUsesArgenpropAdapterWhenCandidateMatchesSecondSource() {
  const adapter = new ArgenpropSourceAdapter();
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: true,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: ['https://www.argenprop.com/departamento-en-venta-en-palermo-1422334455'],
      }),
    } as never,
    {
      fetch: async () => `
        <html>
          <head>
            <meta property="og:title" content="Departamento en venta de 2 ambientes en Palermo">
            <meta property="og:description" content="2 ambientes con balcon.">
            <meta property="product:price:amount" content="128000">
            <meta property="product:price:currency" content="USD">
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Departamento en venta de 2 ambientes en Palermo",
                "offers": { "price": "128000", "priceCurrency": "USD" },
                "address": { "streetAddress": "Palermo, Capital Federal", "addressLocality": "CABA" },
                "floorSize": { "value": "51" },
                "numberOfRooms": 2,
                "numberOfBedrooms": 1,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>51 m2 totales</body>
        </html>
      `,
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['argenprop']);
  assert.equal(result.results[0].source, 'argenprop');
  assert.equal(result.results[0].rank.position, 1);
  assert.equal(result.results[0].rank.score > 0.5, true);
}

async function testProperatiAdapterExtractsStructuredListingFromHtml() {
  const adapter = new ProperatiSourceAdapter();
  const html = `
    <html>
      <head>
        <title>Departamento en venta en Palermo Hollywood | Properati</title>
        <meta property="og:title" content="Departamento en venta en Palermo Hollywood">
        <meta property="og:description" content="2 ambientes con balcon, cochera y expensas 87000.">
        <meta property="og:image" content="https://img.properati.com/789.jpg">
        <meta property="product:price:amount" content="132000">
        <meta property="product:price:currency" content="USD">
        <meta property="article:published_time" content="2026-04-05T09:30:00.000Z">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Departamento en venta en Palermo Hollywood",
            "description": "2 ambientes con balcon, cochera y expensas 87000.",
            "image": ["https://img.properati.com/789.jpg"],
            "offers": {
              "@type": "Offer",
              "price": "132000",
              "priceCurrency": "USD"
            },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Palermo Hollywood, Capital Federal",
              "addressLocality": "CABA",
              "addressRegion": "CABA",
              "addressCountry": "AR"
            },
            "floorSize": {
              "@type": "QuantitativeValue",
              "value": "50"
            },
            "numberOfRooms": 2,
            "numberOfBedrooms": 1,
            "numberOfBathroomsTotal": 1
          }
        </script>
      </head>
      <body>
        <div>50 m2 totales</div>
        <div>46 m2 cubiertos</div>
      </body>
    </html>
  `;

  const result = await adapter.extract(
    'https://www.properati.com.ar/departamento-en-venta-palermo-hollywood-properati-abc123',
    html,
  );

  assert.ok(result);
  assert.equal(result?.source, 'properati');
  assert.equal(result?.operation, 'BUY');
  assert.equal(result?.propertyType, 'APARTMENT');
  assert.equal(result?.price, 132000);
  assert.equal(result?.currency, 'USD');
  assert.equal(result?.city, 'CABA');
  assert.equal(result?.neighborhood, 'Palermo');
  assert.equal(result?.rooms, 2);
  assert.equal(result?.bedrooms, 1);
  assert.equal(result?.bathrooms, 1);
  assert.equal(result?.areaTotal, 50);
  assert.equal(result?.areaCovered, 46);
  assert.deepEqual(result?.images, ['https://img.properati.com/789.jpg']);
  assert.deepEqual(result?.features, ['BALCONY', 'GARAGE']);
}

async function testSearchExecutionUsesProperatiAdapterWhenCandidateMatchesThirdSource() {
  const adapter = new ProperatiSourceAdapter();
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: true,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: ['https://www.properati.com.ar/departamento-en-venta-palermo-hollywood-properati-abc123'],
      }),
    } as never,
    {
      fetch: async () => `
        <html>
          <head>
            <meta property="og:title" content="Departamento en venta en Palermo Hollywood">
            <meta property="og:description" content="2 ambientes con balcon.">
            <meta property="product:price:amount" content="132000">
            <meta property="product:price:currency" content="USD">
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Departamento en venta en Palermo Hollywood",
                "offers": { "price": "132000", "priceCurrency": "USD" },
                "address": { "streetAddress": "Palermo Hollywood, Capital Federal", "addressLocality": "CABA" },
                "floorSize": { "value": "50" },
                "numberOfRooms": 2,
                "numberOfBedrooms": 1,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>50 m2 totales</body>
        </html>
      `,
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['properati']);
  assert.equal(result.results[0].source, 'properati');
  assert.equal(result.results[0].rank.position, 1);
  assert.equal(result.results[0].rank.score > 0.5, true);
}

async function testMudafyAdapterExtractsStructuredListingFromHtml() {
  const adapter = new MudafySourceAdapter();
  const html = `
    <html>
      <head>
        <title>Departamento en venta en Palermo Soho | Mudafy</title>
        <meta property="og:title" content="Departamento en venta en Palermo Soho">
        <meta property="og:description" content="2 ambientes con balcon, cochera y expensas 91000.">
        <meta property="og:image" content="https://img.mudafy.com/999.jpg">
        <meta property="product:price:amount" content="138000">
        <meta property="product:price:currency" content="USD">
        <meta property="article:published_time" content="2026-04-04T11:15:00.000Z">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Departamento en venta en Palermo Soho",
            "description": "2 ambientes con balcon, cochera y expensas 91000.",
            "image": ["https://img.mudafy.com/999.jpg"],
            "offers": {
              "@type": "Offer",
              "price": "138000",
              "priceCurrency": "USD"
            },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Palermo Soho, Capital Federal",
              "addressLocality": "CABA",
              "addressRegion": "CABA",
              "addressCountry": "AR"
            },
            "floorSize": {
              "@type": "QuantitativeValue",
              "value": "49"
            },
            "numberOfRooms": 2,
            "numberOfBedrooms": 1,
            "numberOfBathroomsTotal": 1
          }
        </script>
      </head>
      <body>
        <div>49 m2 totales</div>
        <div>45 m2 cubiertos</div>
      </body>
    </html>
  `;

  const result = await adapter.extract(
    'https://www.mudafy.com.ar/departamento-en-venta-palermo-soho-mudafy-xyz789',
    html,
  );

  assert.ok(result);
  assert.equal(result?.source, 'mudafy');
  assert.equal(result?.operation, 'BUY');
  assert.equal(result?.propertyType, 'APARTMENT');
  assert.equal(result?.price, 138000);
  assert.equal(result?.currency, 'USD');
  assert.equal(result?.city, 'CABA');
  assert.equal(result?.neighborhood, 'Palermo');
  assert.equal(result?.rooms, 2);
  assert.equal(result?.bedrooms, 1);
  assert.equal(result?.bathrooms, 1);
  assert.equal(result?.areaTotal, 49);
  assert.equal(result?.areaCovered, 45);
  assert.deepEqual(result?.images, ['https://img.mudafy.com/999.jpg']);
  assert.deepEqual(result?.features, ['BALCONY', 'GARAGE']);
}

async function testSearchExecutionUsesMudafyAdapterWhenCandidateMatchesFourthSource() {
  const adapter = new MudafySourceAdapter();
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'google-programmable-search',
        enabled: true,
        attemptedQueries: ['departamento venta Palermo'],
        candidateUrls: ['https://www.mudafy.com.ar/departamento-en-venta-palermo-soho-mudafy-xyz789'],
      }),
    } as never,
    {
      fetch: async () => `
        <html>
          <head>
            <meta property="og:title" content="Departamento en venta en Palermo Soho">
            <meta property="og:description" content="2 ambientes con balcon.">
            <meta property="product:price:amount" content="138000">
            <meta property="product:price:currency" content="USD">
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Departamento en venta en Palermo Soho",
                "offers": { "price": "138000", "priceCurrency": "USD" },
                "address": { "streetAddress": "Palermo Soho, Capital Federal", "addressLocality": "CABA" },
                "floorSize": { "value": "49" },
                "numberOfRooms": 2,
                "numberOfBedrooms": 1,
                "numberOfBathroomsTotal": 1
              }
            </script>
          </head>
          <body>49 m2 totales</body>
        </html>
      `,
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['mudafy']);
  assert.equal(result.results[0].source, 'mudafy');
  assert.equal(result.results[0].rank.position, 1);
  assert.equal(result.results[0].rank.score > 0.5, true);
}

async function testSearchExecutionDiscardsAggregateListingPagesAndFallsBackCleanly() {
  const adapter = {
    sourceName: 'zonaprop',
    isDetailUrl: () => false,
    extract: async (url: string) => ({
      externalId: null,
      source: 'zonaprop',
      sourceUrl: url,
      title: '12.559 Departamentos en venta en Palermo, CABA - Zonaprop',
      description: 'Resultados de busqueda',
      operation: 'BUY',
      propertyType: 'APARTMENT',
      price: null,
      currency: null,
      expenses: null,
      city: 'CABA',
      neighborhood: 'Palermo',
      locationText: 'Palermo, Capital Federal',
      rooms: null,
      bedrooms: null,
      bathrooms: null,
      areaTotal: null,
      areaCovered: null,
      features: [],
      images: [],
      scrapedAt: '2026-04-11T00:00:00.000Z',
      publishedAt: null,
    }),
  };
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'vertex-ai-search',
        enabled: true,
        attemptedQueries: ['departamento Palermo'],
        candidateUrls: ['https://www.zonaprop.com.ar/departamentos-venta-palermo.html'],
      }),
    } as never,
    {
      fetch: async () => '<html></html>',
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
    } as never,
    new SearchDedupeService(),
    new SearchRankingService(),
    {
      get: async () => null,
      set: async () => undefined,
    } as never,
    {
      search: () => [
        {
          source: 'mock-source',
          sourceUrl: 'https://example.com/mock-property-1',
          title: 'Departamento mock en Palermo',
          operation: 'BUY',
          propertyType: 'APARTMENT',
          price: 140000,
          currency: 'USD',
          expenses: 100,
          city: 'CABA',
          neighborhood: 'Palermo',
          locationText: 'Palermo, Capital Federal',
          rooms: 2,
          bedrooms: 1,
          bathrooms: 1,
          areaTotal: 48,
          areaCovered: 44,
          features: ['BALCONY'],
          images: ['https://example.com/img-1.jpg'],
          scrapedAt: '2026-04-08T00:00:00.000Z',
          publishedAt: '2026-04-07T00:00:00.000Z',
          rank: {
            position: 1,
            score: 0.9,
            reasons: ['Coincide con tu zona'],
          },
        },
      ],
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['mock-source']);
}

async function testSearchExecutionDiscardsGenericPortalHomepagesAndFallsBackCleanly() {
  const adapter = {
    sourceName: 'argenprop',
    isDetailUrl: () => false,
    extract: async (url: string) => ({
      externalId: null,
      source: 'argenprop',
      sourceUrl: url,
      title: 'Argenprop - Alquiler y venta de departamentos, casas y otros inmuebles',
      description: 'Portal inmobiliario',
      operation: null,
      propertyType: null,
      price: null,
      currency: null,
      expenses: null,
      city: null,
      neighborhood: null,
      locationText: null,
      rooms: null,
      bedrooms: null,
      bathrooms: null,
      areaTotal: null,
      areaCovered: null,
      features: [],
      images: [],
      scrapedAt: '2026-04-11T00:00:00.000Z',
      publishedAt: null,
    }),
  };
  const service = new SearchExecutionService(
    new SearchQueryBuilderService(),
    {
      discover: async () => ({
        provider: 'vertex-ai-search',
        enabled: true,
        attemptedQueries: ['departamento Palermo publicacion'],
        candidateUrls: ['https://www.argenprop.com/'],
      }),
    } as never,
    {
      fetch: async () => '<html></html>',
    } as never,
    {
      filterSupportedUrls: (urls: string[]) => urls,
      findAdapterForUrl: () => adapter,
    } as never,
    new SearchDedupeService(),
    new SearchRankingService(),
    {
      get: async () => null,
      set: async () => undefined,
    } as never,
    {
      search: () => [
        {
          source: 'mock-source',
          sourceUrl: 'https://example.com/mock-property-1',
          title: 'Departamento mock en Palermo',
          operation: 'BUY',
          propertyType: 'APARTMENT',
          price: 140000,
          currency: 'USD',
          expenses: 100,
          city: 'CABA',
          neighborhood: 'Palermo',
          locationText: 'Palermo, Capital Federal',
          rooms: 2,
          bedrooms: 1,
          bathrooms: 1,
          areaTotal: 48,
          areaCovered: 44,
          features: ['BALCONY'],
          images: ['https://example.com/img-1.jpg'],
          scrapedAt: '2026-04-08T00:00:00.000Z',
          publishedAt: '2026-04-07T00:00:00.000Z',
          rank: {
            position: 1,
            score: 0.9,
            reasons: ['Coincide con tu zona'],
          },
        },
      ],
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
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: ['BALCONY'],
    sortPreference: null,
  });

  assert.equal(result.results.length, 1);
  assert.deepEqual(result.sourcesUsed, ['mock-source']);
}

async function testPropertiesServicePreservesExternalIdForRealListings() {
  const capturedInputs: unknown[] = [];
  const service = new PropertiesService({
    findById: async () => null,
    upsertBySourceUrl: async (input: unknown) => {
      capturedInputs.push(input);
      return { id: 'property-cache-1' };
    },
  } as never, {
    geocode: async () => null,
  } as never);

  await service.persistSearchResult({
    externalId: '1234567890',
    source: 'zonaprop',
    sourceUrl: 'https://www.zonaprop.com.ar/departamento-en-venta-palermo-hollywood-1234567890.html',
    publisher: 'Broker test',
    contactPhone: null,
    contactWhatsApp: 'https://wa.me/5491111111111',
    title: 'Departamento en venta en Palermo Hollywood',
    description: '2 ambientes con balcon',
    operation: 'BUY',
    propertyType: 'APARTMENT',
    price: 140000,
    currency: 'USD',
    expenses: 120000,
    country: 'Argentina',
    province: 'CABA',
    city: 'CABA',
    neighborhood: 'Palermo',
    locationText: 'Palermo Hollywood, Capital Federal',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    areaTotal: 48,
    areaCovered: 44,
    features: ['BALCONY'],
    images: ['https://img.zonaprop.com/123.jpg'],
    scrapedAt: '2026-04-08T00:00:00.000Z',
    publishedAt: '2026-04-07T12:00:00.000Z',
  });

  assert.equal(capturedInputs.length, 1);
  assert.equal((capturedInputs[0] as { externalId: string }).externalId, '1234567890');
  assert.equal((capturedInputs[0] as { publisher: string }).publisher, 'Broker test');
  assert.equal(
    (capturedInputs[0] as { contactWhatsApp: string }).contactWhatsApp,
    'https://wa.me/5491111111111',
  );
  assert.equal(
    ((capturedInputs[0] as { normalizedPayloadJson: { externalId: string } }).normalizedPayloadJson.externalId),
    '1234567890',
  );
  assert.equal(
    (
      capturedInputs[0] as {
        normalizedPayloadJson: { publisher: string; contactWhatsApp: string };
      }
    ).normalizedPayloadJson.publisher,
    'Broker test',
  );
  assert.equal(
    (
      capturedInputs[0] as {
        normalizedPayloadJson: { publisher: string; contactWhatsApp: string };
      }
    ).normalizedPayloadJson.contactWhatsApp,
    'https://wa.me/5491111111111',
  );
}

async function testPythonScraperSearchServiceNormalizesMojibakeAndSearchContextFields() {
  const service = new PythonScraperSearchService(
    {
      get: (key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'search.pythonScraperEnabled': true,
          'search.pythonScraperBaseUrl': 'http://localhost:8000',
          'search.pythonScraperTimeoutMs': 15000,
          'search.pythonScraperAllowBrowserFallback': true,
          'search.pythonScraperSources': ['argenprop', 'zonaprop', 'mudafy', 'properati'],
        };

        return key in values ? values[key] : defaultValue;
      },
    } as unknown as ConfigService,
    {
      logEvent: () => undefined,
    } as unknown as LoggerService,
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            externalId: 'zp-1',
            source: 'zonaprop',
            sourceUrl:
              'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-piso-de-5-ambientes-con-cochera-y-baulera-venta-58559823.html?n_pos=1',
            title: 'Piso de 5 Ambientes con BalcÃ³n',
            description: 'Departamento con ubicaciÃ³n premium.',
            operation: null,
            propertyType: 'garage',
            price: null,
            currency: null,
            expenses: null,
            city: 'CABA',
            neighborhood: 'Palermo',
            locationText: 'Palermo, Capital Federal',
            rooms: 5,
            bedrooms: 4,
            bathrooms: 2,
            areaTotal: 177,
            areaCovered: null,
            features: ['balcony', 'garage'],
            images: [],
            publishedAt: null,
            scrapedAt: new Date().toISOString(),
          },
        ],
        meta: {
          sourcesUsed: ['zonaprop'],
          partialFailures: [],
        },
      }),
    }) as Response;

  try {
    const result = await service.search({
      operation: 'BUY',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      priceMin: null,
      priceMax: 140000,
      currency: 'USD',
      rooms: null,
      bedrooms: null,
      bathrooms: null,
      areaMin: null,
      areaMax: null,
      expensesMax: null,
      features: [],
      sortPreference: null,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.title, 'Piso de 5 Ambientes con Balcón');
    assert.equal(result.items[0]?.description, 'Departamento con ubicación premium.');
    assert.equal(result.items[0]?.operation, 'BUY');
    assert.equal(result.items[0]?.propertyType, 'APARTMENT');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'search query builder creates constrained discovery queries',
      execute: testSearchQueryBuilderBuildsReasonableQueries,
    },
    {
      name: 'allowed domain filter keeps only supported URLs with limits',
      execute: testAllowedSourceDomainsServiceFiltersAndLimitsUrls,
    },
    {
      name: 'source registry prioritizes likely detail pages over listing pages',
      execute: testPropertySourceRegistryPrefersDetailPagesOverCategoryUrls,
    },
    {
      name: 'source registry falls back to listing pages when detail pages are absent',
      execute: testPropertySourceRegistryFallsBackToListingUrlsWhenThereAreNoDetailPages,
    },
    {
      name: 'google discovery is disabled cleanly without credentials',
      execute: testGoogleDiscoveryStaysDisabledWithoutCredentials,
    },
    {
      name: 'search execution falls back to mock while pipeline is incomplete',
      execute: testSearchExecutionFallsBackToMockWhileRealPipelineIsNotReady,
    },
    {
      name: 'search execution prioritizes python scraper when available',
      execute: testSearchExecutionUsesPythonScraperBeforeLegacyPipeline,
    },
    {
      name: 'zonaprop adapter extracts listing from structured html',
      execute: testZonapropAdapterExtractsStructuredListingFromHtml,
    },
    {
      name: 'search execution uses first real adapter when extraction succeeds',
      execute: testSearchExecutionExtractsRealListingWhenAdapterCanHandleCandidateUrl,
    },
    {
      name: 'argenprop adapter extracts listing from structured html',
      execute: testArgenpropAdapterExtractsStructuredListingFromHtml,
    },
    {
      name: 'search execution uses second real adapter when candidate matches argenprop',
      execute: testSearchExecutionUsesArgenpropAdapterWhenCandidateMatchesSecondSource,
    },
    {
      name: 'properati adapter extracts listing from structured html',
      execute: testProperatiAdapterExtractsStructuredListingFromHtml,
    },
    {
      name: 'search execution uses third real adapter when candidate matches properati',
      execute: testSearchExecutionUsesProperatiAdapterWhenCandidateMatchesThirdSource,
    },
    {
      name: 'mudafy adapter extracts listing from structured html',
      execute: testMudafyAdapterExtractsStructuredListingFromHtml,
    },
    {
      name: 'search execution uses fourth real adapter when candidate matches mudafy',
      execute: testSearchExecutionUsesMudafyAdapterWhenCandidateMatchesFourthSource,
    },
    {
      name: 'search execution discards aggregate listing pages before returning results',
      execute: testSearchExecutionDiscardsAggregateListingPagesAndFallsBackCleanly,
    },
    {
      name: 'search execution discards generic portal homepages before returning results',
      execute: testSearchExecutionDiscardsGenericPortalHomepagesAndFallsBackCleanly,
    },
    {
      name: 'properties service preserves external source identifiers for tracing',
      execute: testPropertiesServicePreservesExternalIdForRealListings,
    },
    {
      name: 'python scraper result normalization repairs mojibake and context gaps',
      execute: testPythonScraperSearchServiceNormalizesMojibakeAndSearchContextFields,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-5 search foundation tests');
  console.error(error);
  process.exitCode = 1;
});
