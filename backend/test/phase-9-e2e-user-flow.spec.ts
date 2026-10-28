import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RequestContextService } from '../src/infrastructure/observability/request-context.service';
import { AiSearchDecisionService } from '../src/modules/ai/application/services/ai-search-decision.service';
import { SearchDecision } from '../src/modules/ai/domain/types/search-decision.type';
import { SearchFilters } from '../src/modules/search-state/domain/types/search-filters.type';

type AuthPayload = {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
};

type RefreshPayload = {
  accessToken: string;
};

type ConversationPayload = {
  id: string;
  title: string;
  status: string;
  searchState: SearchFilters;
  createdAt: string;
  updatedAt: string;
};

type SendMessagePayload = {
  conversationId: string;
  assistantMessage: string;
  didSearch: boolean;
  searchState: SearchFilters;
  results: Array<{
    propertyId: string;
    source: string;
    title: string;
  }>;
  meta: {
    searchRunId: string | null;
    resultCount: number;
    sourcesUsed: string[];
  };
};

type FavoritePayload = {
  favoriteId: string;
  propertyId: string;
  createdAt: string;
};

type ConversationsListPayload = {
  items: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

type ConversationDetailPayload = {
  id: string;
  title: string;
  searchState: SearchFilters;
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
  }>;
  lastSearchResults: Array<{
    propertyId: string;
  }>;
};

