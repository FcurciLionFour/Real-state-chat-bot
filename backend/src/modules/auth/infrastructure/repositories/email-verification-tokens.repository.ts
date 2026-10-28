import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class EmailVerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  findActiveByTokenHash(tokenHash: string) {
    return this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });
  }

  markConsumed(id: string) {
    return this.prisma.emailVerificationToken.update({
      where: { id },
      data: {
        consumedAt: new Date(),
      },
    });
  }
}
