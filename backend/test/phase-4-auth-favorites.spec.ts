import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, UserRole } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { AccessTokenService } from '../src/modules/auth/application/services/access-token.service';
import { AuthService } from '../src/modules/auth/application/services/auth.service';
import { PasswordHashService } from '../src/modules/auth/application/services/password-hash.service';
import { FavoritesService } from '../src/modules/favorites/application/services/favorites.service';

async function testAccessTokenServiceSignsAndVerifiesJwt() {
  const service = new AccessTokenService(
    new ConfigService({
      auth: {
        accessSecret: 'access-secret-test',
        refreshSecret: 'refresh-secret-test',
        accessExpiresIn: '15m',
        refreshExpiresIn: '30d',
      },
    }),
  );

  const token = service.signAccessToken({
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  });

  const payload = service.verifyAccessToken(token);

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.role, UserRole.USER);

  const [header, body, signature] = token.split('.');
  const tamperedToken = `${header}.${body}.tampered${signature}`;

  assert.throws(() => service.verifyAccessToken(tamperedToken), UnauthorizedException);
}

async function testPasswordHashServiceHashesAndVerifies() {
  const service = new PasswordHashService();
  const passwordHash = await service.hash('StrongPassword123');

  assert.notEqual(passwordHash, 'StrongPassword123');
  assert.equal(await service.verify('StrongPassword123', passwordHash), true);
  assert.equal(await service.verify('WrongPassword123', passwordHash), false);
}

async function testAuthServiceRegisterLoginRefreshAndLogout() {
  const createdRefreshTokens: Array<{ userId: string; tokenHash: string }> = [];
  let existingUser: {
    id: string;
    email: string;
    passwordHash: string | null;
    role: UserRole;
    createdAt?: Date;
  } | null = null;

  const service = new AuthService(
    new ConfigService({
      auth: {
        refreshCookie: {
          secure: false,
          sameSite: 'lax',
          domain: null,
          path: '/api/auth',
        },
      },
    }),
    {
      findByEmail: async (email: string) => (existingUser?.email === email ? existingUser : null),
      createUser: async (email: string, passwordHash: string) => {
        existingUser = {
          id: 'user-1',
          email,
          passwordHash,
          role: UserRole.USER,
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
        };
        return existingUser;
      },
      findById: async (id: string) => (existingUser?.id === id ? existingUser : null),
    } as never,
    {
      hash: async () => 'hashed-password',
      verify: async (_password: string, passwordHash: string) => passwordHash === 'hashed-password',
    } as never,
    {
      generateRefreshToken: () => 'refresh-token-1',
      getRefreshTokenExpiresAt: () => new Date('2026-05-08T00:00:00.000Z'),
      getRefreshCookieMaxAge: () => 1000,
      hashRefreshToken: (token: string) => `hash:${token}`,
      signAccessToken: (user: { id: string }) => `access:${user.id}`,
    } as never,
    {
      create: async (payload: { userId: string; tokenHash: string }) => {
        createdRefreshTokens.push(payload);
      },
      findActiveByTokenHash: async (tokenHash: string) =>
        tokenHash === 'hash:refresh-token-1' && existingUser
          ? {
              id: 'refresh-row-1',
              tokenHash,
              expiresAt: new Date('2026-05-08T00:00:00.000Z'),
              revokedAt: null,
              user: existingUser,
            }
          : null,
      revokeByTokenHash: async () => ({ count: 1 }),
    } as never,
    {
      createPasswordIdentity: async () => undefined,
    } as never,
    {
      logEvent: () => undefined,
      warnEvent: () => undefined,
    } as never,
  );

  const registerResult = await service.register('user@example.com', 'StrongPassword123', {
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  });

  assert.equal(registerResult.user.email, 'user@example.com');
  assert.equal(registerResult.accessToken, 'access:user-1');
  assert.equal(registerResult.refreshToken, 'refresh-token-1');
  assert.equal(createdRefreshTokens.length, 1);

  const loginResult = await service.login('user@example.com', 'StrongPassword123', {
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  });

  assert.equal(loginResult.user.id, 'user-1');
  assert.equal(loginResult.accessToken, 'access:user-1');

  const refreshResult = await service.refresh('refresh-token-1');
  assert.equal(refreshResult.accessToken, 'access:user-1');

  const meResult = await service.me({
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  });
  assert.deepEqual(meResult, {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
  });

  const logoutResult = await service.logout('refresh-token-1');
  assert.deepEqual(logoutResult, { success: true });

  await assert.rejects(() => service.refresh('invalid-refresh-token'), UnauthorizedException);

  existingUser = {
    id: 'user-2',
    email: 'oauth-only@example.com',
    passwordHash: null,
    role: UserRole.USER,
  };

  await assert.rejects(
    () => service.login('oauth-only@example.com', 'StrongPassword123', { userAgent: null, ipAddress: null }),
    UnauthorizedException,
  );
}

