import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoggerService } from '../observability/logger.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private connectionAttempted = false;
  private connectionAvailable = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const redisUrl = this.configService.get<string>('redis.url', '');

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
  }

  getClient() {
    return this.client;
  }

  async get(key: string) {
    const client = await this.getConnectedClient();
    if (!client) {
      return null;
    }

    try {
      return await client.get(key);
    } catch (error) {
      this.logRedisWarning('redis get failed', { action: 'redis_get', key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    const client = await this.getConnectedClient();
    if (!client) {
      return false;
    }

    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, 'EX', ttlSeconds);
      } else {
        await client.set(key, value);
      }

      return true;
    } catch (error) {
      this.logRedisWarning('redis set failed', { action: 'redis_set', key, ttlSeconds, error });
      return false;
    }
  }

  async getJson<T>(key: string) {
    const rawValue = await this.get(key);
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch (error) {
      this.logRedisWarning('redis cached json could not be parsed', { action: 'redis_get_json', key, error });
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    return this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async incrementWithinWindow(key: string, ttlSeconds: number) {
    const client = await this.getConnectedClient();
    if (!client) {
      return null;
    }

    try {
      const nextValue = await client.incr(key);

      if (nextValue === 1) {
        await client.expire(key, ttlSeconds);
      }

      const ttl = await client.ttl(key);

      return {
        value: nextValue,
        ttlSeconds: ttl >= 0 ? ttl : ttlSeconds,
      };
    } catch (error) {
      this.logRedisWarning('redis increment failed', { action: 'redis_incr', key, ttlSeconds, error });
      return null;
    }
  }

  async ping() {
    const client = await this.getConnectedClient();
    if (!client) {
      return false;
    }

    try {
      return (await client.ping()) === 'PONG';
    } catch (error) {
      this.logRedisWarning('redis ping failed', { action: 'redis_ping', error });
      return false;
    }
  }

  async deleteByPrefixes(prefixes: string[]) {
    const client = await this.getConnectedClient();
    if (!client) {
      return {
        available: false,
        matchedKeys: 0,
        deletedKeys: 0,
      };
    }

    const normalizedPrefixes = prefixes
      .map((prefix) => prefix.trim())
      .filter((prefix, index, array) => prefix.length > 0 && array.indexOf(prefix) === index);

    if (normalizedPrefixes.length === 0) {
      return {
        available: true,
        matchedKeys: 0,
        deletedKeys: 0,
      };
    }

    const matchingKeys = new Set<string>();

    try {
      for (const prefix of normalizedPrefixes) {
        let cursor = '0';

        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = nextCursor;

          for (const key of keys) {
            matchingKeys.add(key);
          }
        } while (cursor !== '0');
      }

      if (matchingKeys.size === 0) {
        return {
          available: true,
          matchedKeys: 0,
          deletedKeys: 0,
        };
      }

      const deletedKeys = await client.del(...matchingKeys);

      return {
        available: true,
        matchedKeys: matchingKeys.size,
        deletedKeys,
      };
    } catch (error) {
      this.logRedisWarning('redis delete by prefixes failed', {
        action: 'redis_delete_by_prefixes',
        prefixes: normalizedPrefixes,
        error,
      });

      return {
        available: true,
        matchedKeys: 0,
        deletedKeys: 0,
      };
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private async getConnectedClient() {
    if (this.connectionAvailable) {
      return this.client;
    }

    if (this.connectionAttempted) {
      return null;
    }

    this.connectionAttempted = true;

    try {
      await this.client.connect();
      this.connectionAvailable = true;
      this.logger.logEvent(
        'redis connection established',
        {
          module: 'RedisService',
          action: 'redis_connect',
        },
        RedisService.name,
      );
      return this.client;
    } catch (error) {
      this.logRedisWarning('redis connection unavailable, continuing without cache', {
        action: 'redis_connect',
        error,
      });
      return null;
    }
  }

  private logRedisWarning(message: string, metadata: Record<string, unknown>) {
    this.logger.warnEvent(
      message,
      {
        module: 'RedisService',
        ...metadata,
      },
      RedisService.name,
    );
  }
}
