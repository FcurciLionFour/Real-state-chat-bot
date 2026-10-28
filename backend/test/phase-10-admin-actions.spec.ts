import 'dotenv/config';
import * as assert from 'node:assert/strict';
import { CurrencyCode, MessageRole, OperationType, PropertyType, SearchRunStatus, UserRole } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { LoggerService } from '../src/infrastructure/observability/logger.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RequestContextService } from '../src/infrastructure/observability/request-context.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

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
  const redis = app.get(RedisService);

  configureApp(app, configService, logger, requestContextService);
  await app.listen(0);

  const server = app.getHttpServer();
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const adminEmail = `admin-actions-${Date.now()}@local.test`;
  const targetEmail = `admin-actions-target-${Date.now()}@local.test`;
  const adminForwardedFor = `10.0.20.${Math.floor(Math.random() * 200) + 1}`;
  const targetForwardedFor = `10.0.21.${Math.floor(Math.random() * 200) + 1}`;

  try {
    const adminRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': adminForwardedFor,
      },
      body: JSON.stringify({
        email: adminEmail,
        password: 'StrongPassword123',
      }),
    });

    assert.equal(adminRegisterResponse.status, 201);
    const adminRegisterPayload = (await adminRegisterResponse.json()) as AuthPayload;

    await prisma.user.update({
      where: { id: adminRegisterPayload.user.id },
      data: { role: UserRole.ADMIN },
    });

    const adminLoginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': adminForwardedFor,
      },
      body: JSON.stringify({
        email: adminEmail,
        password: 'StrongPassword123',
      }),
    });

    assert.equal(adminLoginResponse.status, 200);
    const adminLoginPayload = (await adminLoginResponse.json()) as AuthPayload;
    assert.equal(adminLoginPayload.user.role, UserRole.ADMIN);

    const targetRegisterResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': targetForwardedFor,
      },
      body: JSON.stringify({
        email: targetEmail,
        password: 'StrongPassword123',
      }),
    });

    assert.equal(targetRegisterResponse.status, 201);
    const targetRegisterPayload = (await targetRegisterResponse.json()) as AuthPayload;
    assert.equal(targetRegisterPayload.user.role, UserRole.USER);

    const conversation = await prisma.conversation.create({
      data: {
        userId: targetRegisterPayload.user.id,
        title: 'Admin detalle conversacion',
        status: 'ACTIVE',
      },
    });

    await prisma.searchState.create({
      data: {
        conversationId: conversation.id,
        filtersJson: {
          operation: OperationType.BUY,
          propertyTypes: [PropertyType.APARTMENT],
          locations: ['Palermo'],
          priceMin: null,
          priceMax: 140000,
          currency: CurrencyCode.USD,
          rooms: 1,
          bedrooms: null,
          bathrooms: null,
          areaMin: null,
          areaMax: null,
          expensesMax: null,
          features: ['BALCONY'],
          sortPreference: null,
        },
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          role: MessageRole.USER,
          content: 'Quiero comprar un monoambiente en Palermo con balcon',
        },
        {
          conversationId: conversation.id,
          role: MessageRole.ASSISTANT,
          content: 'Armo la busqueda en Palermo para compra de departamento hasta USD 140000.',
        },
      ],
    });

    const property = await prisma.propertyCache.create({
      data: {
        source: 'zonaprop',
        externalId: 'admin-actions-1',
        sourceUrl: `https://example.com/admin-actions-${Date.now()}`,
        canonicalHash: `admin-actions-${Date.now()}`,
        rawPayloadJson: {},
        normalizedPayloadJson: {},
        title: 'Departamento admin en Palermo',
        city: 'CABA',
        neighborhood: 'Palermo',
        locationText: 'Palermo, Capital Federal',
        operation: OperationType.BUY,
        propertyType: PropertyType.APARTMENT,
        priceAmount: 138000,
        priceCurrency: CurrencyCode.USD,
        featuresJson: ['BALCONY'],
        imagesJson: [],
        scrapedAt: new Date(),
      },
    });

    const searchRun = await prisma.searchRun.create({
      data: {
        conversationId: conversation.id,
        filtersSnapshotJson: {
          operation: OperationType.BUY,
          propertyTypes: [PropertyType.APARTMENT],
          locations: ['Palermo'],
          priceMax: 140000,
          currency: CurrencyCode.USD,
          rooms: 1,
          features: ['BALCONY'],
        },
        queryText: 'departamento compra Palermo balcon',
        resultCount: 1,
        sourcesUsedJson: ['zonaprop'],
        status: SearchRunStatus.COMPLETED,
      },
    });

    await prisma.searchRunProperty.create({
      data: {
        searchRunId: searchRun.id,
        propertyCacheId: property.id,
        position: 1,
        rankScore: 0.97,
        rankReasonJson: ['Coincide con la zona', 'Tiene balcon'],
      },
    });

    const conversationDetailResponse = await fetch(`${baseUrl}/admin/conversations/${conversation.id}`, {
      headers: {
        authorization: `Bearer ${adminLoginPayload.accessToken}`,
      },
    });

    assert.equal(conversationDetailResponse.status, 200);
    const conversationDetailPayload = (await conversationDetailResponse.json()) as {
      id: string;
      messages: Array<{ id: string }>;
      lastSearchRun: { id: string; queryText: string } | null;
      lastSearchResults: Array<{ property: { id: string } }>;
    };
    assert.equal(conversationDetailPayload.id, conversation.id);
    assert.equal(conversationDetailPayload.messages.length, 2);
    assert.equal(conversationDetailPayload.lastSearchRun?.id, searchRun.id);
    assert.equal(conversationDetailPayload.lastSearchRun?.queryText, 'departamento compra Palermo balcon');
    assert.equal(conversationDetailPayload.lastSearchResults[0]?.property.id, property.id);

    const searchRunDetailResponse = await fetch(`${baseUrl}/admin/search-runs/${searchRun.id}`, {
      headers: {
        authorization: `Bearer ${adminLoginPayload.accessToken}`,
      },
    });

    assert.equal(searchRunDetailResponse.status, 200);
    const searchRunDetailPayload = (await searchRunDetailResponse.json()) as {
      id: string;
      queryText: string;
      sourcesUsed: string[];
      results: Array<{ property: { id: string } }>;
    };
    assert.equal(searchRunDetailPayload.id, searchRun.id);
    assert.equal(searchRunDetailPayload.queryText, 'departamento compra Palermo balcon');
    assert.deepEqual(searchRunDetailPayload.sourcesUsed, ['zonaprop']);
    assert.equal(searchRunDetailPayload.results[0]?.property.id, property.id);

    const updateRoleResponse = await fetch(`${baseUrl}/admin/users/${targetRegisterPayload.user.id}/role`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${adminLoginPayload.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        role: UserRole.ADMIN,
      }),
    });

    assert.equal(updateRoleResponse.status, 200);
    const updateRolePayload = (await updateRoleResponse.json()) as {
      id: string;
      role: UserRole;
    };
    assert.equal(updateRolePayload.id, targetRegisterPayload.user.id);
    assert.equal(updateRolePayload.role, UserRole.ADMIN);

    const updatedUser = await prisma.user.findUnique({
      where: { id: targetRegisterPayload.user.id },
      select: { role: true },
    });
    assert.equal(updatedUser?.role, UserRole.ADMIN);

    await redis.set('search:results:test:admin-actions', 'cached-result', 120);
    await redis.set('search:google:discovery:test:admin-actions', 'cached-discovery', 120);
    await redis.set('search:discovery:test:admin-actions', 'cached-discovery-generic', 120);
    await redis.set('search:html:test:admin-actions', 'cached-html', 120);

    const invalidateCacheResponse = await fetch(`${baseUrl}/admin/cache/invalidate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminLoginPayload.accessToken}`,
      },
    });

    assert.equal(invalidateCacheResponse.status, 201);
    const invalidateCachePayload = (await invalidateCacheResponse.json()) as {
      prefixes: string[];
      redisAvailable: boolean;
      matchedKeys: number;
      deletedKeys: number;
    };
    assert.equal(invalidateCachePayload.redisAvailable, true);
    assert.deepEqual(invalidateCachePayload.prefixes, [
      'search:results:',
      'search:google:discovery:',
      'search:discovery:',
      'search:html:',
    ]);
    assert.ok(invalidateCachePayload.matchedKeys >= 4);
    assert.ok(invalidateCachePayload.deletedKeys >= 4);
    assert.equal(await redis.get('search:results:test:admin-actions'), null);
    assert.equal(await redis.get('search:google:discovery:test:admin-actions'), null);
    assert.equal(await redis.get('search:discovery:test:admin-actions'), null);
    assert.equal(await redis.get('search:html:test:admin-actions'), null);

    console.log('PASS phase-10 admin actions');
  } finally {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, targetEmail],
        },
      },
    });
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-10 admin actions');
  console.error(error);
  process.exitCode = 1;
});
