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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const rate_limit_decorator_1 = require("../../../../infrastructure/security/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../../../../infrastructure/security/guards/rate-limit.guard");
const current_user_decorator_1 = require("../../../auth/presentation/decorators/current-user.decorator");
const access_token_guard_1 = require("../../../auth/presentation/guards/access-token.guard");
const chat_application_service_1 = require("../../application/services/chat-application.service");
const conversations_service_1 = require("../../application/services/conversations.service");
const create_conversation_dto_1 = require("../dto/create-conversation.dto");
const list_conversations_query_dto_1 = require("../dto/list-conversations-query.dto");
const patch_search_state_dto_1 = require("../dto/patch-search-state.dto");
const send_message_dto_1 = require("../dto/send-message.dto");
let ConversationsController = class ConversationsController {
    conversationsService;
    chatApplicationService;
    constructor(conversationsService, chatApplicationService) {
        this.conversationsService = conversationsService;
        this.chatApplicationService = chatApplicationService;
    }
    createConversation(body, user) {
        return this.conversationsService.create(user.id, body.title);
    }
    listConversations(query, user) {
        return this.conversationsService.listByUserId(user.id, query.page, query.limit);
    }
    getConversation(id, user) {
        return this.conversationsService.getDetail(user.id, id);
    }
    sendMessage(id, body, user) {
        return this.chatApplicationService.sendMessage(user.id, id, body.message);
    }
    patchSearchState(id, body, user) {
        return this.chatApplicationService.patchSearchState(user.id, id, body);
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_conversation_dto_1.CreateConversationDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_conversations_query_dto_1.ListConversationsQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'chat-send-message',
        limit: 15,
        windowSeconds: 300,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_message_dto_1.SendMessageDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Patch)(':id/search-state'),
    (0, common_1.UseGuards)(rate_limit_guard_1.RateLimitGuard),
    (0, rate_limit_decorator_1.RateLimit)({
        namespace: 'chat-patch-search-state',
        limit: 30,
        windowSeconds: 300,
        keyStrategy: 'user_or_ip',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patch_search_state_dto_1.PatchSearchStateDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "patchSearchState", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, common_1.Controller)('conversations'),
    (0, common_1.UseGuards)(access_token_guard_1.AccessTokenGuard),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService,
        chat_application_service_1.ChatApplicationService])
], ConversationsController);
