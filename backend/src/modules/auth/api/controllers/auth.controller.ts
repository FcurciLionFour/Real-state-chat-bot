import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { RateLimit } from '../../../../infrastructure/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../../infrastructure/security/guards/rate-limit.guard';
import { RequestClientIpService } from '../../../../infrastructure/security/request-client-ip.service';
import { AuthService } from '../../application/services/auth.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../domain/constants/auth.constants';
import { CurrentUser } from '../../presentation/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../presentation/guards/access-token.guard';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthenticatedUser } from '../../domain/types/authenticated-user.type';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket: {
    remoteAddress?: string | null;
  };
};

type HttpResponse = {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string, options?: Record<string, unknown>) => void;
};

const AUTH_RATE_LIMITS =
  process.env.NODE_ENV === 'production'
    ? {
        register: { limit: 5, windowSeconds: 300 },
        login: { limit: 10, windowSeconds: 300 },
        refresh: { limit: 20, windowSeconds: 300 },
      }
    : {
        register: { limit: 30, windowSeconds: 60 },
        login: { limit: 40, windowSeconds: 60 },
        refresh: { limit: 60, windowSeconds: 60 },
      };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContextService: RequestContextService,
    private readonly requestClientIpService: RequestClientIpService,
  ) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-register',
    limit: AUTH_RATE_LIMITS.register.limit,
    windowSeconds: AUTH_RATE_LIMITS.register.windowSeconds,
    keyStrategy: 'ip',
  })
  async register(
    @Body() body: RegisterDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const result = await this.authService.register(body.email, body.password, {
      userAgent: this.readHeader(request.headers['user-agent']),
      ipAddress: this.extractIpAddress(request),
    });

    response.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, this.authService.getRefreshCookieOptions());
    this.requestContextService.set({ userId: result.user.id });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-login',
    limit: AUTH_RATE_LIMITS.login.limit,
    windowSeconds: AUTH_RATE_LIMITS.login.windowSeconds,
    keyStrategy: 'ip',
  })
  async login(
    @Body() body: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const result = await this.authService.login(body.email, body.password, {
      userAgent: this.readHeader(request.headers['user-agent']),
      ipAddress: this.extractIpAddress(request),
    });

    response.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, this.authService.getRefreshCookieOptions());
    this.requestContextService.set({ userId: result.user.id });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-refresh',
    limit: AUTH_RATE_LIMITS.refresh.limit,
    windowSeconds: AUTH_RATE_LIMITS.refresh.windowSeconds,
    keyStrategy: 'ip',
  })
  async refresh(@Req() request: HttpRequest) {
    const refreshToken = this.authService.extractRefreshToken(this.readHeader(request.headers.cookie));

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: HttpRequest, @Res({ passthrough: true }) response: HttpResponse) {
    const refreshToken = this.authService.extractRefreshToken(this.readHeader(request.headers.cookie));
    const result = await this.authService.logout(refreshToken);
    this.authService.clearRefreshCookie(response);

    return result;
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    this.requestContextService.set({ userId: user.id });
    return this.authService.me(user);
  }

  private extractIpAddress(request: HttpRequest) {
    return this.requestClientIpService.extractClientIp(request);
  }

  private readHeader(value?: string | string[]) {
    if (Array.isArray(value)) {
      return value[0] ?? undefined;
    }

    return value;
  }
}
