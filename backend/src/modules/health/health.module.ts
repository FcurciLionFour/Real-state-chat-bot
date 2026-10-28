import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { HealthController } from './api/controllers/health.controller';
import { HealthService } from './application/services/health.service';

@Module({
  imports: [SearchModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
