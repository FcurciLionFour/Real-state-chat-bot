import { CurrencyCode, OperationType, PropertyType } from '@prisma/client';

export type SortPreference = 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST';

export type PropertyFeature =
  | 'BALCONY'
  | 'TERRACE'
  | 'PATIO'
  | 'GARAGE'
  | 'POOL'
  | 'BARBECUE'
  | 'GYM'
  | 'PROFESSIONAL_USE'
  | 'MORTGAGE_ELIGIBLE'
  | 'FURNISHED'
  | 'PETS_ALLOWED';

export type GeoConstraintKind = 'AREA' | 'PROXIMITY';

export type GeoConstraint = {
  kind: GeoConstraintKind;
  sourceText: string;
  label: string;
  province: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  confidence: number;
  provider: string;
};

export type SearchFilters = {
  operation: OperationType | null;
  propertyTypes: PropertyType[];
  locations: string[];
  geoConstraints?: GeoConstraint[];
  priceMin: number | null;
  priceMax: number | null;
  currency: CurrencyCode | null;
  rooms: number | null;
  roomsAnyOf?: number[];
  bedrooms: number | null;
  bathrooms: number | null;
  areaMin: number | null;
  areaMax: number | null;
  expensesMax: number | null;
  features: PropertyFeature[];
  sortPreference: SortPreference | null;
};
