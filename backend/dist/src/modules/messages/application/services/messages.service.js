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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const messages_repository_1 = require("../../infrastructure/repositories/messages.repository");
let MessagesService = class MessagesService {
    messagesRepository;
    constructor(messagesRepository) {
        this.messagesRepository = messagesRepository;
    }
    createUserMessage(conversationId, content) {
        return this.messagesRepository.create(conversationId, client_1.MessageRole.USER, content);
    }
    createAssistantMessage(conversationId, content, structuredPayloadJson) {
        return this.messagesRepository.create(conversationId, client_1.MessageRole.ASSISTANT, content, structuredPayloadJson);
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [messages_repository_1.MessagesRepository])
], MessagesService);
