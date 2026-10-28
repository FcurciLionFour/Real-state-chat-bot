import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket: {
    remoteAddress?: string | null;
  };
};

@Injectable()
export class RequestClientIpService {
  constructor(private readonly configService: ConfigService) {}

  extractClientIp(request: HttpRequest) {
    if (this.configService.get<boolean>('app.trustProxy', false)) {
      const forwardedFor = request.headers['x-forwarded-for'];

      if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
        return forwardedFor.split(',')[0].trim();
      }
    }

    return request.socket.remoteAddress ?? null;
  }
}
