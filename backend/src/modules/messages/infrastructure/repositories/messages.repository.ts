import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(conversationId: string, role: MessageRole, content: string, structuredPayloadJson?: Prisma.InputJsonValue) {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          structuredPayloadJson,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);

    return message;
  }
}