async function testFavoritesServiceHandlesListAndIdempotentCreate() {
  const service = new FavoritesService(
    {
      findManyByUserId: async () => [
        {
          id: 'favorite-1',
          userId: 'user-1',
          propertyCacheId: 'property-1',
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
          propertyCache: {
            id: 'property-1',
            source: 'mock-source',
            sourceUrl: 'https://example.com/property-1',
            title: 'Departamento en Palermo',
            operation: 'BUY',
            propertyType: 'APARTMENT',
            priceAmount: 135000,
            priceCurrency: 'USD',
            city: 'CABA',
            neighborhood: 'Palermo',
            listingStatus: ListingStatus.ACTIVE,
            scrapedAt: new Date('2026-04-08T00:00:00.000Z'),
            imagesJson: ['https://example.com/image-1.jpg'],
          },
        },
      ],
      countByUserId: async () => 1,
      findByUserIdAndPropertyId: async (userId: string, propertyId: string) =>
        userId === 'user-1' && propertyId === 'property-1'
          ? {
              id: 'favorite-1',
              userId: 'user-1',
              propertyCacheId: 'property-1',
              createdAt: new Date('2026-04-08T00:00:00.000Z'),
              propertyCache: null,
            }
          : null,
      create: async () => ({
        id: 'favorite-2',
        userId: 'user-1',
        propertyCacheId: 'property-2',
        createdAt: new Date('2026-04-08T01:00:00.000Z'),
        propertyCache: null,
      }),
      deleteByUserIdAndPropertyId: async () => ({ count: 1 }),
    } as never,
    {
      findById: async (id: string) =>
        id === 'property-2'
          ? {
              id: 'property-2',
            }
          : id === 'property-1'
            ? {
                id: 'property-1',
              }
            : null,
    } as never,
    {
      logEvent: () => undefined,
      warnEvent: () => undefined,
    } as never,
  );

  const listResult = await service.listByUserId('user-1', 1, 20);
  assert.equal(listResult.meta.total, 1);
  assert.equal(listResult.items[0].property.propertyId, 'property-1');
  assert.equal(listResult.items[0].property.price, 135000);

  const existingResult = await service.create('user-1', 'property-1');
  assert.equal(existingResult.created, false);
  assert.equal(existingResult.favorite.favoriteId, 'favorite-1');

  const createdResult = await service.create('user-1', 'property-2');
  assert.equal(createdResult.created, true);
  assert.equal(createdResult.favorite.favoriteId, 'favorite-2');

  const deleteResult = await service.delete('user-1', 'property-2');
  assert.deepEqual(deleteResult, { success: true });
}

async function run() {
  const cases: Array<{ name: string; execute: () => Promise<void> }> = [
    {
      name: 'access token service signs and verifies jwt',
      execute: testAccessTokenServiceSignsAndVerifiesJwt,
    },
    {
      name: 'password hash service hashes and verifies',
      execute: testPasswordHashServiceHashesAndVerifies,
    },
    {
      name: 'auth service handles register login refresh and logout',
      execute: testAuthServiceRegisterLoginRefreshAndLogout,
    },
    {
      name: 'favorites service handles list and idempotent create',
      execute: testFavoritesServiceHandlesListAndIdempotentCreate,
    },
  ];

  for (const testCase of cases) {
    await testCase.execute();
    console.log(`PASS ${testCase.name}`);
  }
}

run().catch((error: unknown) => {
  console.error('FAIL phase-4 auth favorites tests');
  console.error(error);
  process.exitCode = 1;
});
