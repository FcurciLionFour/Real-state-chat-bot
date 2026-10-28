import {
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { UsersService } from '../../../users/application/services/users.service';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../domain/constants/auth.constants';
import { AuthIdentitiesRepository } from '../../infrastructure/repositories/auth-identities.repository';
import { AuthenticatedUser } from '../../domain/types/authenticated-user.type';
import { AccessTokenService } from './access-token.service';
import { PasswordHashService } from './password-hash.service';
import { RefreshTokensRepository } from '../../infrastructure/repositories/refresh-tokens.repository';

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

type HttpResponse = {
  clearCookie: (name: string, options?: Record<string, unknown>) => void;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly passwordHashService: PasswordHashService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly authIdentitiesRepository: AuthIdentitiesRepository,
    private readonly logger: LoggerService,
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  async register(email: string, password: string, context: SessionContext) {
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      this.logger.warnEvent(
        'register rejected because email is already registered',
        {
          module: 'AuthService',
          action: 'auth_register_rejected',
          emailDomain: this.extractEmailDomain(email),
          reason: 'email_already_registered',
        },
        AuthService.name,
      );
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await this.passwordHashService.hash(password);
    const user = await this.usersService.createUser(email, passwordHash);
    await this.authIdentitiesRepository.createPasswordIdentity(user.id, user.email);
    const session = await this.issueSession(user, context);
    this.requestContextService?.set({ userId: user.id });
    this.logger.logEvent(
      'user registered successfully',
      {
        module: 'AuthService',
        action: 'auth_register_succeeded',
        userId: user.id,
      },
      AuthService.name,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  async login(email: string, password: string, context: SessionContext) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.warnEvent(
        'login rejected because user does not exist',
        {
          module: 'AuthService',
          action: 'auth_login_rejected',
          emailDomain: this.extractEmailDomain(email),
          reason: 'user_not_found',
        },
        AuthService.name,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      this.logger.warnEvent(
        'login rejected because password auth is disabled for this account',
        {
          module: 'AuthService',
          action: 'auth_login_rejected',
          userId: user.id,
          reason: 'password_login_disabled',
        },
        AuthService.name,
      );
      throw new UnauthorizedException('Password login is not enabled for this account');
    }

    const isValidPassword = await this.passwordHashService.verify(password, user.passwordHash);

    if (!isValidPassword) {
      this.logger.warnEvent(
        'login rejected because password verification failed',
        {
          module: 'AuthService',
          action: 'auth_login_rejected',
          userId: user.id,
          reason: 'invalid_password',
        },
        AuthService.name,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.issueSession(user, context);
    this.requestContextService?.set({ userId: user.id });
    this.logger.logEvent(
      'user logged in successfully',
      {
        module: 'AuthService',
        action: 'auth_login_succeeded',
        userId: user.id,
      },
      AuthService.name,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const storedToken = await this.refreshTokensRepository.findActiveByTokenHash(
      this.accessTokenService.hashRefreshToken(refreshToken),
    );

    if (!storedToken) {
      this.logger.warnEvent(
        'refresh rejected because token is invalid',
        {
          module: 'AuthService',
          action: 'auth_refresh_rejected',
          reason: 'invalid_refresh_token',
        },
        AuthService.name,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.requestContextService?.set({ userId: storedToken.user.id });
    this.logger.logEvent(
      'access token refreshed successfully',
      {
        module: 'AuthService',
        action: 'auth_refresh_succeeded',
        userId: storedToken.user.id,
      },
      AuthService.name,
    );

    return {
      accessToken: this.accessTokenService.signAccessToken({
        id: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
      }),
    };
  }

  async logout(refreshToken?: string | null) {
    if (refreshToken) {
      await this.refreshTokensRepository.revokeByTokenHash(this.accessTokenService.hashRefreshToken(refreshToken));
    }

    this.logger.logEvent(
      'user logged out successfully',
      {
        module: 'AuthService',
        action: 'auth_logout_succeeded',
        hadRefreshToken: Boolean(refreshToken),
      },
      AuthService.name,
    );

    return {
      success: true,
    };
  }

  async me(user: AuthenticatedUser) {
    const persistedUser = await this.usersService.findById(user.id);

    if (!persistedUser) {
      this.logger.warnEvent(
        'me rejected because user was not found',
        {
          module: 'AuthService',
          action: 'auth_me_rejected',
          userId: user.id,
        },
        AuthService.name,
      );
      throw new UnauthorizedException('User not found');
    }

    this.requestContextService?.set({ userId: persistedUser.id });
    return {
      id: persistedUser.id,
      email: persistedUser.email,
      role: persistedUser.role,
    };
  }

  getRefreshCookieOptions() {
    const domain = this.configService.get<string | null>('auth.refreshCookie.domain', null);

    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('auth.refreshCookie.secure', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>('auth.refreshCookie.sameSite', 'lax'),
      path: this.configService.get<string>('auth.refreshCookie.path', '/api/auth'),
      ...(domain ? { domain } : {}),
      maxAge: this.accessTokenService.getRefreshCookieMaxAge(),
    };
  }

  clearRefreshCookie(response: HttpResponse) {
    const domain = this.configService.get<string | null>('auth.refreshCookie.domain', null);

    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.get<boolean>('auth.refreshCookie.secure', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>('auth.refreshCookie.sameSite', 'lax'),
      path: this.configService.get<string>('auth.refreshCookie.path', '/api/auth'),
      ...(domain ? { domain } : {}),
    });
  }

  extractRefreshToken(cookieHeader?: string) {
    if (!cookieHeader) {
      return null;
    }

    const parts = cookieHeader.split(';');

    for (const part of parts) {
      const [name, ...rest] = part.trim().split('=');

      if (name === REFRESH_TOKEN_COOKIE_NAME) {
        return rest.join('=');
      }
    }

    return null;
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      role: AuthenticatedUser['role'];
    },
    context: SessionContext,
  ) {
    const refreshToken = this.accessTokenService.generateRefreshToken();
    const expiresAt = this.accessTokenService.getRefreshTokenExpiresAt();

    await this.refreshTokensRepository.create({
      userId: user.id,
      tokenHash: this.accessTokenService.hashRefreshToken(refreshToken),
      expiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    return {
      accessToken: this.accessTokenService.signAccessToken(user),
      refreshToken,
    };
  }

  private extractEmailDomain(email: string) {
    const atIndex = email.lastIndexOf('@');

    if (atIndex === -1 || atIndex === email.length - 1) {
      return 'unknown';
    }

    return email.slice(atIndex + 1).toLowerCase();
  }
}