async function run() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  const prisma = app.get(PrismaService);
  const aiSearchDecisionService = app.get(AiSearchDecisionService);
  const originalDecide = aiSearchDecisionService.decide.bind(aiSearchDecisionService);

  aiSearchDecisionService.decide = async ({
    userMessage,
    searchState,
  }: {
    userMessage: string;
    searchState: SearchFilters;
  }): Promise<SearchDecision> => {
    if (userMessage.toLowerCase().includes('120000')) {
      return {
        intent: 'MODIFY_SEARCH',
        shouldSearch: true,
        requiresClarification: false,
        clarificationQuestion: null,
        userFacingMessage: 'Mantengo Palermo y ajusto el tope a USD 120k.',
        filterPatch: {
          priceMax: 120000,
        },
        filtersToUnset: [],
        requestedAction: 'SEARCH',
      };
    }

    return {
      intent: searchState.locations.length > 0 ? 'MODIFY_SEARCH' : 'NEW_SEARCH',
      shouldSearch: true,
      requiresClarification: false,
      clarificationQuestion: null,
      userFacingMessage: 'Armo la búsqueda inicial en Palermo y busco opciones.',
      filterPatch: {
        operation: 'BUY',
        propertyTypes: ['APARTMENT'],
        locations: ['Palermo'],
        currency: 'USD',
        priceMax: 140000,
        rooms: 1,
        features: ['BALCONY'],
      },
      filtersToUnset: [],
      requestedAction: 'SEARCH',
    };
  };

  configureApp(app, configService, logger, requestContextService);
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const testEmail = `e2e-${Date.now()}@local.test`;
  let refreshCookie = '';

  try {
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(registerResponse.status, 201);
    const registerPayload = (await registerResponse.json()) as AuthPayload;
    refreshCookie = extractCookie(registerResponse, 'refreshToken');
    assert.equal(registerPayload.user.email, testEmail);
    assert.ok(registerPayload.accessToken.length > 10);
    assert.ok(refreshCookie.startsWith('refreshToken='));

    const meResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${registerPayload.accessToken}`,
      },
    });
    assert.equal(meResponse.status, 200);
    const mePayload = (await meResponse.json()) as AuthPayload['user'];
    assert.equal(mePayload.email, testEmail);

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(loginResponse.status, 200);
    const loginPayload = (await loginResponse.json()) as AuthPayload;
    refreshCookie = extractCookie(loginResponse, 'refreshToken');
    assert.equal(loginPayload.user.id, registerPayload.user.id);
    assert.ok(refreshCookie.startsWith('refreshToken='));

    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: refreshCookie,
      },
    });
    assert.equal(refreshResponse.status, 200);
    const refreshPayload = (await refreshResponse.json()) as RefreshPayload;
    assert.ok(refreshPayload.accessToken.length > 10);

    const createConversationResponse = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'E2E principal',
      }),
    });
    assert.equal(createConversationResponse.status, 201);
    const conversationPayload = (await createConversationResponse.json()) as ConversationPayload;
    assert.equal(conversationPayload.title, 'E2E principal');

    const firstMessageResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Quiero comprar un monoambiente en Palermo con balcon hasta 140000 USD',
      }),
    });
    assert.equal(firstMessageResponse.status, 201);
    const firstMessagePayload = (await firstMessageResponse.json()) as SendMessagePayload;
    assert.equal(firstMessagePayload.didSearch, true);
    assert.ok(firstMessagePayload.meta.searchRunId);
    assert.ok(firstMessagePayload.results.length > 0);
    assert.equal(firstMessagePayload.searchState.locations[0], 'Palermo');
    assert.equal(firstMessagePayload.searchState.priceMax, 140000);

    const favoritePropertyId = firstMessagePayload.results[0]?.propertyId;
    assert.ok(favoritePropertyId, 'Expected a property id to favorite');

    const addFavoriteResponse = await fetch(`${baseUrl}/favorites`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: favoritePropertyId,
      }),
    });
    assert.equal(addFavoriteResponse.status, 201);
    const addFavoritePayload = (await addFavoriteResponse.json()) as FavoritePayload;
    assert.equal(addFavoritePayload.propertyId, favoritePropertyId);

    const listFavoritesResponse = await fetch(`${baseUrl}/favorites`, {
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
      },
    });
    assert.equal(listFavoritesResponse.status, 200);
    const listFavoritesPayload = (await listFavoritesResponse.json()) as {
      items: Array<{
        favoriteId: string;
        property: {
          propertyId: string;
        };
      }>;
      meta: {
        total: number;
      };
    };
    assert.ok(listFavoritesPayload.meta.total >= 1);
    assert.ok(listFavoritesPayload.items.some((item) => item.property.propertyId === favoritePropertyId));

    const secondMessageResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Manteneme Palermo pero bajá el tope a 120000 USD',
      }),
    });
    assert.equal(secondMessageResponse.status, 201);
    const secondMessagePayload = (await secondMessageResponse.json()) as SendMessagePayload;
    assert.equal(secondMessagePayload.didSearch, true);
    assert.equal(secondMessagePayload.searchState.priceMax, 120000);
    assert.ok(secondMessagePayload.meta.searchRunId);

    const listConversationsResponse = await fetch(`${baseUrl}/conversations`, {
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
      },
    });
    assert.equal(listConversationsResponse.status, 200);
    const listConversationsPayload = (await listConversationsResponse.json()) as ConversationsListPayload;
    assert.ok(listConversationsPayload.items.length >= 1);
    assert.equal(listConversationsPayload.items[0].id, conversationPayload.id);

    const conversationDetailResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}`, {
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
      },
    });
    assert.equal(conversationDetailResponse.status, 200);
    const conversationDetailPayload = (await conversationDetailResponse.json()) as ConversationDetailPayload;
    assert.equal(conversationDetailPayload.id, conversationPayload.id);
    assert.equal(conversationDetailPayload.searchState.priceMax, 120000);
    assert.equal(conversationDetailPayload.messages.length, 4);
    assert.ok(conversationDetailPayload.lastSearchResults.length > 0);

    const deleteFavoriteResponse = await fetch(`${baseUrl}/favorites/${favoritePropertyId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${refreshPayload.accessToken}`,
      },
    });
    assert.equal(deleteFavoriteResponse.status, 200);
    const deleteFavoritePayload = (await deleteFavoriteResponse.json()) as { success: boolean };
    assert.equal(deleteFavoritePayload.success, true);

    const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: refreshCookie,
      },
    });
    assert.equal(logoutResponse.status, 200);
    const logoutPayload = (await logoutResponse.json()) as { success: boolean };
    assert.equal(logoutPayload.success, true);

    const refreshAfterLogoutResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: refreshCookie,
      },
    });
    assert.equal(refreshAfterLogoutResponse.status, 401);

    console.log('PASS phase-9 e2e user flow');
  } finally {
    aiSearchDecisionService.decide = originalDecide;
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
    await app.close();
  }
}

function extractCookie(response: Response, cookieName: string) {
  const headersWithCookies = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headersWithCookies.getSetCookie?.() ?? [];

  for (const cookie of setCookies) {
    if (cookie.startsWith(`${cookieName}=`)) {
      return cookie.split(';')[0]!;
    }
  }

  const singleCookie = response.headers.get('set-cookie');

  if (singleCookie?.startsWith(`${cookieName}=`)) {
    return singleCookie.split(';')[0]!;
  }

  throw new Error(`Missing ${cookieName} cookie in response`);
}

run().catch((error: unknown) => {
  console.error('FAIL phase-9 e2e user flow');
  console.error(error);
  process.exitCode = 1;
});
