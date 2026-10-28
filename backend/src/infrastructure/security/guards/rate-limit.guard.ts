import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { LoggerService } from '../../observability/logger.service';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_OPTIONS, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { RequestClientIpService } from '../request-client-ip.service';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket: {
    remoteAddress?: string | null;
  };
  user?: {
    id?: string;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly requestClientIpService: RequestClientIpService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const key = this.buildStorageKey(request, options);
    const incrementResult = await this.redisService.incrementWithinWindow(key, options.windowSeconds);

    if (!incrementResult) {
      this.logger.warnEvent(
        'rate limiting skipped because redis is unavailable',
        {
          module: 'RateLimitGuard',
          action: 'rate_limit_skipped',
          namespace: options.namespace,
        },
        RateLimitGuard.name,
      );
      return true;
    }

    if (incrementResult.value > options.limit) {
      this.logger.warnEvent(
        'rate limit exceeded',
        {
          module: 'RateLimitGuard',
          action: 'rate_limit_exceeded',
          namespace: options.namespace,
          limit: options.limit,
          windowSeconds: options.windowSeconds,
          retryAfterSeconds: incrementResult.ttlSeconds,
        },
        RateLimitGuard.name,
      );
      throw new HttpException('Too many requests, please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private buildStorageKey(request: HttpRequest, options: RateLimitOptions) {
    const actorKey =
      options.keyStrategy === 'user_or_ip'
        ? request.user?.id ?? this.extractIpAddress(request) ?? 'anonymous'
        : this.extractIpAddress(request) ?? 'anonymous';

    const hashedActorKey = createHash('sha1').update(actorKey).digest('hex');
    return `rate-limit:${options.namespace}:${hashedActorKey}`;
  }

  private extractIpAddress(request: HttpRequest) {
    return this.requestClientIpService.extractClientIp(request);
  }
}
