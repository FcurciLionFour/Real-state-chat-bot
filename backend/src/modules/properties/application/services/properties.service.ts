import { Injectable } from '@nestjs/common';
import { CurrencyCode, OperationType, Prisma, PropertyType } from '@prisma/client';
import { PropertyFeature } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../../search/domain/types/search-result.type';
import { GeocodingService } from './geocoding.service';
import { PropertiesRepository } from '../../infrastructure/repositories/properties.repository';

type PersistableSearchResult = Omit<SearchResultItem, 'rank'>;

export type MockResultInput = {
  source: string;
  sourceUrl: string;
  title: string;
  operation: OperationType;
  propertyType: PropertyType;
  price: number;
  currency: CurrencyCode;
  expenses: number;
  city: string;
  neighborhood: string;
  locationText: string;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  areaTotal: number;
  areaCovered: number;
  features: PropertyFeature[];
  images: string[];
  scrapedAt: string;
  publishedAt: string;
};

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertiesRepository: PropertiesRepository,
    private readonly geocodingService: GeocodingService,
  ) {}

  findById(id: string) {
    return this.propertiesRepository.findById(id);
  }

  async persistSearchResult(result: PersistableSearchResult) {
    const geo = await this.geocodingService.geocode({
      locationText: result.locationText,
      neighborhood: result.neighborhood,
      city: result.city,
      province: result.province,
      country: result.country,
    });

    const normalizedPayload = {
      externalId: result.externalId ?? null,
      source: result.source,
      sourceUrl: result.sourceUrl,
      publisher: result.publisher ?? null,
      contactPhone: result.contactPhone ?? null,
      contactWhatsApp: result.contactWhatsApp ?? null,
      title: result.title,
      description: result.description ?? null,
      operation: result.operation,
      propertyType: result.propertyType,
      price: result.price,
      currency: result.currency,
      expenses: result.expenses,
      country: result.country ?? 'Argentina',
      province: result.province ?? 'CABA',
      city: result.city,
      neighborhood: result.neighborhood,
      locationText: result.locationText,
      geo: geo
        ? {
            latitude: geo.latitude,
            longitude: geo.longitude,
            precision: geo.precision,
            provider: geo.provider,
          }
        : null,
      rooms: result.rooms,
      bedrooms: result.bedrooms,
      bathrooms: result.bathrooms,
      areaTotal: result.areaTotal,
      areaCovered: result.areaCovered,
      features: result.features,
      images: result.images,
      scrapedAt: result.scrapedAt,
      publishedAt: result.publishedAt,
    } satisfies Prisma.JsonObject;

    return this.propertiesRepository.upsertBySourceUrl({
      externalId: result.externalId ?? null,
      source: result.source,
      sourceUrl: result.sourceUrl,
      publisher: result.publisher ?? null,
      contactPhone: result.contactPhone ?? null,
      contactWhatsApp: result.contactWhatsApp ?? null,
      title: result.title,
      description: result.description ?? null,
      country: result.country ?? 'Argentina',
      province: result.province ?? 'CABA',
      city: result.city,
      neighborhood: result.neighborhood,
      locationText: result.locationText,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      geoPrecision: geo?.precision ?? null,
      geocodingProvider: geo?.provider ?? null,
      geocodedAt: geo ? new Date() : null,
      operation: result.operation,
      propertyType: result.propertyType,
      priceAmount: result.price,
      priceCurrency: result.currency,
      expensesAmount: result.expenses,
      rooms: result.rooms,
      bedrooms: result.bedrooms,
      bathrooms: result.bathrooms,
      areaTotal: result.areaTotal,
      areaCovered: result.areaCovered,
      features: result.features,
      images: result.images,
      rawPayloadJson: normalizedPayload,
      normalizedPayloadJson: normalizedPayload,
      scrapedAt: new Date(result.scrapedAt),
      publishedAt: result.publishedAt ? new Date(result.publishedAt) : null,
    });
  }

  persistMockResult(result: MockResultInput) {
    return this.persistSearchResult(result);
  }
}
