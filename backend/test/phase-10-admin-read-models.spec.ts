import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { UserRole } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RequestContextService } from '../src/infrastructure/observability/request-context.service';
import { AiSearchDecisionService } from '../src/modules/ai/application/services/ai-search-decision.service';
import { SearchDecision } from '../src/modules/ai/domain/types/search-decision.type';

type AuthPayload = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  accessToken: string;
};

async function run() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  const prisma = app.get(PrismaService);
  const aiSearchDecisionService = app.get(AiSearchDecisionService);
  const originalDecide = aiSearchDecisionService.decide.bind(aiSearchDecisionService);

  aiSearchDecisionService.decide = async (): Promise<SearchDecision> => ({
    intent: 'NEW_SEARCH',
    shouldSearch: true,
    requiresClarification: false,
    clarificationQuestion: null,
    userFacingMessage: 'Armo una busqueda real controlada para admin.',
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
  });

  configureApp(app, configService, logger, requestContextService);
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const testEmail = `admin-metrics-${Date.now()}@local.test`;
  const forwardedFor = `10.0.11.${Math.floor(Math.random() * 200) + 1}`;

  try {
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(registerResponse.status, 201);
    const registerPayload = (await registerResponse.json()) as AuthPayload;

    await prisma.user.update({
      where: { id: registerPayload.user.id },
      data: { role: UserRole.ADMIN },
    });

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'StrongPassword123',
      }),
    });
    assert.equal(loginResponse.status, 200);
    const loginPayload = (await loginResponse.json()) as AuthPayload;

    const createConversationResponse = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Admin metrics seed',
      }),
    });
    assert.equal(createConversationResponse.status, 201);
    const conversationPayload = (await createConversationResponse.json()) as { id: string };

    const sendMessageResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Quiero comprar un monoambiente en Palermo con balcon',
      }),
    });
    assert.equal(sendMessageResponse.status, 201);
    const sendMessagePayload = (await sendMessageResponse.json()) as {
      results: Array<{ propertyId: string }>;
    };
    assert.ok(sendMessagePayload.results.length > 0);

    const favoriteResponse = await fetch(`${baseUrl}/favorites`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: sendMessagePayload.results[0]?.propertyId,
      }),
    });
    assert.equal(favoriteResponse.status, 201);

    const metricsResponse = await fetch(`${baseUrl}/admin/metrics`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });
    assert.equal(metricsResponse.status, 200);
    const metricsPayload = (await metricsResponse.json()) as {
      overview: { usersCount: number; conversationsCount: number; searchRunsCount: number; propertiesCacheCount: number; favoritesCount: number };
      activityLast7d: { users: number; conversations: number; searchRuns: number; favorites: number };
      searchRunsByStatus: Array<{ status: string; count: number }>;
      propertiesByListingStatus: Array<{ status: string; count: number }>;
      topPropertySources: Array<{ source: string; count: number }>;
    };
    assert.ok(metricsPayload.overview.usersCount >= 1);
    assert.ok(metricsPayload.overview.conversationsCount >= 1);
    assert.ok(metricsPayload.overview.searchRunsCount >= 1);
    assert.ok(metricsPayload.overview.propertiesCacheCount >= 1);
    assert.ok(metricsPayload.overview.favoritesCount >= 1);
    assert.ok(metricsPayload.activityLast7d.users >= 1);
    assert.ok(metricsPayload.searchRunsByStatus.length > 0);
    assert.ok(metricsPayload.propertiesByListingStatus.length > 0);

    const usersResponse = await fetch(`${baseUrl}/admin/users?page=1&limit=5`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });
    assert.equal(usersResponse.status, 200);
    const usersPayload = (await usersResponse.json()) as {
      items: Array<{ id: string; email: string; role: UserRole; conversationsCount: number; favoritesCount: number }>;
      meta: { total: number };
    };
    assert.ok(usersPayload.meta.total >= 1);
    assert.ok(usersPayload.items.some((item) => item.email === testEmail && item.role === UserRole.ADMIN));

    const conversationsResponse = await fetch(`${baseUrl}/admin/conversations?page=1&limit=5`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });
    assert.equal(conversationsResponse.status, 200);
    const conversationsPayload = (await conversationsResponse.json()) as {
      items: Array<{ id: string; title: string; messagesCount: number; searchRunsCount: number }>;
      meta: { total: number };
    };
    assert.ok(conversationsPayload.meta.total >= 1);
    assert.ok(conversationsPayload.items.some((item) => item.id === conversationPayload.id && item.searchRunsCount >= 1));

    const searchRunsResponse = await fetch(`${baseUrl}/admin/search-runs?page=1&limit=5`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });
    assert.equal(searchRunsResponse.status, 200);
    const searchRunsPayload = (await searchRunsResponse.json()) as {
      items: Array<{ id: string; queryText: string; resultCount: number; conversation: { id: string } }>;
      meta: { total: number };
    };
    assert.ok(searchRunsPayload.meta.total >= 1);
    assert.ok(searchRunsPayload.items.some((item) => item.conversation.id === conversationPayload.id && item.resultCount >= 1));

    const propertiesResponse = await fetch(`${baseUrl}/admin/properties?page=1&limit=5`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });
    assert.equal(propertiesResponse.status, 200);
    const propertiesPayload = (await propertiesResponse.json()) as {
      items: Array<{ id: string; source: string; favoritesCount: number; appearancesCount: number }>;
      meta: { total: number };
    };
    assert.ok(propertiesPayload.meta.total >= 1);
    assert.ok(propertiesPayload.items.some((item) => item.favoritesCount >= 1 || item.appearancesCount >= 1));

    console.log('PASS phase-10 admin read models');
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

run().catch((error: unknown) => {
  console.error('FAIL phase-10 admin read models');
  console.error(error);
  process.exitCode = 1;
});
