import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { AccessTokenService } from '../../application/services/access-token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: unknown }>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    const payload = this.accessTokenService.verifyAccessToken(token);

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    this.requestContextService?.set({
      userId: payload.sub,
    });

    return true;
  }
}
