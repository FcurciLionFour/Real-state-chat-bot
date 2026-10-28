import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../../../../infrastructure/openai/openai.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { SearchDiscoveryService } from '../../../search/application/services/search-discovery.service';

type DependencyStatus = 'up' | 'down' | 'degraded' | 'configured' | 'not_configured';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly openAiService: OpenAiService,
    private readonly searchDiscoveryService: SearchDiscoveryService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'real-state-chat-bot-backend',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const [databaseCheck, redisCheck] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const openAiConfigured = this.openAiService.getApiKey().trim().length > 0;
    const discoveryStatus = this.searchDiscoveryService.getStatus();
    const status = databaseCheck.status === 'up' ? 'ready' : 'down';

    return {
      status,
      service: 'real-state-chat-bot-backend',
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseCheck,
        redis: redisCheck,
        openai: {
          status: this.resolveConfiguredStatus(openAiConfigured),
        },
        discovery: {
          status: this.resolveConfiguredStatus(discoveryStatus.configured),
        },
      },
      capabilities: {
        aiInterpretation: openAiConfigured ? 'live' : 'safe-fallback',
        discovery: discoveryStatus.configured ? 'live' : 'not_configured',
      },
    };
  }

  private async checkDatabase() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        status: 'up' as const,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'down' as const,
        latencyMs: Date.now() - startedAt,
        error: 'database_unavailable',
      };
    }
  }

  private async checkRedis() {
    const startedAt = Date.now();
    const reachable = await this.redis.ping();

    if (reachable) {
      return {
        status: 'up' as const,
        optional: true,
        latencyMs: Date.now() - startedAt,
      };
    }

    return {
      status: 'degraded' as const,
      optional: true,
      latencyMs: Date.now() - startedAt,
      error: 'redis_unavailable',
    };
  }

  private resolveConfiguredStatus(isConfigured: boolean): DependencyStatus {
    return isConfigured ? 'configured' : 'not_configured';
  }
}
