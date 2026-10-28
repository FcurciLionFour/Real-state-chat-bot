import { Injectable } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { PropertyFeature } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';

type SearchCandidate = Omit<SearchResultItem, 'rank'>;

@Injectable()
export class OwnerSubmittedSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(searchState: SearchFilters): Promise<SearchCandidate[]> {
    const where: Prisma.PropertyCacheWhereInput = {
      source: 'OWNER_SUBMITTED',
      listingStatus: ListingStatus.ACTIVE,
      ...(searchState.operation ? { operation: searchState.operation } : {}),
      ...(searchState.propertyTypes.length > 0 ? { propertyType: { in: searchState.propertyTypes } } : {}),
      ...(searchState.currency ? { priceCurrency: searchState.currency } : {}),
      ...(searchState.priceMin !== null || searchState.priceMax !== null
        ? {
            priceAmount: {
              ...(searchState.priceMin !== null ? { gte: searchState.priceMin } : {}),
              ...(searchState.priceMax !== null ? { lte: searchState.priceMax } : {}),
            },
          }
        : {}),
    };

    const items = await this.prisma.propertyCache.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 24,
    });

    return items.map((property) => ({
      externalId: property.externalId,
      source: property.source,
      sourceUrl: property.sourceUrl,
      publisher: property.publisher,
      contactPhone: property.contactPhone,
      contactWhatsApp: property.contactWhatsApp,
      title: property.title,
      description: property.description,
      operation: property.operation,
      propertyType: property.propertyType,
      price: property.priceAmount === null ? null : Number(property.priceAmount),
      currency: property.priceCurrency,
      expenses: property.expensesAmount === null ? null : Number(property.expensesAmount),
      country: property.country,
      province: property.province,
      city: property.city,
      neighborhood: property.neighborhood,
      locationText: property.locationText,
      geo:
        property.latitude !== null && property.longitude !== null
          ? {
              latitude: Number(property.latitude),
              longitude: Number(property.longitude),
              precision: this.readGeoPrecision(property.geoPrecision),
              provider: property.geocodingProvider ?? 'unknown',
            }
          : null,
      rooms: property.rooms === null ? null : Number(property.rooms),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaTotal: property.areaTotal === null ? null : Number(property.areaTotal),
      areaCovered: property.areaCovered === null ? null : Number(property.areaCovered),
      features: this.readFeatures(property.featuresJson),
      images: Array.isArray(property.imagesJson)
        ? property.imagesJson.filter((item): item is string => typeof item === 'string')
        : [],
      scrapedAt: property.scrapedAt.toISOString(),
      publishedAt: property.publishedAt?.toISOString() ?? null,
    }));
  }

  private readFeatures(value: Prisma.JsonValue): PropertyFeature[] {
    const allowed = new Set<PropertyFeature>([
      'BALCONY',
      'TERRACE',
      'PATIO',
      'GARAGE',
      'POOL',
      'BARBECUE',
      'GYM',
      'PROFESSIONAL_USE',
      'MORTGAGE_ELIGIBLE',
      'FURNISHED',
      'PETS_ALLOWED',
    ]);

    return Array.isArray(value)
      ? value.filter((item): item is PropertyFeature => typeof item === 'string' && allowed.has(item as PropertyFeature))
      : [];
  }

  private readGeoPrecision(value: string | null) {
    return value === 'exact' || value === 'street' || value === 'neighborhood' || value === 'unknown'
      ? value
      : 'unknown';
  }
}
