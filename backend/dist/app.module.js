"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_config_1 = require("./config/app.config");
const env_schema_1 = require("./config/env.schema");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const messages_module_1 = require("./modules/messages/messages.module");
const search_state_module_1 = require("./modules/search-state/search-state.module");
const ai_module_1 = require("./modules/ai/ai.module");
const search_module_1 = require("./modules/search/search.module");
const sources_module_1 = require("./modules/sources/sources.module");
const properties_module_1 = require("./modules/properties/properties.module");
const favorites_module_1 = require("./modules/favorites/favorites.module");
const blog_module_1 = require("./modules/blog/blog.module");
const admin_module_1 = require("./modules/admin/admin.module");
const health_module_1 = require("./modules/health/health.module");
const prisma_module_1 = require("./infrastructure/prisma/prisma.module");
const redis_module_1 = require("./infrastructure/redis/redis.module");
const openai_module_1 = require("./infrastructure/openai/openai.module");
const observability_module_1 = require("./infrastructure/observability/observability.module");
const security_module_1 = require("./infrastructure/security/security.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                load: [app_config_1.configuration],
                validate: env_schema_1.validateEnv,
            }),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            openai_module_1.OpenAiModule,
            observability_module_1.ObservabilityModule,
            security_module_1.SecurityModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            search_state_module_1.SearchStateModule,
            ai_module_1.AiModule,
            search_module_1.SearchModule,
            sources_module_1.SourcesModule,
            properties_module_1.PropertiesModule,
            favorites_module_1.FavoritesModule,
            blog_module_1.BlogModule,
            admin_module_1.AdminModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
