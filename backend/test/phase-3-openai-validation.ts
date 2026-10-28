import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { OpenAiService } from '../src/infrastructure/openai/openai.service';
import { AiSearchDecisionService } from '../src/modules/ai/application/services/ai-search-decision.service';
import { FALLBACK_SEARCH_DECISION } from '../src/modules/ai/domain/constants/search-decision-fallback';
import { SearchDecision } from '../src/modules/ai/domain/types/search-decision.type';
import { SearchFilters } from '../src/modules/search-state/domain/types/search-filters.type';

type ValidationCase = {
  name: string;
  userMessage: string;
  searchState: SearchFilters;
  assertDecision: (decision: SearchDecision) => void;
};

const EMPTY_SEARCH_STATE: SearchFilters = {
  operation: null,
  propertyTypes: [],
  locations: [],
  priceMin: null,
  priceMax: null,
  currency: null,
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  areaMin: null,
  areaMax: null,
  expensesMax: null,
  features: [],
  sortPreference: null,
};

const ACTIVE_BUY_SEARCH_STATE: SearchFilters = {
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
  sortPreference: 'RELEVANCE',
};

function createDecisionService() {
  const configService = new ConfigService({
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    },
  });

  const logger = new LoggerService();
  const openAiService = new OpenAiService(configService, logger);

  return new AiSearchDecisionService(openAiService, logger);
}

function assertNotFallback(caseName: string, decision: SearchDecision) {
  assert.notDeepEqual(
    decision,
    FALLBACK_SEARCH_DECISION,
    `Case "${caseName}" fell back to the safe SearchDecision instead of returning a real model interpretation.`,
  );
}

function printDecision(caseName: string, decision: SearchDecision) {
  console.log(`CASE ${caseName}`);
  console.log(JSON.stringify(decision, null, 2));
}

async function run() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY is empty in backend/.env. Set a real key before running npm run test:openai.');
    process.exitCode = 1;
    return;
  }

  const service = createDecisionService();

  const cases: ValidationCase[] = [
    {
      name: 'new search in spanish',
      userMessage: 'Quiero comprar un departamento en Palermo con balcon hasta 140000 USD y 2 ambientes',
      searchState: EMPTY_SEARCH_STATE,
      assertDecision: (decision) => {
        assert.equal(decision.requestedAction, 'SEARCH');
        assert.equal(decision.shouldSearch, true);
        assert.equal(decision.requiresClarification, false);
        assert.equal(decision.filterPatch.operation, 'BUY');
        assert.deepEqual(decision.filterPatch.propertyTypes, ['APARTMENT']);
        assert.deepEqual(decision.filterPatch.locations, ['Palermo']);
        assert.equal(decision.filterPatch.priceMax, 140000);
        assert.equal(decision.filterPatch.currency, 'USD');
        assert.equal(decision.filterPatch.rooms, 2);
        assert.deepEqual(decision.filterPatch.features, ['BALCONY']);
      },
    },
    {
      name: 'modify active search in spanish',
      userMessage: 'Manteneme Palermo, sacale balcon y bajame el tope a 130000 dolares',
      searchState: ACTIVE_BUY_SEARCH_STATE,
      assertDecision: (decision) => {
        assert.equal(decision.requestedAction, 'SEARCH');
        assert.equal(decision.shouldSearch, true);
        assert.equal(decision.requiresClarification, false);
        assert.equal(decision.filterPatch.priceMax, 130000);
        assert.ok(
          Array.isArray(decision.filterPatch.features) && decision.filterPatch.features.length === 0,
          'Expected features to be explicitly cleared in filterPatch.features.',
        );
      },
    },
    {
      name: 'clarification needed',
      userMessage: 'Busco algo barato',
      searchState: EMPTY_SEARCH_STATE,
      assertDecision: (decision) => {
        assert.equal(decision.shouldSearch, false);
        assert.equal(decision.requiresClarification, true);
        assert.equal(decision.requestedAction, 'NONE');
        assert.ok(
          typeof decision.clarificationQuestion === 'string' && decision.clarificationQuestion.trim().length > 0,
          'Expected a concrete clarification question.',
        );
      },
    },
    {
      name: 'english search request',
      userMessage: 'I want to rent a house in Belgrano with a patio and pets allowed',
      searchState: EMPTY_SEARCH_STATE,
      assertDecision: (decision) => {
        assert.equal(decision.requestedAction, 'SEARCH');
        assert.equal(decision.shouldSearch, true);
        assert.equal(decision.requiresClarification, false);
        assert.equal(decision.filterPatch.operation, 'RENT');
        assert.deepEqual(decision.filterPatch.propertyTypes, ['HOUSE']);
        assert.deepEqual(decision.filterPatch.locations, ['Belgrano']);
        assert.ok(decision.filterPatch.features?.includes('PATIO'));
        assert.ok(decision.filterPatch.features?.includes('PETS_ALLOWED'));
      },
    },
    {
      name: 'smalltalk should not search',
      userMessage: 'Hola, como va?',
      searchState: ACTIVE_BUY_SEARCH_STATE,
      assertDecision: (decision) => {
        assert.equal(decision.shouldSearch, false);
        assert.equal(decision.requestedAction, 'NONE');
        assert.equal(decision.intent, 'SMALLTALK');
      },
    },
  ];

  for (const validationCase of cases) {
    const decision = await service.decide({
      userMessage: validationCase.userMessage,
      searchState: validationCase.searchState,
    });

    printDecision(validationCase.name, decision);
    assertNotFallback(validationCase.name, decision);
    validationCase.assertDecision(decision);
    console.log(`PASS ${validationCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-3 openai validation');
  console.error(error);
  process.exitCode = 1;
});
