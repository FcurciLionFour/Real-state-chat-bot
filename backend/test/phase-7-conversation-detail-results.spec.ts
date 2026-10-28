import * as assert from 'node:assert/strict';
import { ConversationsService } from '../src/modules/conversations/application/services/conversations.service';

async function testConversationDetailIncludesLatestSearchResults() {
  const service = new ConversationsService(
    {
      findById: async (id: string) =>
        id === 'conversation-1'
          ? {
              id,
              userId: 'user-1',
              title: 'Busqueda en Palermo',
              status: 'ACTIVE',
              createdAt: new Date('2026-04-08T10:00:00.000Z'),
              updatedAt: new Date('2026-04-08T10:05:00.000Z'),
            }
          : null,
      findDetailById: async (id: string) =>
        id === 'conversation-1'
          ? {
              id,
              title: 'Busqueda en Palermo',
              status: 'ACTIVE',
              createdAt: new Date('2026-04-08T10:00:00.000Z'),
              updatedAt: new Date('2026-04-08T10:05:00.000Z'),
              searchState: {
                filtersJson: {
                  operation: 'BUY',
                  propertyTypes: ['APARTMENT'],
                  locations: ['Palermo'],
                },
              },
              messages: [
                {
                  id: 'message-1',
                  role: 'USER',
                  content: 'Busco un depto en Palermo',
                  createdAt: new Date('2026-04-08T10:01:00.000Z'),
                },
                {
                  id: 'message-2',
                  role: 'ASSISTANT',
                  content: 'Mantengo Palermo y te muestro opciones.',
                  createdAt: new Date('2026-04-08T10:01:02.000Z'),
                },
              ],
              searchRuns: [],
            }
          : null,
      create: async () => {
        throw new Error('not implemented');
      },
      findManyByUserId: async () => {
        throw new Error('not implemented');
      },
      countByUserId: async () => {
        throw new Error('not implemented');
      },
      touch: async () => {
        throw new Error('not implemented');
      },
      markSearchExecuted: async () => {
        throw new Error('not implemented');
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
    } as never,
    {
      getLatestResultsByConversationId: async (conversationId: string) =>
        conversationId === 'conversation-1'
          ? {
              searchRun: {
                id: 'search-run-1',
                status: 'COMPLETED',
                resultCount: 1,
                createdAt: new Date('2026-04-08T10:01:03.000Z'),
              },
              results: [
                {
                  propertyId: 'property-1',
                  source: 'zonaprop',
                  sourceUrl: 'https://www.zonaprop.com.ar/departamento-1.html',
                  publisher: 'Broker de prueba',
                  contactPhone: null,
                  contactWhatsApp: 'https://wa.me/5491111111111',
                  title: 'Departamento 2 ambientes en Palermo',
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
                  images: ['https://img.example.com/property-1.jpg'],
                  scrapedAt: new Date('2026-04-08T10:01:04.000Z'),
                  publishedAt: new Date('2026-04-05T12:00:00.000Z'),
                  rank: {
                    position: 1,
                    score: 0.94,
                    reasons: ['Coincide con tu zona', 'Tiene balcon'],
                  },
                },
              ],
            }
          : null,
    } as never,
    {
      logEvent: () => undefined,
      warnEvent: () => undefined,
    } as never,
  );

  const detail = await service.getDetail('user-1', 'conversation-1');

  assert.equal(detail.id, 'conversation-1');
  assert.equal(detail.messages.length, 2);
  assert.equal(detail.lastSearchRun?.id, 'search-run-1');
  assert.equal(detail.lastSearchResults.length, 1);
  assert.equal(detail.lastSearchResults[0].propertyId, 'property-1');
  assert.equal(detail.lastSearchResults[0].publisher, 'Broker de prueba');
  assert.equal(detail.lastSearchResults[0].contactWhatsApp, 'https://wa.me/5491111111111');
  assert.equal(detail.lastSearchResults[0].rank.position, 1);
  assert.deepEqual(detail.lastSearchResults[0].rank.reasons, ['Coincide con tu zona', 'Tiene balcon']);
}

async function run() {
  await testConversationDetailIncludesLatestSearchResults();
  console.log('PASS conversation detail includes latest search results');
}

run().catch((error: unknown) => {
  console.error('FAIL phase-7 conversation detail results tests');
  console.error(error);
  process.exitCode = 1;
});
