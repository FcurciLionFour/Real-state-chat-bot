import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { SearchRunService } from '../../../search/application/services/search-run.service';
import { ConversationsRepository } from '../../infrastructure/repositories/conversations.repository';
import { SearchStateService } from '../../../search-state/application/services/search-state.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly searchStateService: SearchStateService,
    private readonly searchRunService: SearchRunService,
    private readonly logger: LoggerService,
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  async create(userId: string, title?: string) {
    const conversation = await this.conversationsRepository.create(userId, title?.trim() || 'Nueva busqueda');
    const searchState = await this.searchStateService.getOrCreateByConversationId(conversation.id);
    this.requestContextService?.set({ userId, conversationId: conversation.id });
    this.logger.logEvent(
      'conversation created',
      {
        module: 'ConversationsService',
        action: 'conversation_created',
        userId,
        conversationId: conversation.id,
      },
      ConversationsService.name,
    );

    return this.serializeConversationBase({
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      searchState,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  }

  async listByUserId(userId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.conversationsRepository.findManyByUserId(userId, page, limit),
      this.conversationsRepository.countByUserId(userId),
    ]);
    this.requestContextService?.set({ userId });
    this.logger.logEvent(
      'conversations listed',
      {
        module: 'ConversationsService',
        action: 'conversations_listed',
        userId,
        page,
        limit,
        total,
      },
      ConversationsService.name,
    );

    return {
      items: items.map((conversation) => this.serializeConversationListItem(conversation)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getDetail(userId: string, conversationId: string) {
    const conversation = await this.assertOwnership(userId, conversationId);
    const detail = await this.conversationsRepository.findDetailById(conversation.id);

    if (!detail) {
      throw new NotFoundException('Conversation not found');
    }

    const latestSearchPayload = await this.searchRunService.getLatestResultsByConversationId(detail.id);
    const searchState = detail.searchState
      ? (detail.searchState.filtersJson as unknown)
      : await this.searchStateService.getOrCreateByConversationId(detail.id);
    this.requestContextService?.set({ userId, conversationId: detail.id });
    this.logger.logEvent(
      'conversation detail retrieved',
      {
        module: 'ConversationsService',
        action: 'conversation_detail_retrieved',
        userId,
        conversationId: detail.id,
        messageCount: detail.messages.length,
      },
      ConversationsService.name,
    );

    return {
      ...this.serializeConversationBase({
        id: detail.id,
        title: detail.title,
        status: detail.status,
        searchState,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      }),
      messages: detail.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
      lastSearchRun: latestSearchPayload?.searchRun ?? null,
      lastSearchResults: latestSearchPayload?.results ?? [],
    };
  }

  async assertOwnership(userId: string, conversationId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);

    if (!conversation || conversation.userId !== userId) {
      this.logger.warnEvent(
        'conversation ownership check failed',
        {
          module: 'ConversationsService',
          action: 'conversation_ownership_rejected',
          userId,
          conversationId,
        },
        ConversationsService.name,
      );
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  touch(conversationId: string) {
    return this.conversationsRepository.touch(conversationId);
  }

  markSearchExecuted(conversationId: string, at?: Date) {
    return this.conversationsRepository.markSearchExecuted(conversationId, at);
  }

  private serializeConversationBase(input: {
    id: string;
    title: string;
    status: string;
    searchState: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: input.id,
      title: input.title,
      status: input.status,
      searchState: input.searchState,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
  }

  private serializeConversationListItem(input: {
    id: string;
    title: string;
    status: string;
    lastSearchAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: input.id,
      title: input.title,
      status: input.status,
      lastSearchAt: input.lastSearchAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
  }
}
