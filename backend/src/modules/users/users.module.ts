import { Module } from '@nestjs/common';
import { UsersService } from './application/services/users.service';
import { UsersRepository } from './infrastructure/repositories/users.repository';

@Module({
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
