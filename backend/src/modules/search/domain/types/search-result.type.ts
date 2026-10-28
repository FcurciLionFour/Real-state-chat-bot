import { CurrencyCode, OperationType, PropertyType } from '@prisma/client';
import { PropertyFeature } from '../../../search-state/domain/types/search-filters.type';

export type SearchResultItem = {
  externalId?: string | null;
  source: string;
  sourceUrl: string;
  publisher?: string | null;
  contactPhone?: string | null;
  contactWhatsApp?: string | null;
  title: string;
  description?: string | null;
  operation: OperationType | null;
  propertyType: PropertyType | null;
  price: number | null;
  currency: CurrencyCode | null;
  expenses: number | null;
  country?: string | null;
  province?: string | null;
  city: string | null;
  neighborhood: string | null;
  locationText: string | null;
  geo?: {
    latitude: number;
    longitude: number;
    precision: 'exact' | 'street' | 'neighborhood' | 'unknown';
    provider: string;
  } | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  features: PropertyFeature[];
  images: string[];
  scrapedAt: string;
  publishedAt: string | null;
  rank: {
    position: number;
    score: number;
    reasons: string[];
    reasonDetails?: Record<string, unknown>;
  };
};
