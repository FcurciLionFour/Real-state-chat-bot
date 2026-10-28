import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, title: string) {
    return this.prisma.conversation.create({
      data: {
        userId,
        title,
        status: ConversationStatus.ACTIVE,
      },
    });
  }

  findManyByUserId(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    });
  }

  countByUserId(userId: string) {
    return this.prisma.conversation.count({
      where: { userId },
    });
  }

  findDetailById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        searchState: true,
        searchRuns: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
    });
  }

  touch(conversationId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  markSearchExecuted(conversationId: string, at = new Date()) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastSearchAt: at,
        updatedAt: at,
      },
    });
  }
}
