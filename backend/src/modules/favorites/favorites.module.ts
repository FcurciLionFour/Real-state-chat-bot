import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';
import { UsersModule } from '../users/users.module';
import { FavoritesController } from './api/controllers/favorites.controller';
import { FavoritesService } from './application/services/favorites.service';
import { FavoritesRepository } from './infrastructure/repositories/favorites.repository';

@Module({
  imports: [AuthModule, PropertiesModule, UsersModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
})
export class FavoritesModule {}
