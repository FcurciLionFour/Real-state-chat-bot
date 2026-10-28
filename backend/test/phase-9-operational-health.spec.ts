import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { RequestContextService } from '../src/infrastructure/observability/request-context.service';

type LiveResponse = {
  status: string;
  service: string;
  timestamp: string;
};

type ReadinessResponse = {
  status: string;
  service: string;
  timestamp: string;
  checks: {
    database: {
      status: string;
      latencyMs: number;
    };
    redis: {
      status: string;
      optional: boolean;
      latencyMs: number;
    };
    openai: {
      status: string;
    };
    discovery: {
      status: string;
    };
  };
  capabilities: {
    aiInterpretation: string;
    discovery: string;
  };
};

async function run() {
  const discoveryProvider = resolveDiscoveryProvider();
  const discoveryConfigured = getExpectedDiscoveryCredentialGaps(discoveryProvider).length === 0;
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);

  configureApp(app, configService, logger, requestContextService);
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    assert.equal(liveResponse.status, 200);

    const livePayload = (await liveResponse.json()) as LiveResponse;
    assert.equal(livePayload.status, 'ok');
    assert.equal(livePayload.service, 'real-state-chat-bot-backend');
    assert.ok(Date.parse(livePayload.timestamp) > 0);

    const readinessResponse = await fetch(`${baseUrl}/health/ready`);
    assert.equal(readinessResponse.status, 200);

    const readinessPayload = (await readinessResponse.json()) as ReadinessResponse;
    assert.equal(readinessPayload.status, 'ready');
    assert.equal(readinessPayload.service, 'real-state-chat-bot-backend');
    assert.equal(readinessPayload.checks.database.status, 'up');
    assert.ok(readinessPayload.checks.database.latencyMs >= 0);
    assert.ok(['up', 'degraded'].includes(readinessPayload.checks.redis.status));
    assert.equal(readinessPayload.checks.redis.optional, true);
    assert.ok(readinessPayload.checks.redis.latencyMs >= 0);
    assert.equal(
      readinessPayload.checks.openai.status,
      process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    );
    assert.equal(
      readinessPayload.capabilities.aiInterpretation,
      process.env.OPENAI_API_KEY ? 'live' : 'safe-fallback',
    );
    assert.equal(
      readinessPayload.capabilities.discovery,
      discoveryConfigured ? 'live' : 'not_configured',
    );
    assert.equal(
      readinessPayload.checks.discovery.status,
      discoveryConfigured ? 'configured' : 'not_configured',
    );

    console.log('PASS phase-9 operational health validation');
  } finally {
    await app.close();
  }
}

function resolveDiscoveryProvider() {
  return process.env.SEARCH_DISCOVERY_PROVIDER === 'vertex-ai-search'
    ? 'vertex-ai-search'
    : 'google-programmable-search';
}

function getExpectedDiscoveryCredentialGaps(provider: 'google-programmable-search' | 'vertex-ai-search') {
  if (provider === 'vertex-ai-search') {
    return [
      !process.env.VERTEX_AI_SEARCH_API_KEY ? 'VERTEX_AI_SEARCH_API_KEY' : null,
      !process.env.VERTEX_AI_SEARCH_PROJECT_ID ? 'VERTEX_AI_SEARCH_PROJECT_ID' : null,
      !process.env.VERTEX_AI_SEARCH_APP_ID ? 'VERTEX_AI_SEARCH_APP_ID' : null,
    ].filter((value): value is string => Boolean(value));
  }

  return [
    !process.env.GOOGLE_SEARCH_API_KEY ? 'GOOGLE_SEARCH_API_KEY' : null,
    !process.env.GOOGLE_SEARCH_ENGINE_ID ? 'GOOGLE_SEARCH_ENGINE_ID' : null,
  ].filter((value): value is string => Boolean(value));
}

run().catch((error: unknown) => {
  console.error('FAIL phase-9 operational health validation');
  console.error(error);
  process.exitCode = 1;
});
