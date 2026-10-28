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

  configureApp(app, configService, logger, requestContextService);
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const testEmail = `admin-rate-limit-${Date.now()}@local.test`;
  const forwardedFor = `10.0.30.${Math.floor(Math.random() * 200) + 1}`;

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

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${baseUrl}/admin/overview`, {
        headers: {
          authorization: `Bearer ${loginPayload.accessToken}`,
        },
      });

      assert.equal(response.status, 200);
    }

    const limitedReadResponse = await fetch(`${baseUrl}/admin/overview`, {
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });

    assert.equal(limitedReadResponse.status, 429);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${baseUrl}/admin/cache/invalidate`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${loginPayload.accessToken}`,
        },
      });

      assert.equal(response.status, 201);
    }

    const limitedWriteResponse = await fetch(`${baseUrl}/admin/cache/invalidate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${loginPayload.accessToken}`,
      },
    });

    assert.equal(limitedWriteResponse.status, 429);

    console.log('PASS phase-10 admin rate limit');
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: testEmail,
      },
    });
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-10 admin rate limit');
  console.error(error);
  process.exitCode = 1;
});
