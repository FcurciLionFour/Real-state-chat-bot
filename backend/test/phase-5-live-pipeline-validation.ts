import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { SearchExecutionService } from '../src/modules/search/application/services/search-execution.service';
import { SearchFilters } from '../src/modules/search-state/domain/types/search-filters.type';
import { AllowedSourceDomainsService } from '../src/modules/sources/application/services/allowed-source-domains.service';
import { PropertySourceRegistryService } from '../src/modules/sources/application/services/property-source-registry.service';

type CapturedLogEvent = {
  level: 'log' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
};

function buildLiveFilters(): SearchFilters {
  return {
    operation: parseNullableEnum(process.env.LIVE_SEARCH_OPERATION, ['BUY', 'RENT']),
    propertyTypes: parseEnumArray(process.env.LIVE_SEARCH_PROPERTY_TYPES, [
      'APARTMENT',
      'HOUSE',
      'PH',
      'LAND',
      'OFFICE',
      'LOCAL',
      'GARAGE',
    ], ['APARTMENT']),
    locations: parseStringArray(process.env.LIVE_SEARCH_LOCATIONS, ['Palermo']),
    priceMin: parseNullableNumber(process.env.LIVE_SEARCH_PRICE_MIN),
    priceMax: parseNullableNumber(process.env.LIVE_SEARCH_PRICE_MAX),
    currency: parseNullableEnum(process.env.LIVE_SEARCH_CURRENCY, ['USD', 'ARS']),
    rooms: parseNullableNumber(process.env.LIVE_SEARCH_ROOMS),
    bedrooms: parseNullableNumber(process.env.LIVE_SEARCH_BEDROOMS),
    bathrooms: parseNullableNumber(process.env.LIVE_SEARCH_BATHROOMS),
    areaMin: parseNullableNumber(process.env.LIVE_SEARCH_AREA_MIN),
    areaMax: parseNullableNumber(process.env.LIVE_SEARCH_AREA_MAX),
    expensesMax: parseNullableNumber(process.env.LIVE_SEARCH_EXPENSES_MAX),
    features: parseEnumArray(
      process.env.LIVE_SEARCH_FEATURES,
      [
        'BALCONY',
        'TERRACE',
        'PATIO',
        'GARAGE',
        'POOL',
        'BARBECUE',
        'GYM',
        'PROFESSIONAL_USE',
        'MORTGAGE_ELIGIBLE',
        'FURNISHED',
        'PETS_ALLOWED',
      ],
      [],
    ),
    sortPreference: parseNullableEnum(process.env.LIVE_SEARCH_SORT, ['RELEVANCE', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST']),
  };
}

async function run() {
  const discoveryProvider = resolveDiscoveryProvider();
  const missingDiscoveryEnv = getMissingDiscoveryEnv(discoveryProvider);

  if (missingDiscoveryEnv.length > 0) {
    console.error(
      `${missingDiscoveryEnv.join(' y ')} estan vacios en backend/.env. Cargalos antes de ejecutar npm run test:phase5:live.`,
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(LoggerService);
  const searchExecutionService = app.get(SearchExecutionService);
  const allowedSourceDomainsService = app.get(AllowedSourceDomainsService);
  const propertySourceRegistryService = app.get(PropertySourceRegistryService);
  const capturedLogs: CapturedLogEvent[] = [];
  const unsubscribe = logger.subscribe((event) => {
    capturedLogs.push(event);
  });
  const filters = buildLiveFilters();

  try {
    console.log('LIVE SEARCH FILTERS');
    console.log(JSON.stringify(filters, null, 2));
    console.log('ALLOWED DOMAINS');
    console.log(allowedSourceDomainsService.getAllowedDomains().join(', '));
    console.log('REGISTERED ADAPTERS');
    console.log(propertySourceRegistryService.getAdapters().map((adapter) => adapter.sourceName).join(', '));

    const result = await searchExecutionService.execute(filters);
    const fallbackEvent = capturedLogs.find((event) => event.metadata.action === 'search_execution_fallback');
    const completedEvent = capturedLogs.find((event) => event.metadata.action === 'search_execution_completed');
    const cacheHitEvent = capturedLogs.find((event) => event.metadata.action === 'search_execution_cache_hit');

    console.log('LIVE SEARCH QUERY');
    console.log(result.queryText);
    console.log('LIVE SEARCH SOURCES');
    console.log(result.sourcesUsed.join(', '));
    console.log(`LIVE SEARCH RESULT COUNT: ${result.results.length}`);

    for (const [index, item] of result.results.slice(0, 5).entries()) {
      console.log(`RESULT ${index + 1}`);
      console.log(
        JSON.stringify(
          {
            source: item.source,
            sourceUrl: item.sourceUrl,
            title: item.title,
            price: item.price,
            currency: item.currency,
            neighborhood: item.neighborhood,
            city: item.city,
            rank: item.rank,
          },
          null,
          2,
        ),
      );
    }

    if (cacheHitEvent) {
      console.log('NOTE: la corrida uso cache de resultados.');
    }

    assert.equal(
      fallbackEvent,
      undefined,
      `La validacion live cayo a fallback. Motivo: ${String(fallbackEvent?.metadata.reason ?? 'unknown')}`,
    );
    assert.equal(result.sourcesUsed.includes('mock-source'), false, 'La validacion live devolvio solo mock-source.');
    assert.ok(result.results.length > 0, 'La validacion live no devolvio resultados reales.');
    assert.ok(
      completedEvent && Number(completedEvent.metadata.rankedCount ?? 0) > 0,
      'La validacion live no dejo evidencia de ranking real completado.',
    );

    console.log('PASS phase-5 live pipeline validation');
  } finally {
    unsubscribe();
    await app.close();
  }
}

function parseStringArray(value: string | undefined, fallback: string[]) {
  if (!value?.trim()) {
    return [...fallback];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseEnumArray<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T[]) {
  const parsedValues = parseStringArray(value, fallback) as T[];

  for (const parsedValue of parsedValues) {
    assert.ok(allowed.includes(parsedValue), `Valor invalido en variable de entorno: ${parsedValue}`);
  }

  return parsedValues;
}

function parseNullableEnum<T extends string>(value: string | undefined, allowed: readonly T[]) {
  if (!value?.trim()) {
    return null;
  }

  assert.ok(allowed.includes(value as T), `Valor invalido en variable de entorno: ${value}`);
  return value as T;
}

function parseNullableNumber(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value);
  assert.equal(Number.isNaN(parsed), false, `Numero invalido en variable de entorno: ${value}`);
  return parsed;
}

function resolveDiscoveryProvider() {
  return process.env.SEARCH_DISCOVERY_PROVIDER === 'vertex-ai-search'
    ? 'vertex-ai-search'
    : 'google-programmable-search';
}

function getMissingDiscoveryEnv(provider: 'google-programmable-search' | 'vertex-ai-search') {
  if (provider === 'vertex-ai-search') {
    return [
      !process.env.VERTEX_AI_SEARCH_API_KEY?.trim() ? 'VERTEX_AI_SEARCH_API_KEY' : null,
      !process.env.VERTEX_AI_SEARCH_PROJECT_ID?.trim() ? 'VERTEX_AI_SEARCH_PROJECT_ID' : null,
      !process.env.VERTEX_AI_SEARCH_APP_ID?.trim() ? 'VERTEX_AI_SEARCH_APP_ID' : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [
    !process.env.GOOGLE_SEARCH_API_KEY?.trim() ? 'GOOGLE_SEARCH_API_KEY' : null,
    !process.env.GOOGLE_SEARCH_ENGINE_ID?.trim() ? 'GOOGLE_SEARCH_ENGINE_ID' : null,
  ].filter((value): value is string => Boolean(value));
}

run().catch((error: unknown) => {
  console.error('FAIL phase-5 live pipeline validation');
  console.error(error);
  process.exitCode = 1;
});
