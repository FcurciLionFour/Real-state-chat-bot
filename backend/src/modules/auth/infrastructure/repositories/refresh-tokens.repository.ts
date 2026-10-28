import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

type CreateRefreshTokenInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateRefreshTokenInput) {
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async findActiveByTokenHash(tokenHash: string) {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!refreshToken) {
      return null;
    }

    if (refreshToken.revokedAt || refreshToken.expiresAt <= new Date()) {
      return null;
    }

    return refreshToken;
  }

  revokeById(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  revokeByTokenHash(tokenHash: string) {
    return this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
