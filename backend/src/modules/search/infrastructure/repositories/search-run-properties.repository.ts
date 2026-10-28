import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

type CreateSearchRunPropertyInput = {
  searchRunId: string;
  propertyCacheId: string;
  position: number;
  rankScore: number;
  rankReasonJson: Prisma.InputJsonValue;
};

@Injectable()
export class SearchRunPropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(items: CreateSearchRunPropertyInput[]) {
    return this.prisma.searchRunProperty.createMany({
      data: items.map((item) => ({
        searchRunId: item.searchRunId,
        propertyCacheId: item.propertyCacheId,
        position: item.position,
        rankScore: item.rankScore,
        rankReasonJson: item.rankReasonJson,
      })),
    });
  }
}
