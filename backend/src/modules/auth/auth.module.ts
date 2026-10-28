import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './api/controllers/auth.controller';
import { AccessTokenService } from './application/services/access-token.service';
import { AuthService } from './application/services/auth.service';
import { PasswordHashService } from './application/services/password-hash.service';
import { AuthIdentitiesRepository } from './infrastructure/repositories/auth-identities.repository';
import { EmailVerificationTokensRepository } from './infrastructure/repositories/email-verification-tokens.repository';
import { RefreshTokensRepository } from './infrastructure/repositories/refresh-tokens.repository';
import { AccessTokenGuard } from './presentation/guards/access-token.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHashService,
    AccessTokenService,
    AuthIdentitiesRepository,
    EmailVerificationTokensRepository,
    RefreshTokensRepository,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [AuthService, AccessTokenService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
