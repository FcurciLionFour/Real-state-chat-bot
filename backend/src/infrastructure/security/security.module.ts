import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RequestClientIpService } from './request-client-ip.service';

@Global()
@Module({
  providers: [RateLimitGuard, RequestClientIpService],
  exports: [RateLimitGuard, RequestClientIpService],
})
export class SecurityModule {}
