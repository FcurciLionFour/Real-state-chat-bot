import { Injectable } from '@nestjs/common';
import { DEFAULT_SEARCH_FILTERS } from '../../domain/constants/default-search-filters';
import { SearchFilters } from '../../domain/types/search-filters.type';
import { SearchDecision, SearchFilterKey } from '../../../ai/domain/types/search-decision.type';

type SearchStateMergeResult = {
  searchState: SearchFilters;
  assistantMessage: string;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  didSearch: boolean;
};

@Injectable()
export class SearchStateMergeService {
  applySearchDecision(currentState: SearchFilters, decision: SearchDecision): SearchStateMergeResult {
    const nextState: SearchFilters = structuredClone(currentState);

    for (const key of decision.filtersToUnset) {
      this.unsetField(nextState, key);
    }

    for (const [key, value] of Object.entries(decision.filterPatch) as Array<[SearchFilterKey, SearchFilters[SearchFilterKey]]>) {
      this.setField(nextState, key, value);
    }

    const didSearch =
      decision.requestedAction === 'SEARCH' &&
      decision.shouldSearch &&
      !decision.requiresClarification;

    return {
      searchState: nextState,
      assistantMessage: decision.userFacingMessage.trim(),
      requiresClarification: decision.requiresClarification,
      clarificationQuestion: decision.clarificationQuestion,
      didSearch,
    };
  }

  private unsetField(searchState: SearchFilters, key: SearchFilterKey) {
    searchState[key] = structuredClone(DEFAULT_SEARCH_FILTERS[key]) as never;
  }

  private setField(searchState: SearchFilters, key: SearchFilterKey, value: SearchFilters[SearchFilterKey]) {
    searchState[key] = structuredClone(value) as never;

    if (key === 'rooms' && value !== null) {
      searchState.roomsAnyOf = [];
    }

    if (key === 'roomsAnyOf' && Array.isArray(value) && value.length > 0) {
      searchState.rooms = null;
    }
  }
}
