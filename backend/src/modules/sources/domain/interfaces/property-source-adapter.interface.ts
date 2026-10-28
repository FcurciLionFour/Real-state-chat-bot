import { CurrencyCode, OperationType, PropertyType } from '@prisma/client';
import { PropertyFeature } from '../../../search-state/domain/types/search-filters.type';

export type ExtractedPropertyListing = {
  externalId: string | null;
  source: string;
  sourceUrl: string;
  publisher?: string | null;
  contactPhone?: string | null;
  contactWhatsApp?: string | null;
  title: string;
  description: string | null;
  operation: OperationType | null;
  propertyType: PropertyType | null;
  price: number | null;
  currency: CurrencyCode | null;
  expenses: number | null;
  country: string | null;
  province: string | null;
  city: string | null;
  neighborhood: string | null;
  locationText: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  features: PropertyFeature[];
  images: string[];
  publishedAt: string | null;
  scrapedAt: string;
};

export interface PropertySourceAdapter {
  sourceName: string;
  canHandle(url: string): boolean;
  isDetailUrl?(url: string): boolean;
  extract(url: string, html: string): Promise<ExtractedPropertyListing | null>;
}
