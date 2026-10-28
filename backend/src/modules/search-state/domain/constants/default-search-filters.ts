import { SearchFilters } from '../types/search-filters.type';

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  operation: null,
  propertyTypes: [],
  locations: [],
  geoConstraints: [],
  priceMin: null,
  priceMax: null,
  currency: null,
  rooms: null,
  roomsAnyOf: [],
  bedrooms: null,
  bathrooms: null,
  areaMin: null,
  areaMax: null,
  expensesMax: null,
  features: [],
  sortPreference: null,
};
