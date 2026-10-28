import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserIdAndPropertyId(userId: string, propertyCacheId: string) {
    return this.prisma.favorite.findUnique({
      where: {
        userId_propertyCacheId: {
          userId,
          propertyCacheId,
        },
      },
      include: {
        propertyCache: true,
      },
    });
  }

  create(userId: string, propertyCacheId: string) {
    return this.prisma.favorite.create({
      data: {
        userId,
        propertyCacheId,
      },
      include: {
        propertyCache: true,
      },
    });
  }

  deleteByUserIdAndPropertyId(userId: string, propertyCacheId: string) {
    return this.prisma.favorite.deleteMany({
      where: {
        userId,
        propertyCacheId,
      },
    });
  }

  findManyByUserId(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        propertyCache: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });
  }

  countByUserId(userId: string) {
    return this.prisma.favorite.count({
      where: { userId },
    });
  }
}
