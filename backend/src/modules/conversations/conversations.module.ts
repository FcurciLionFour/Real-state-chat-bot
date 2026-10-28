import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { PropertiesModule } from '../properties/properties.module';
import { SearchModule } from '../search/search.module';
import { SearchStateModule } from '../search-state/search-state.module';
import { UsersModule } from '../users/users.module';
import { ChatApplicationService } from './application/services/chat-application.service';
import { ConversationsService } from './application/services/conversations.service';
import { ConversationsController } from './api/controllers/conversations.controller';
import { ConversationsRepository } from './infrastructure/repositories/conversations.repository';

@Module({
  imports: [AiModule, AuthModule, UsersModule, MessagesModule, SearchStateModule, SearchModule, PropertiesModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ChatApplicationService, ConversationsRepository],
  exports: [ConversationsService],
})
export class ConversationsModule {}
