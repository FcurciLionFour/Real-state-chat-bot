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

type CapturedLogEvent = {
  level: 'log' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
};

async function run() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  const prisma = app.get(PrismaService);
  const aiSearchDecisionService = app.get(AiSearchDecisionService);
  const capturedLogs: CapturedLogEvent[] = [];
  const unsubscribe = logger.subscribe((event) => {
    capturedLogs.push(event);
  });

  const originalDecide = aiSearchDecisionService.decide.bind(aiSearchDecisionService);

  aiSearchDecisionService.decide = async (): Promise<SearchDecision> => ({
    intent: 'NEW_SEARCH',
    shouldSearch: true,
    requiresClarification: false,
    clarificationQuestion: null,
    userFacingMessage: 'Mantengo la busqueda y corro una nueva consulta.',
    filterPatch: {
      operation: 'BUY',
      propertyTypes: ['APARTMENT'],
      locations: ['Palermo'],
      currency: 'USD',
      priceMax: 140000,
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
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
  const testEmail = `correlation-${Date.now()}@local.test`;

  try {
    const registerRequestId = `req-register-${Date.now()}`;
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': registerRequestId,
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'StrongPassword123',
      }),
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.headers.get('x-request-id'), registerRequestId);
    const registerPayload = (await registerResponse.json()) as {
      user: {
        id: string;
        email: string;
      };
      accessToken: string;
    };
    assert.equal(registerPayload.user.email, testEmail);

    const createConversationRequestId = `req-conversation-${Date.now()}`;
    const createConversationResponse = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${registerPayload.accessToken}`,
        'x-request-id': createConversationRequestId,
      },
      body: JSON.stringify({
        title: 'Busqueda correlacionada',
      }),
    });

    assert.equal(createConversationResponse.status, 201);
    assert.equal(createConversationResponse.headers.get('x-request-id'), createConversationRequestId);
    const conversationPayload = (await createConversationResponse.json()) as {
      id: string;
      title: string;
    };
    assert.equal(conversationPayload.title, 'Busqueda correlacionada');

    const sendMessageRequestId = `req-message-${Date.now()}`;
    const sendMessageResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${registerPayload.accessToken}`,
        'x-request-id': sendMessageRequestId,
      },
      body: JSON.stringify({
        message: 'Buscame departamentos en Palermo con balcon hasta 140000 USD',
      }),
    });

    assert.equal(sendMessageResponse.status, 201);
    assert.equal(sendMessageResponse.headers.get('x-request-id'), sendMessageRequestId);
    const messagePayload = (await sendMessageResponse.json()) as {
      conversationId: string;
      didSearch: boolean;
      meta: {
        searchRunId: string | null;
        resultCount: number;
      };
    };

    assert.equal(messagePayload.conversationId, conversationPayload.id);
    assert.equal(messagePayload.didSearch, true);
    assert.ok(messagePayload.meta.searchRunId);
    assert.ok(messagePayload.meta.resultCount > 0);

    const correlatedRequestLogs = capturedLogs.filter((event) => event.metadata.requestId === sendMessageRequestId);
    const correlatedBusinessLogs = correlatedRequestLogs.filter(
      (event) =>
        event.metadata.conversationId === conversationPayload.id &&
        event.metadata.userId === registerPayload.user.id,
    );

    assert.ok(
      correlatedRequestLogs.some((event) => event.metadata.action === 'http_request_started'),
      'Expected request-scoped http_request_started log.',
    );
    assert.ok(
      correlatedBusinessLogs.some((event) => event.metadata.action === 'search_execution_started'),
      'Expected correlated search_execution_started log.',
    );
    assert.ok(
      correlatedBusinessLogs.some((event) =>
        [
          'search_execution_fallback',
          'search_execution_python_scraper_completed',
          'search_execution_cache_hit',
        ].includes(String(event.metadata.action)),
      ),
      'Expected correlated search execution completion log.',
    );
    assert.ok(
      correlatedBusinessLogs.some(
        (event) =>
          event.metadata.action === 'search_run_persisted' &&
          event.metadata.searchRunId === messagePayload.meta.searchRunId,
      ),
      'Expected correlated search_run_persisted log with searchRunId.',
    );
    assert.ok(
      correlatedBusinessLogs.some(
        (event) =>
          event.metadata.action === 'http_request_completed' &&
          event.metadata.httpStatusCode === 201,
      ),
      'Expected correlated http_request_completed log.',
    );

    console.log('PASS phase-8 http correlation validation');
  } finally {
    aiSearchDecisionService.decide = originalDecide;
    unsubscribe();
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-8 http correlation validation');
  console.error(error);
  process.exitCode = 1;
});
