import { AuthProvider } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuthIdentitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProviderIdentity(provider: AuthProvider, providerUserId: string) {
    return this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: true,
      },
    });
  }

  createPasswordIdentity(userId: string, email: string) {
    return this.prisma.authIdentity.create({
      data: {
        userId,
        provider: AuthProvider.PASSWORD,
        providerUserId: userId,
        providerEmail: email,
      },
    });
  }
}
