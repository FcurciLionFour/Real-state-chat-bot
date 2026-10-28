import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RateLimit } from '../../../../infrastructure/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../../infrastructure/security/guards/rate-limit.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../../auth/presentation/guards/access-token.guard';
import { ChatApplicationService } from '../../application/services/chat-application.service';
import { ConversationsService } from '../../application/services/conversations.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';
import { PatchSearchStateDto } from '../dto/patch-search-state.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { AuthenticatedUser } from '../../../auth/domain/types/authenticated-user.type';

@Controller('conversations')
@UseGuards(AccessTokenGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly chatApplicationService: ChatApplicationService,
  ) {}

  @Post()
  createConversation(@Body() body: CreateConversationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.create(user.id, body.title);
  }

  @Get()
  listConversations(@Query() query: ListConversationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.listByUserId(user.id, query.page, query.limit);
  }

  @Get(':id')
  getConversation(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.getDetail(user.id, id);
  }

  @Post(':id/messages')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'chat-send-message',
    limit: 15,
    windowSeconds: 300,
    keyStrategy: 'user_or_ip',
  })
  sendMessage(@Param('id') id: string, @Body() body: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.chatApplicationService.sendMessage(user.id, id, body.message);
  }

  @Patch(':id/search-state')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'chat-patch-search-state',
    limit: 30,
    windowSeconds: 300,
    keyStrategy: 'user_or_ip',
  })
  patchSearchState(
    @Param('id') id: string,
    @Body() body: PatchSearchStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatApplicationService.patchSearchState(user.id, id, body);
  }
}
