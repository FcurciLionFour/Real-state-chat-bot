import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';

export const SEARCH_INTENTS = [
  'NEW_SEARCH',
  'MODIFY_SEARCH',
  'CLARIFY',
  'SHOW_MORE',
  'COMPARE',
  'FAVORITE',
  'SMALLTALK',
] as const;

export const REQUESTED_ACTIONS = ['SEARCH', 'COMPARE', 'FAVORITE', 'NONE'] as const;

export const SEARCH_FILTER_KEYS = [
  'operation',
  'propertyTypes',
  'locations',
  'geoConstraints',
  'priceMin',
  'priceMax',
  'currency',
  'rooms',
  'roomsAnyOf',
  'bedrooms',
  'bathrooms',
  'areaMin',
  'areaMax',
  'expensesMax',
  'features',
  'sortPreference',
] as const;

export type SearchIntent = (typeof SEARCH_INTENTS)[number];
export type RequestedAction = (typeof REQUESTED_ACTIONS)[number];
export type SearchFilterKey = (typeof SEARCH_FILTER_KEYS)[number];

export type SearchDecision = {
  intent: SearchIntent;
  shouldSearch: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  userFacingMessage: string;
  filterPatch: Partial<SearchFilters>;
  filtersToUnset: SearchFilterKey[];
  requestedAction: RequestedAction;
};

export type SearchDecisionInput = {
  userMessage: string;
  searchState: SearchFilters;
};
