import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { SearchFilters } from '../../domain/types/search-filters.type';

@Injectable()
export class SearchStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByConversationId(conversationId: string) {
    return this.prisma.searchState.findUnique({
      where: { conversationId },
    });
  }

  create(conversationId: string, filters: SearchFilters) {
    return this.prisma.searchState.create({
      data: {
        conversationId,
        filtersJson: filters as Prisma.InputJsonValue,
      },
    });
  }

  update(conversationId: string, filters: SearchFilters) {
    return this.prisma.searchState.update({
      where: { conversationId },
      data: {
        filtersJson: filters as Prisma.InputJsonValue,
        version: {
          increment: 1,
        },
      },
    });
  }
}
