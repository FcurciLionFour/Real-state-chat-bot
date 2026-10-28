import * as assert from 'node:assert/strict';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../src/infrastructure/security/guards/rate-limit.guard';
import { RATE_LIMIT_OPTIONS } from '../src/infrastructure/security/decorators/rate-limit.decorator';

function createExecutionContext(request: {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string | null };
  user?: { id?: string };
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

async function testRateLimitAllowsRequestsWithinConfiguredWindow() {
  const incrementCalls: string[] = [];
  const guard = new RateLimitGuard(
    {
      getAllAndOverride: () => ({
        namespace: 'auth-login',
        limit: 2,
        windowSeconds: 300,
        keyStrategy: 'ip',
      }),
    } as never as Reflector,
    {
      incrementWithinWindow: async (key: string) => {
        incrementCalls.push(key);
        return {
          value: incrementCalls.length,
          ttlSeconds: 300,
        };
      },
    } as never,
    {
      warnEvent: () => undefined,
    } as never,
    {
      extractClientIp: (request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string | null } }) =>
        (typeof request.headers['x-forwarded-for'] === 'string' ? request.headers['x-forwarded-for'] : null) ??
        request.socket.remoteAddress ??
        null,
    } as never,
  );

  const context = createExecutionContext({
    headers: {},
    socket: {
      remoteAddress: '127.0.0.1',
    },
  });

  assert.equal(await guard.canActivate(context), true);
  assert.equal(await guard.canActivate(context), true);
  assert.equal(incrementCalls.length, 2);
  assert.equal(incrementCalls[0], incrementCalls[1]);
}

async function testRateLimitRejectsWhenThresholdIsExceeded() {
  const guard = new RateLimitGuard(
    {
      getAllAndOverride: () => ({
        namespace: 'chat-send-message',
        limit: 1,
        windowSeconds: 300,
        keyStrategy: 'user_or_ip',
      }),
    } as never as Reflector,
    {
      incrementWithinWindow: async () => ({
        value: 2,
        ttlSeconds: 120,
      }),
    } as never,
    {
      warnEvent: () => undefined,
    } as never,
    {
      extractClientIp: (request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string | null } }) =>
        (typeof request.headers['x-forwarded-for'] === 'string' ? request.headers['x-forwarded-for'] : null) ??
        request.socket.remoteAddress ??
        null,
    } as never,
  );

  const context = createExecutionContext({
    headers: {
      'x-forwarded-for': '181.23.45.67',
    },
    socket: {},
    user: {
      id: 'user-1',
    },
  });

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
}

async function testRateLimitDegradesCleanlyWhenRedisIsUnavailable() {
  const guard = new RateLimitGuard(
    {
      getAllAndOverride: () => ({
        namespace: 'auth-refresh',
        limit: 1,
        windowSeconds: 300,
        keyStrategy: 'ip',
      }),
    } as never as Reflector,
    {
      incrementWithinWindow: async () => null,
    } as never,
    {
      warnEvent: () => undefined,
    } as never,
    {
      extractClientIp: (request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string | null } }) =>
        (typeof request.headers['x-forwarded-for'] === 'string' ? request.headers['x-forwarded-for'] : null) ??
        request.socket.remoteAddress ??
        null,
    } as never,
  );

  const context = createExecutionContext({
    headers: {},
    socket: {
      remoteAddress: '127.0.0.1',
    },
  });

  assert.equal(await guard.canActivate(context), true);
}

async function testRateLimitDecoratorMetadataIsReadable() {
  assert.equal(RATE_LIMIT_OPTIONS, 'rate_limit_options');
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'rate limit allows requests within configured window',
      execute: testRateLimitAllowsRequestsWithinConfiguredWindow,
    },
    {
      name: 'rate limit rejects when threshold is exceeded',
      execute: testRateLimitRejectsWhenThresholdIsExceeded,
    },
    {
      name: 'rate limit degrades cleanly when redis is unavailable',
      execute: testRateLimitDegradesCleanlyWhenRedisIsUnavailable,
    },
    {
      name: 'rate limit metadata constant stays stable',
      execute: testRateLimitDecoratorMetadataIsReadable,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-8 rate limiting tests');
  console.error(error);
  process.exitCode = 1;
});
