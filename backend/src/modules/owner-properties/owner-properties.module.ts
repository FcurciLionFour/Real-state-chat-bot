import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminOwnerPropertiesController,
  OwnerPropertiesController,
} from './owner-properties.controller';
import { OwnerPropertiesService } from './owner-properties.service';

@Module({
  imports: [AuthModule],
  controllers: [OwnerPropertiesController, AdminOwnerPropertiesController],
  providers: [OwnerPropertiesService],
  exports: [OwnerPropertiesService],
})
export class OwnerPropertiesModule {}
