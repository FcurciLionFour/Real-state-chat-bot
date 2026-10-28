import * as assert from 'node:assert/strict';
import { AiSearchDecisionService } from '../src/modules/ai/application/services/ai-search-decision.service';
import { SearchDecision } from '../src/modules/ai/domain/types/search-decision.type';
import { ChatApplicationService } from '../src/modules/conversations/application/services/chat-application.service';
import { ConversationsService } from '../src/modules/conversations/application/services/conversations.service';
import { SearchExecutionService } from '../src/modules/search/application/services/search-execution.service';
import { SearchStateMergeService } from '../src/modules/search-state/application/services/search-state-merge.service';
import { SearchFilters } from '../src/modules/search-state/domain/types/search-filters.type';

async function testChatApplicationServiceMockFlow() {
  const userMessageCalls: string[] = [];
  const assistantMessages: Array<{ conversationId: string; content: string; payload?: unknown }> = [];
  const updatedStates: unknown[] = [];
  const markedSearches: string[] = [];
  const persistedRuns: unknown[] = [];

  const service = new ChatApplicationService(
    {
      decide: async () => ({
        intent: 'NEW_SEARCH',
        shouldSearch: true,
        requiresClarification: false,
        clarificationQuestion: null,
        userFacingMessage: 'Actualizo filtros y ejecuto busqueda simulada.',
        filterPatch: {
          operation: 'BUY',
          propertyTypes: ['APARTMENT'],
          locations: ['Palermo'],
          priceMax: 140000,
          currency: 'USD',
          rooms: 2,
          features: ['BALCONY'],
        },
        filtersToUnset: [],
        requestedAction: 'SEARCH',
      }),
    } as unknown as AiSearchDecisionService,
    {
      assertOwnership: async () => ({ id: 'conv-1' }),
      markSearchExecuted: async (conversationId: string) => {
        markedSearches.push(conversationId);
      },
    } as unknown as ConversationsService,
    {
      createUserMessage: async (_conversationId: string, content: string) => {
        userMessageCalls.push(content);
      },
      createAssistantMessage: async (conversationId: string, content: string, payload?: unknown) => {
        assistantMessages.push({ conversationId, content, payload });
      },
    } as never,
    {
      getOrCreateByConversationId: async () => ({
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
      }),
      updateByConversationId: async (_conversationId: string, filters: unknown) => {
        updatedStates.push(filters);
      },
    } as never,
    {
      applySearchDecision: () => ({
        searchState: {
          operation: 'BUY',
          propertyTypes: ['APARTMENT'],
          locations: ['Palermo'],
          priceMin: null,
          priceMax: 140000,
          currency: 'USD',
          rooms: 2,
          bedrooms: null,
          bathrooms: null,
          areaMin: null,
          areaMax: null,
          expensesMax: null,
          features: ['BALCONY'],
          sortPreference: null,
        },
        assistantMessage: 'Actualizo filtros mock y ejecuto busqueda simulada.',
        requiresClarification: false,
        clarificationQuestion: null,
        didSearch: true,
      }),
    } as never,
    {
      execute: async () => ({
        queryText: 'compra apartment palermo 2 ambientes balcony',
        sourcesUsed: ['mock-source'],
        results: [
          {
            source: 'mock-source',
            sourceUrl: 'https://example.com/property-1',
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
      }),
    } as unknown as SearchExecutionService,
    {
      persistSearchResult: async () => ({ id: 'property-cache-1' }),
      persistMockResult: async () => ({ id: 'property-cache-1' }),
    } as never,
    {
      persistSearchRun: async (payload: unknown) => {
        persistedRuns.push(payload);
        return { id: 'search-run-1' };
      },
      persistMockSearchRun: async (payload: unknown) => {
        persistedRuns.push(payload);
        return { id: 'search-run-1' };
      },
    } as never,
  );

  const response = await service.sendMessage(
    'user-1',
    'conv-1',
    'Busco comprar un departamento en Palermo con balcon hasta 140k USD y 2 ambientes',
  );

  assert.deepEqual(userMessageCalls, ['Busco comprar un departamento en Palermo con balcon hasta 140k USD y 2 ambientes']);
  assert.equal(updatedStates.length, 1);
  assert.equal(markedSearches.length, 1);
  assert.equal(markedSearches[0], 'conv-1');
  assert.equal(persistedRuns.length, 1);
  assert.equal(response.conversationId, 'conv-1');
  assert.deepEqual(Object.keys(response).sort(), [
    'assistantMessage',
    'clarificationQuestion',
    'conversationId',
    'didSearch',
    'meta',
    'requiresClarification',
    'results',
    'searchState',
  ]);
  assert.equal(response.didSearch, true);
  assert.equal(response.meta.searchRunId, 'search-run-1');
  assert.equal(response.meta.resultCount, 1);
  assert.deepEqual(response.meta.sourcesUsed, ['mock-source']);
  assert.equal(response.results[0].propertyId, 'property-cache-1');
  assert.deepEqual(Object.keys(response.results[0]).sort(), [
    'areaCovered',
    'areaTotal',
    'bathrooms',
    'bedrooms',
    'city',
    'contactPhone',
    'contactWhatsApp',
    'currency',
    'expenses',
    'features',
    'images',
    'locationText',
    'neighborhood',
    'operation',
    'price',
    'propertyId',
    'propertyType',
    'publishedAt',
    'publisher',
    'rank',
    'rooms',
    'scrapedAt',
    'source',
    'sourceUrl',
    'title',
  ]);
  assert.equal(assistantMessages.length, 1);
  assert.equal((assistantMessages[0].payload as { mode: string }).mode, 'ai');
}

async function testConversationsServiceContractFormatting() {
  const service = new ConversationsService(
    {
      create: async () => ({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Busqueda en Palermo',
        status: 'ACTIVE',
        lastSearchAt: null,
        createdAt: new Date('2026-04-08T00:00:00.000Z'),
        updatedAt: new Date('2026-04-08T00:00:00.000Z'),
      }),
      findManyByUserId: async () => [
        {
          id: 'conv-1',
          userId: 'user-1',
          title: 'Busqueda en Palermo',
          status: 'ACTIVE',
          lastSearchAt: new Date('2026-04-08T01:00:00.000Z'),
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
          updatedAt: new Date('2026-04-08T01:00:00.000Z'),
        },
      ],
      countByUserId: async () => 1,
      findById: async () => ({ id: 'conv-1', userId: 'user-1' }),
      findDetailById: async () => ({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Busqueda en Palermo',
        status: 'ACTIVE',
        lastSearchAt: new Date('2026-04-08T01:00:00.000Z'),
        createdAt: new Date('2026-04-08T00:00:00.000Z'),
        updatedAt: new Date('2026-04-08T01:00:00.000Z'),
        searchState: {
          filtersJson: {
            operation: 'BUY',
            propertyTypes: ['APARTMENT'],
            locations: ['Palermo'],
          },
        },
        messages: [
          {
            id: 'msg-1',
            role: 'USER',
            content: 'Busco en Palermo',
            structuredPayloadJson: null,
            createdAt: new Date('2026-04-08T00:30:00.000Z'),
          },
        ],
        searchRuns: [
          {
            id: 'run-1',
            status: 'COMPLETED',
            resultCount: 2,
            createdAt: new Date('2026-04-08T00:31:00.000Z'),
          },
        ],
      }),
      touch: async () => undefined,
      markSearchExecuted: async () => undefined,
    } as never,
    {
      getOrCreateByConversationId: async () => ({
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
      }),
    } as never,
    {
      getLatestResultsByConversationId: async () => ({
        searchRun: {
          id: 'run-1',
          status: 'COMPLETED',
          resultCount: 2,
          createdAt: new Date('2026-04-08T00:31:00.000Z'),
        },
        results: [
          {
            propertyId: 'property-1',
            source: 'zonaprop',
            sourceUrl: 'https://example.com/property-1',
            title: 'Departamento en Palermo',
            operation: 'BUY',
            propertyType: 'APARTMENT',
            price: 135000,
            currency: 'USD',
            expenses: 120000,
            city: 'CABA',
            neighborhood: 'Palermo',
            locationText: 'Palermo, Capital Federal',
            rooms: 2,
            bedrooms: 1,
            bathrooms: 1,
            areaTotal: 48,
            areaCovered: 44,
            features: ['BALCONY'],
            images: ['https://example.com/image.jpg'],
            scrapedAt: new Date('2026-04-08T00:31:02.000Z'),
            publishedAt: new Date('2026-04-07T00:00:00.000Z'),
            rank: {
              position: 1,
              score: 0.94,
              reasons: ['Coincide con tu zona'],
            },
          },
        ],
      }),
    } as never,
    {
      logEvent: () => undefined,
      warnEvent: () => undefined,
    } as never,
  );

  const created = await service.create('user-1', 'Busqueda en Palermo');
  const listed = await service.listByUserId('user-1', 1, 20);
  const detail = await service.getDetail('user-1', 'conv-1');

  assert.deepEqual(Object.keys(created).sort(), ['createdAt', 'id', 'searchState', 'status', 'title', 'updatedAt']);
  assert.deepEqual(Object.keys(listed.meta).sort(), ['limit', 'page', 'total']);
  assert.equal(listed.items[0].title, 'Busqueda en Palermo');
  assert.equal('userId' in listed.items[0], false);
  assert.equal('lastSearchAt' in listed.items[0], true);
  assert.equal(detail.messages.length, 1);
  assert.equal('structuredPayloadJson' in detail.messages[0], false);
  assert.equal('lastSearchAt' in detail, false);
  assert.deepEqual(detail.lastSearchRun, {
    id: 'run-1',
    status: 'COMPLETED',
    resultCount: 2,
    createdAt: new Date('2026-04-08T00:31:00.000Z'),
  });
  assert.equal(detail.lastSearchResults.length, 1);
  assert.equal(detail.lastSearchResults[0].propertyId, 'property-1');
  assert.equal('searchRuns' in detail, false);
}

async function testAiSearchDecisionServiceFallbacksWithoutApiKey() {
  const service = new AiSearchDecisionService(
    {
      createStructuredJsonResponse: async () => {
        throw new Error('OPENAI_API_KEY is not configured');
      },
    } as never,
    {
      warn: () => undefined,
    } as never,
  );

  const decision = await service.decide({
    userMessage: 'Busco algo lindo',
    searchState: {
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
    },
  });

  assert.equal(decision.intent, 'CLARIFY');
  assert.equal(decision.shouldSearch, false);
  assert.equal(decision.requiresClarification, true);
  assert.equal(decision.requestedAction, 'NONE');

  const deterministicDecision = await service.decide({
    userMessage: 'alquileres en Palermo menos de 1 millón',
    searchState: {} as SearchFilters,
  });

  assert.equal(deterministicDecision.shouldSearch, true);
  assert.equal(deterministicDecision.requiresClarification, false);
  assert.equal(deterministicDecision.requestedAction, 'SEARCH');
  assert.equal(deterministicDecision.filterPatch.operation, 'RENT');
  assert.deepEqual(deterministicDecision.filterPatch.locations, ['Palermo']);
  assert.equal(deterministicDecision.filterPatch.priceMax, 1000000);
}

async function testAiSearchDecisionServiceDeterministicOverrides() {
  const createService = (rawDecision: unknown) =>
    new AiSearchDecisionService(
      {
        createStructuredJsonResponse: async () => JSON.stringify(rawDecision),
      } as never,
      {
        warn: () => undefined,
      } as never,
    );
  const baseState = {
    operation: 'RENT' as const,
    propertyTypes: [],
    locations: ['Recoleta'],
    geoConstraints: [],
    priceMin: null,
    priceMax: 1000000,
    currency: 'ARS' as const,
    rooms: null,
    roomsAnyOf: [],
    bedrooms: null,
    bathrooms: null,
    areaMin: null,
    areaMax: null,
    expensesMax: null,
    features: [],
    sortPreference: null,
  };
  const noSearchDecision: SearchDecision = {
    intent: 'MODIFY_SEARCH',
    shouldSearch: false,
    requiresClarification: false,
    clarificationQuestion: null,
    userFacingMessage: 'Fallback.',
    filterPatch: {},
    filtersToUnset: [],
    requestedAction: 'NONE',
  };
  const emptySearchStateService = createService(noSearchDecision) as unknown as {
    applyDeterministicOverrides: (
      userMessage: string,
      currentState: SearchFilters,
      decision: SearchDecision,
    ) => SearchDecision;
  };
  const emptySearchStateDecision = emptySearchStateService.applyDeterministicOverrides(
    'alquileres en Palermo menos de 1 millón',
    {} as SearchFilters,
    {
      ...noSearchDecision,
      shouldSearch: false,
      requiresClarification: true,
    },
  );

  assert.equal(emptySearchStateDecision.shouldSearch, true);
  assert.equal(emptySearchStateDecision.requiresClarification, false);
  assert.equal(emptySearchStateDecision.requestedAction, 'SEARCH');
  assert.equal(emptySearchStateDecision.filterPatch.operation, 'RENT');
  assert.deepEqual(emptySearchStateDecision.filterPatch.locations, ['Palermo']);
  assert.equal(emptySearchStateDecision.filterPatch.priceMax, 1000000);

  const locationDecision = await createService(noSearchDecision).decide({
    userMessage: 'mejor en Belgrano',
    searchState: baseState,
  });

  assert.deepEqual(locationDecision.filterPatch.locations, ['Belgrano']);
  assert.equal(locationDecision.shouldSearch, true);
  assert.equal(locationDecision.requestedAction, 'SEARCH');

  const affirmativeDecision = await createService(noSearchDecision).decide({
    userMessage: 'dale',
    searchState: baseState,
  });

  assert.equal(affirmativeDecision.shouldSearch, true);
  assert.equal(affirmativeDecision.requestedAction, 'SEARCH');
  assert.equal(affirmativeDecision.filterPatch.locations, undefined);

  const belgranoState = {
    ...baseState,
    locations: ['Belgrano'],
  };
  const followUpDecision = await createService(noSearchDecision).decide({
    userMessage: 'nop. podes ya buscar los alquileres',
    searchState: belgranoState,
  });
  const mergedFollowUp = new SearchStateMergeService().applySearchDecision(belgranoState, followUpDecision);

  assert.equal(followUpDecision.shouldSearch, true);
  assert.equal(followUpDecision.requestedAction, 'SEARCH');
  assert.deepEqual(mergedFollowUp.searchState.locations, ['Belgrano']);

  const emptyState = {
    ...baseState,
    operation: null,
    locations: [],
    priceMax: null,
    currency: null,
  };
  const villaUrquizaDecision = await createService(noSearchDecision).decide({
    userMessage: 'alquileres en Villa Urquiza menos de 1 millon',
    searchState: emptyState,
  });

  assert.equal(villaUrquizaDecision.filterPatch.operation, 'RENT');
  assert.deepEqual(villaUrquizaDecision.filterPatch.locations, ['Villa Urquiza']);
  assert.equal(villaUrquizaDecision.filterPatch.priceMax, 1000000);
  assert.equal(villaUrquizaDecision.shouldSearch, true);
  assert.equal(villaUrquizaDecision.requestedAction, 'SEARCH');

  const belgranoBudgetDecision = await createService(noSearchDecision).decide({
    userMessage: 'mejor en Belgrano hasta 800k',
    searchState: baseState,
  });

  assert.deepEqual(belgranoBudgetDecision.filterPatch.locations, ['Belgrano']);
  assert.equal(belgranoBudgetDecision.filterPatch.priceMax, 800000);
  assert.equal(belgranoBudgetDecision.shouldSearch, true);

  const palermoState = {
    ...baseState,
    locations: ['Palermo'],
    priceMax: 1000000,
  };
  const roomsDecision = await createService(noSearchDecision).decide({
    userMessage: 'buscame 2 ambientes',
    searchState: palermoState,
  });

  assert.equal(roomsDecision.filterPatch.rooms, 2);
  assert.equal(roomsDecision.shouldSearch, true);
  assert.equal(roomsDecision.requestedAction, 'SEARCH');

  const noBudgetDecision = await createService(noSearchDecision).decide({
    userMessage: 'alquileres en Recoleta sin tope',
    searchState: {
      ...baseState,
      priceMin: 500000,
      priceMax: 1000000,
      currency: 'ARS',
    },
  });
  const mergedNoBudget = new SearchStateMergeService().applySearchDecision(
    {
      ...baseState,
      priceMin: 500000,
      priceMax: 1000000,
      currency: 'ARS',
    },
    noBudgetDecision,
  );

  assert.equal(noBudgetDecision.shouldSearch, true);
  assert.equal(noBudgetDecision.requestedAction, 'SEARCH');
  assert.deepEqual(noBudgetDecision.filterPatch.locations, undefined);
  assert.equal(mergedNoBudget.searchState.priceMin, null);
  assert.equal(mergedNoBudget.searchState.priceMax, null);
  assert.equal(mergedNoBudget.searchState.currency, null);
  assert.deepEqual(mergedNoBudget.searchState.locations, ['Recoleta']);

  const focusedResetState = {
    ...baseState,
    locations: ['Villa Urquiza'],
    priceMin: 500000,
    priceMax: 1000000,
    currency: 'ARS' as const,
    rooms: 2,
    features: ['GARAGE' as const],
    sortPreference: 'PRICE_ASC' as const,
  };
  const focusedResetDecision = await createService(noSearchDecision).decide({
    userMessage: 'a ver solo buscame alquileres en recoleta sin tope',
    searchState: focusedResetState,
  });
  const mergedFocusedReset = new SearchStateMergeService().applySearchDecision(
    focusedResetState,
    focusedResetDecision,
  );

  assert.equal(focusedResetDecision.shouldSearch, true);
  assert.equal(focusedResetDecision.requestedAction, 'SEARCH');
  assert.equal(mergedFocusedReset.searchState.operation, 'RENT');
  assert.deepEqual(mergedFocusedReset.searchState.locations, ['Recoleta']);
  assert.equal(mergedFocusedReset.searchState.priceMin, null);
  assert.equal(mergedFocusedReset.searchState.priceMax, null);
  assert.equal(mergedFocusedReset.searchState.currency, null);
  assert.equal(mergedFocusedReset.searchState.rooms, null);
  assert.deepEqual(mergedFocusedReset.searchState.features, []);
  assert.equal(mergedFocusedReset.searchState.sortPreference, null);
}

async function testSearchStateMergeServiceAppliesDecisionDeterministically() {
  const service = new SearchStateMergeService();

  const result = service.applySearchDecision(
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
      expensesMax: 120000,
      features: ['BALCONY'],
      sortPreference: 'RELEVANCE',
    },
    {
      intent: 'MODIFY_SEARCH',
      shouldSearch: true,
      requiresClarification: false,
      clarificationQuestion: null,
      userFacingMessage: 'Mantengo Palermo, saco balcon y actualizo tope.',
      filterPatch: {
        priceMax: 130000,
        features: [],
      },
      filtersToUnset: ['expensesMax'],
      requestedAction: 'SEARCH',
    },
  );

  assert.equal(result.didSearch, true);
  assert.equal(result.searchState.priceMax, 130000);
  assert.deepEqual(result.searchState.features, []);
  assert.equal(result.searchState.expensesMax, null);
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'chat application persists mock flow',
      execute: testChatApplicationServiceMockFlow,
    },
    {
      name: 'conversations service formats HTTP contract',
      execute: testConversationsServiceContractFormatting,
    },
    {
      name: 'ai search decision service falls back safely without api key',
      execute: testAiSearchDecisionServiceFallbacksWithoutApiKey,
    },
    {
      name: 'ai search decision service applies deterministic overrides',
      execute: testAiSearchDecisionServiceDeterministicOverrides,
    },
    {
      name: 'search state merge service applies decision deterministically',
      execute: testSearchStateMergeServiceAppliesDecisionDeterministically,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-2 mock flow tests');
  console.error(error);
  process.exitCode = 1;
});
