import { Module } from '@nestjs/common';
import { MessagesService } from './application/services/messages.service';
import { MessagesRepository } from './infrastructure/repositories/messages.repository';

@Module({
  providers: [MessagesService, MessagesRepository],
  exports: [MessagesService],
})
export class MessagesModule {}
