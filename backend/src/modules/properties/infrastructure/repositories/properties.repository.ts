import { Injectable } from '@nestjs/common';
import { CurrencyCode, ListingStatus, OperationType, Prisma, PropertyType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

type PersistPropertyInput = {
  externalId?: string | null;
  source: string;
  sourceUrl: string;
  publisher?: string | null;
  contactPhone?: string | null;
  contactWhatsApp?: string | null;
  title: string;
  description?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoPrecision?: string | null;
  geocodingProvider?: string | null;
  geocodedAt?: Date | null;
  operation?: OperationType | null;
  propertyType?: PropertyType | null;
  priceAmount?: number | null;
  priceCurrency?: CurrencyCode | null;
  expensesAmount?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaTotal?: number | null;
  areaCovered?: number | null;
  features: string[];
  images: string[];
  rawPayloadJson: Prisma.InputJsonValue;
  normalizedPayloadJson: Prisma.InputJsonValue;
  scrapedAt: Date;
  publishedAt?: Date | null;
};

@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.propertyCache.findUnique({
      where: { id },
    });
  }

  async upsertBySourceUrl(input: PersistPropertyInput) {
    const canonicalHash = this.buildCanonicalHash(input);

    return this.prisma.propertyCache.upsert({
      where: {
        sourceUrl: input.sourceUrl,
      },
      create: {
        source: input.source,
        externalId: input.externalId ?? null,
        sourceUrl: input.sourceUrl,
        canonicalHash,
        rawPayloadJson: input.rawPayloadJson,
        normalizedPayloadJson: input.normalizedPayloadJson,
        title: input.title,
        description: input.description ?? null,
        publisher: input.publisher ?? null,
        contactPhone: input.contactPhone ?? null,
        contactWhatsApp: input.contactWhatsApp ?? null,
        country: input.country ?? 'Argentina',
        province: input.province ?? 'CABA',
        city: input.city ?? 'CABA',
        neighborhood: input.neighborhood ?? null,
        locationText: input.locationText ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        geoPrecision: input.geoPrecision ?? null,
        geocodingProvider: input.geocodingProvider ?? null,
        geocodedAt: input.geocodedAt ?? null,
        operation: input.operation ?? null,
        propertyType: input.propertyType ?? null,
        priceAmount: input.priceAmount ?? null,
        priceCurrency: input.priceCurrency ?? null,
        expensesAmount: input.expensesAmount ?? null,
        rooms: input.rooms ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        areaTotal: input.areaTotal ?? null,
        areaCovered: input.areaCovered ?? null,
        featuresJson: input.features,
        imagesJson: input.images,
        listingStatus: ListingStatus.ACTIVE,
        scrapedAt: input.scrapedAt,
        publishedAt: input.publishedAt ?? null,
      },
      update: {
        externalId: input.externalId ?? null,
        canonicalHash,
        rawPayloadJson: input.rawPayloadJson,
        normalizedPayloadJson: input.normalizedPayloadJson,
        title: input.title,
        description: input.description ?? null,
        publisher: input.publisher ?? null,
        contactPhone: input.contactPhone ?? null,
        contactWhatsApp: input.contactWhatsApp ?? null,
        country: input.country ?? 'Argentina',
        province: input.province ?? 'CABA',
        city: input.city ?? 'CABA',
        neighborhood: input.neighborhood ?? null,
        locationText: input.locationText ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        geoPrecision: input.geoPrecision ?? null,
        geocodingProvider: input.geocodingProvider ?? null,
        geocodedAt: input.geocodedAt ?? null,
        operation: input.operation ?? null,
        propertyType: input.propertyType ?? null,
        priceAmount: input.priceAmount ?? null,
        priceCurrency: input.priceCurrency ?? null,
        expensesAmount: input.expensesAmount ?? null,
        rooms: input.rooms ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        areaTotal: input.areaTotal ?? null,
        areaCovered: input.areaCovered ?? null,
        featuresJson: input.features,
        imagesJson: input.images,
        listingStatus: ListingStatus.ACTIVE,
        scrapedAt: input.scrapedAt,
        publishedAt: input.publishedAt ?? null,
      },
    });
  }

  private buildCanonicalHash(input: PersistPropertyInput) {
    const source = input.source.toLowerCase();
    const title = input.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const neighborhood = (input.neighborhood ?? '').trim().toLowerCase();
    const propertyType = input.propertyType ?? 'UNKNOWN';
    const price = input.priceAmount ?? 0;

    return `${source}::${propertyType}::${neighborhood}::${price}::${title}`;
  }
}
