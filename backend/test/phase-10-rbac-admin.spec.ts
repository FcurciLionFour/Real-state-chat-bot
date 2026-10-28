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

type AdminOverviewPayload = {
  usersCount: number;
  conversationsCount: number;
  searchRunsCount: number;
  propertiesCacheCount: number;
  favoritesCount: number;
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
  const testEmail = `admin-rbac-${Date.now()}@local.test`;
  const forwardedFor = `10.0.10.${Math.floor(Math.random() * 200) + 1}`;

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
    assert.equal(registerPayload.user.role, UserRole.USER);

    const forbiddenOverviewResponse = await fetch(`${baseUrl}/admin/overview`, {
      headers: {
        authorization: `Bearer ${registerPayload.accessToken}`,
      },
    });

    assert.equal(forbiddenOverviewResponse.status, 403);

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
    const adminPayload = (await loginResponse.json()) as AuthPayload;
    assert.equal(adminPayload.user.role, UserRole.ADMIN);

    const adminOverviewResponse = await fetch(`${baseUrl}/admin/overview`, {
      headers: {
        authorization: `Bearer ${adminPayload.accessToken}`,
      },
    });

    assert.equal(adminOverviewResponse.status, 200);
    const adminOverviewPayload = (await adminOverviewResponse.json()) as AdminOverviewPayload;
    assert.ok(adminOverviewPayload.usersCount >= 1);
    assert.ok(adminOverviewPayload.conversationsCount >= 0);
    assert.ok(adminOverviewPayload.searchRunsCount >= 0);
    assert.ok(adminOverviewPayload.propertiesCacheCount >= 0);
    assert.ok(adminOverviewPayload.favoritesCount >= 0);

    console.log('PASS phase-10 rbac admin');
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
  console.error('FAIL phase-10 rbac admin');
  console.error(error);
  process.exitCode = 1;
});
