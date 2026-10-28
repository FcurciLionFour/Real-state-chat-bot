import { Injectable } from '@nestjs/common';
import { DEFAULT_SEARCH_FILTERS } from '../../domain/constants/default-search-filters';
import { SearchFilters } from '../../domain/types/search-filters.type';
import { SearchStateRepository } from '../../infrastructure/repositories/search-state.repository';

@Injectable()
export class SearchStateService {
  constructor(private readonly searchStateRepository: SearchStateRepository) {}

  async getOrCreateByConversationId(conversationId: string): Promise<SearchFilters> {
    const searchState = await this.searchStateRepository.findByConversationId(conversationId);

    if (!searchState) {
      await this.searchStateRepository.create(conversationId, DEFAULT_SEARCH_FILTERS);
      return structuredClone(DEFAULT_SEARCH_FILTERS);
    }

    return this.toSearchFilters(searchState.filtersJson);
  }

  async updateByConversationId(conversationId: string, filters: SearchFilters) {
    return this.searchStateRepository.update(conversationId, filters);
  }

  private toSearchFilters(filtersJson: unknown): SearchFilters {
    const filters = {
      ...DEFAULT_SEARCH_FILTERS,
      ...(filtersJson as SearchFilters),
    };

    return {
      ...filters,
      roomsAnyOf: Array.isArray(filters.roomsAnyOf) ? filters.roomsAnyOf : [],
      geoConstraints: Array.isArray(filters.geoConstraints) ? filters.geoConstraints : [],
    };
  }
}
