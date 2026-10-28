import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  create(email: string, passwordHash: string | null) {
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.USER,
      },
    });
  }

  createDevelopmentUser(email: string) {
    return this.create(email, 'development-placeholder');
  }
}
