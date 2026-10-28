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
  const originalDecide = aiSearchDecisionService.decide.bind(aiSearchDecisionService);
  const capturedLogs: CapturedLogEvent[] = [];
  const unsubscribe = logger.subscribe((event) => {
    capturedLogs.push(event);
  });

  aiSearchDecisionService.decide = async (): Promise<SearchDecision> => ({
    intent: 'NEW_SEARCH',
    shouldSearch: true,
    requiresClarification: false,
    clarificationQuestion: null,
    userFacingMessage: 'Armo la busqueda inicial de forma segura.',
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
  const testEmail = `mixed.case.${Date.now()}@example.com`;
  const forwardedFor = `10.0.9.${Math.floor(Math.random() * 200) + 1}`;

  try {
    const weakPasswordResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: 'weak@example.com',
        password: 'onlyletters',
      }),
    });

    assert.equal(weakPasswordResponse.status, 400);
    const weakPasswordPayload = (await weakPasswordResponse.json()) as { message: string[] };
    assert.ok(
      weakPasswordPayload.message.some((message) => message.includes('password must include at least one letter and one number')),
    );

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: `  ${testEmail.toUpperCase()}  `,
        password: 'StrongPassword123',
      }),
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(registerResponse.headers.get('x-frame-options'), 'DENY');
    assert.equal(registerResponse.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(registerResponse.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(registerResponse.headers.get('cross-origin-resource-policy'), 'same-site');
    assert.equal(registerResponse.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
    assert.equal(registerResponse.headers.get('origin-agent-cluster'), '?1');
    assert.equal(registerResponse.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(registerResponse.headers.get('pragma'), 'no-cache');
    assert.equal(registerResponse.headers.get('expires'), '0');
    assert.equal(registerResponse.headers.get('x-powered-by'), null);
    const refreshCookieHeader = registerResponse.headers.get('set-cookie');
    assert.ok(refreshCookieHeader);
    assert.ok(refreshCookieHeader.includes('HttpOnly'));
    assert.ok(refreshCookieHeader.includes('Path=/api/auth'));
    assert.ok(refreshCookieHeader.includes(`SameSite=${resolveExpectedSameSite()}`));

    if (resolveExpectedCookieSecure()) {
      assert.ok(refreshCookieHeader.includes('Secure'));
    }

    const registerPayload = (await registerResponse.json()) as {
      user: {
        id: string;
        email: string;
      };
      accessToken: string;
    };
    assert.ok(registerPayload.user.email.endsWith('@example.com'));
    assert.equal(registerPayload.user.email, registerPayload.user.email.trim().toLowerCase());
    const storedRefreshToken = await prisma.refreshToken.findFirst({
      where: { userId: registerPayload.user.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(storedRefreshToken);

    if (process.env.TRUST_PROXY === 'true') {
      assert.equal(storedRefreshToken?.ipAddress, forwardedFor);
    } else {
      assert.notEqual(storedRefreshToken?.ipAddress, forwardedFor);
    }

    const invalidRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: registerPayload.user.email,
        password: 'StrongPassword123',
        unexpected: true,
      }),
    });

    assert.equal(invalidRegisterResponse.status, 400);
    const invalidRegisterPayload = (await invalidRegisterResponse.json()) as { message: string[] };
    assert.ok(
      invalidRegisterPayload.message.some((message) => message.includes('property unexpected should not exist')),
    );

    const invalidRequestIdResponse = await fetch(`${baseUrl}/health/live`, {
      headers: {
        'x-request-id': 'bad request id with spaces',
      },
    });

    assert.equal(invalidRequestIdResponse.status, 200);
    const resolvedRequestId = invalidRequestIdResponse.headers.get('x-request-id');
    assert.ok(resolvedRequestId);
    assert.notEqual(resolvedRequestId, 'bad request id with spaces');
    assert.match(resolvedRequestId, /^[a-f0-9-]{36}$/i);

    const duplicateRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwardedFor,
      },
      body: JSON.stringify({
        email: registerPayload.user.email.toUpperCase(),
        password: 'StrongPassword123',
      }),
    });

    assert.equal(duplicateRegisterResponse.status, 409);
    const duplicateLog = capturedLogs.find(
      (event) =>
        event.metadata.action === 'auth_register_rejected' &&
        event.metadata.reason === 'email_already_registered',
    );
    assert.ok(duplicateLog);
    assert.equal('email' in (duplicateLog?.metadata ?? {}), false);
    assert.equal(duplicateLog?.metadata.emailDomain, 'example.com');

    const createConversationResponse = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${registerPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '   Hardening chat   ',
      }),
    });

    assert.equal(createConversationResponse.status, 201);
    const conversationPayload = (await createConversationResponse.json()) as {
      id: string;
      title: string;
    };
    assert.equal(conversationPayload.title, 'Hardening chat');

    const sendMessageResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${registerPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: '   Quiero comprar un monoambiente en Palermo con balcon   ',
      }),
    });

    assert.equal(sendMessageResponse.status, 201);

    const detailResponse = await fetch(`${baseUrl}/conversations/${conversationPayload.id}`, {
      headers: {
        authorization: `Bearer ${registerPayload.accessToken}`,
      },
    });
    assert.equal(detailResponse.status, 200);
    const detailPayload = (await detailResponse.json()) as {
      searchState: SearchFilters;
      messages: Array<{
        role: string;
        content: string;
      }>;
    };
    assert.equal(detailPayload.messages[0]?.role, 'USER');
    assert.equal(detailPayload.messages[0]?.content, 'Quiero comprar un monoambiente en Palermo con balcon');
    assert.equal(detailPayload.searchState.locations[0], 'Palermo');

    console.log('PASS phase-9 hardening validation');
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

function resolveExpectedCookieSecure() {
  if (process.env.AUTH_REFRESH_COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.AUTH_REFRESH_COOKIE_SECURE === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

function resolveExpectedSameSite() {
  const sameSite = process.env.AUTH_REFRESH_COOKIE_SAME_SITE?.trim().toLowerCase();

  if (sameSite === 'strict' || sameSite === 'none') {
    return sameSite[0].toUpperCase() + sameSite.slice(1);
  }

  return 'Lax';
}

run().catch((error: unknown) => {
  console.error('FAIL phase-9 hardening validation');
  console.error(error);
  process.exitCode = 1;
});
