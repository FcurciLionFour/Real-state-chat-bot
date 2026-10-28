import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../../domain/types/access-token-payload.type';

type AccessTokenUser = {
  id: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class AccessTokenService {
  constructor(private readonly configService: ConfigService) {}

  signAccessToken(user: AccessTokenUser) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      iat: nowInSeconds,
      exp: nowInSeconds + this.parseDurationToSeconds(this.configService.get<string>('auth.accessExpiresIn', '15m')),
    };

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = this.encodeSegment(header);
    const encodedPayload = this.encodeSegment(payload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyAccessToken(token: string) {
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid access token');
    }

    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);

    if (!this.safeCompare(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid access token');
    }

    const payload = this.decodeSegment<AccessTokenPayload>(encodedPayload);

    if (
      !payload ||
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !Object.values(UserRole).includes(payload.role) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Access token expired');
    }

    return payload;
  }

  generateRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(refreshToken: string) {
    return createHmac('sha256', this.getRefreshSecret()).update(refreshToken).digest('hex');
  }

  getRefreshTokenExpiresAt() {
    const seconds = this.parseDurationToSeconds(this.configService.get<string>('auth.refreshExpiresIn', '30d'));
    return new Date(Date.now() + seconds * 1000);
  }

  getRefreshCookieMaxAge() {
    const seconds = this.parseDurationToSeconds(this.configService.get<string>('auth.refreshExpiresIn', '30d'));
    return seconds * 1000;
  }

  private getAccessSecret() {
    return this.configService.get<string>('auth.accessSecret', '');
  }

  private getRefreshSecret() {
    return this.configService.get<string>('auth.refreshSecret', '');
  }

  private sign(value: string) {
    return createHmac('sha256', this.getAccessSecret()).update(value).digest('base64url');
  }

  private encodeSegment(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decodeSegment<T>(value: string) {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private parseDurationToSeconds(value: string) {
    const normalizedValue = value.trim().toLowerCase();
    const match = normalizedValue.match(/^(\d+)(s|m|h|d)?$/);

    if (!match) {
      throw new Error(`Unsupported duration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 60 * 60 * 24,
    };

    return amount * multipliers[unit];
  }
}
