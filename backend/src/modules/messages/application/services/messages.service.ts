import { Injectable } from '@nestjs/common';
import { MessageRole, Prisma } from '@prisma/client';
import { MessagesRepository } from '../../infrastructure/repositories/messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  createUserMessage(conversationId: string, content: string) {
    return this.messagesRepository.create(conversationId, MessageRole.USER, content);
  }

  createAssistantMessage(conversationId: string, content: string, structuredPayloadJson?: Prisma.InputJsonValue) {
    return this.messagesRepository.create(conversationId, MessageRole.ASSISTANT, content, structuredPayloadJson);
  }
}
