import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/app.config';
import { validateEnv } from './config/env.schema';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SearchStateModule } from './modules/search-state/search-state.module';
import { AiModule } from './modules/ai/ai.module';
import { SearchModule } from './modules/search/search.module';
import { SourcesModule } from './modules/sources/sources.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { BlogModule } from './modules/blog/blog.module';
import { AdminModule } from './modules/admin/admin.module';
import { OwnerPropertiesModule } from './modules/owner-properties/owner-properties.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { OpenAiModule } from './infrastructure/openai/openai.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { SecurityModule } from './infrastructure/security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    OpenAiModule,
    ObservabilityModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    SearchStateModule,
    AiModule,
    SearchModule,
    SourcesModule,
    PropertiesModule,
    FavoritesModule,
    BlogModule,
    OwnerPropertiesModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
