import { Module } from '@nestjs/common';
import { GeocodingService } from './application/services/geocoding.service';
import { PropertiesService } from './application/services/properties.service';
import { PropertiesRepository } from './infrastructure/repositories/properties.repository';

@Module({
  providers: [GeocodingService, PropertiesService, PropertiesRepository],
  exports: [GeocodingService, PropertiesService],
})
export class PropertiesModule {}
