import { SetMetadata } from '@nestjs/common';

export type RateLimitKeyStrategy = 'ip' | 'user_or_ip';

export type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowSeconds: number;
  keyStrategy: RateLimitKeyStrategy;
};

export const RATE_LIMIT_OPTIONS = 'rate_limit_options';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_OPTIONS, options);
