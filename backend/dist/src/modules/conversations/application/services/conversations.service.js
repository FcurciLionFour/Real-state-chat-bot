"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ConversationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const search_run_service_1 = require("../../../search/application/services/search-run.service");
const conversations_repository_1 = require("../../infrastructure/repositories/conversations.repository");
const search_state_service_1 = require("../../../search-state/application/services/search-state.service");
let ConversationsService = ConversationsService_1 = class ConversationsService {
    conversationsRepository;
    searchStateService;
    searchRunService;
    logger;
    requestContextService;
    constructor(conversationsRepository, searchStateService, searchRunService, logger, requestContextService) {
        this.conversationsRepository = conversationsRepository;
        this.searchStateService = searchStateService;
        this.searchRunService = searchRunService;
        this.logger = logger;
        this.requestContextService = requestContextService;
    }
    async create(userId, title) {
        const conversation = await this.conversationsRepository.create(userId, title?.trim() || 'Nueva busqueda');
        const searchState = await this.searchStateService.getOrCreateByConversationId(conversation.id);
        this.requestContextService?.set({ userId, conversationId: conversation.id });
        this.logger.logEvent('conversation created', {
            module: 'ConversationsService',
            action: 'conversation_created',
            userId,
            conversationId: conversation.id,
        }, ConversationsService_1.name);
        return this.serializeConversationBase({
            id: conversation.id,
            title: conversation.title,
            status: conversation.status,
            searchState,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
        });
    }
    async listByUserId(userId, page, limit) {
        const [items, total] = await Promise.all([
            this.conversationsRepository.findManyByUserId(userId, page, limit),
            this.conversationsRepository.countByUserId(userId),
        ]);
        this.requestContextService?.set({ userId });
        this.logger.logEvent('conversations listed', {
            module: 'ConversationsService',
            action: 'conversations_listed',
            userId,
            page,
            limit,
            total,
        }, ConversationsService_1.name);
        return {
            items: items.map((conversation) => this.serializeConversationListItem(conversation)),
            meta: {
                page,
                limit,
                total,
            },
        };
    }
    async getDetail(userId, conversationId) {
        const conversation = await this.assertOwnership(userId, conversationId);
        const detail = await this.conversationsRepository.findDetailById(conversation.id);
        if (!detail) {
            throw new common_1.NotFoundException('Conversation not found');
        }
        const latestSearchPayload = await this.searchRunService.getLatestResultsByConversationId(detail.id);
        const searchState = detail.searchState
            ? detail.searchState.filtersJson
            : await this.searchStateService.getOrCreateByConversationId(detail.id);
        this.requestContextService?.set({ userId, conversationId: detail.id });
        this.logger.logEvent('conversation detail retrieved', {
            module: 'ConversationsService',
            action: 'conversation_detail_retrieved',
            userId,
            conversationId: detail.id,
            messageCount: detail.messages.length,
        }, ConversationsService_1.name);
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
    async assertOwnership(userId, conversationId) {
        const conversation = await this.conversationsRepository.findById(conversationId);
        if (!conversation || conversation.userId !== userId) {
            this.logger.warnEvent('conversation ownership check failed', {
                module: 'ConversationsService',
                action: 'conversation_ownership_rejected',
                userId,
                conversationId,
            }, ConversationsService_1.name);
            throw new common_1.NotFoundException('Conversation not found');
        }
        return conversation;
    }
    touch(conversationId) {
        return this.conversationsRepository.touch(conversationId);
    }
    markSearchExecuted(conversationId, at) {
        return this.conversationsRepository.markSearchExecuted(conversationId, at);
    }
    serializeConversationBase(input) {
        return {
            id: input.id,
            title: input.title,
            status: input.status,
            searchState: input.searchState,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
        };
    }
    serializeConversationListItem(input) {
        return {
            id: input.id,
            title: input.title,
            status: input.status,
            lastSearchAt: input.lastSearchAt,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
        };
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = ConversationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [conversations_repository_1.ConversationsRepository,
        search_state_service_1.SearchStateService,
        search_run_service_1.SearchRunService,
        logger_service_1.LoggerService,
        request_context_service_1.RequestContextService])
], ConversationsService);
