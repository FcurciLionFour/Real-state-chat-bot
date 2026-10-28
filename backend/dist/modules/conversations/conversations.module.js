"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsModule = void 0;
const common_1 = require("@nestjs/common");
const ai_module_1 = require("../ai/ai.module");
const auth_module_1 = require("../auth/auth.module");
const messages_module_1 = require("../messages/messages.module");
const properties_module_1 = require("../properties/properties.module");
const search_module_1 = require("../search/search.module");
const search_state_module_1 = require("../search-state/search-state.module");
const users_module_1 = require("../users/users.module");
const chat_application_service_1 = require("./application/services/chat-application.service");
const conversations_service_1 = require("./application/services/conversations.service");
const conversations_controller_1 = require("./api/controllers/conversations.controller");
const conversations_repository_1 = require("./infrastructure/repositories/conversations.repository");
let ConversationsModule = class ConversationsModule {
};
exports.ConversationsModule = ConversationsModule;
exports.ConversationsModule = ConversationsModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, auth_module_1.AuthModule, users_module_1.UsersModule, messages_module_1.MessagesModule, search_state_module_1.SearchStateModule, search_module_1.SearchModule, properties_module_1.PropertiesModule],
        controllers: [conversations_controller_1.ConversationsController],
        providers: [conversations_service_1.ConversationsService, chat_application_service_1.ChatApplicationService, conversations_repository_1.ConversationsRepository],
        exports: [conversations_service_1.ConversationsService],
    })
], ConversationsModule);
