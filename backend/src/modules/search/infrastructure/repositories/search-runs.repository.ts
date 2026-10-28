import { Injectable } from '@nestjs/common';
import { Prisma, SearchRunStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

type CreateSearchRunInput = {
  conversationId: string;
  filtersSnapshotJson: Prisma.InputJsonValue;
  queryText: string;
  requestedPage?: number;
  resultCount?: number;
  sourcesUsedJson: Prisma.InputJsonValue;
  status: SearchRunStatus;
  errorSummary?: string | null;
};

@Injectable()
export class SearchRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSearchRunInput) {
    return this.prisma.searchRun.create({
      data: {
        conversationId: data.conversationId,
        filtersSnapshotJson: data.filtersSnapshotJson,
        queryText: data.queryText,
        requestedPage: data.requestedPage ?? 1,
        resultCount: data.resultCount ?? 0,
        sourcesUsedJson: data.sourcesUsedJson,
        status: data.status,
        errorSummary: data.errorSummary ?? null,
      },
    });
  }

  findLatestByConversationId(conversationId: string) {
    return this.prisma.searchRun.findFirst({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        results: {
          orderBy: {
            position: 'asc',
          },
          include: {
            propertyCache: true,
          },
        },
      },
    });
  }
}
