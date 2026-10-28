import { Module } from '@nestjs/common';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './api/controllers/admin.controller';
import { AdminOverviewService } from './application/services/admin-overview.service';

@Module({
  imports: [AuthModule, RedisModule],
  controllers: [AdminController],
  providers: [AdminOverviewService],
})
export class AdminModule {}
