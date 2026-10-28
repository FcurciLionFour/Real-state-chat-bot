import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { HtmlFetchService } from '../../../sources/application/services/html-fetch.service';
import { PropertySourceRegistryService } from '../../../sources/application/services/property-source-registry.service';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';
import { MockSearchService } from './mock-search.service';
import { SearchDiscoveryService } from './search-discovery.service';
import { SearchDedupeService } from './search-dedupe.service';
import { PythonScraperSearchService } from './python-scraper-search.service';
import { SearchResultsCacheService } from './search-results-cache.service';
import { SearchQueryBuilderService } from './search-query-builder.service';
import { SearchRankingService } from './search-ranking.service';
import { OwnerSubmittedSearchService } from './owner-submitted-search.service';
import { SearchGeoService } from './search-geo.service';

type SearchExecutionResult = {
  queryText: string;
  results: SearchResultItem[];
  sourcesUsed: string[];
};

type SearchCandidate = Omit<SearchResultItem, 'rank'>;

@Injectable()
export class SearchExecutionService {
  constructor(
    private readonly searchQueryBuilderService: SearchQueryBuilderService,
    private readonly searchDiscoveryService: SearchDiscoveryService,
    private readonly htmlFetchService: HtmlFetchService,
    private readonly propertySourceRegistryService: PropertySourceRegistryService,
    private readonly searchDedupeService: SearchDedupeService,
    private readonly searchRankingService: SearchRankingService,
    private readonly searchResultsCacheService: SearchResultsCacheService,
    private readonly mockSearchService: MockSearchService,
    private readonly logger: LoggerService,
    @Optional() private readonly pythonScraperSearchService?: PythonScraperSearchService,
    @Optional() private readonly ownerSubmittedSearchService?: OwnerSubmittedSearchService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly searchGeoService?: SearchGeoService,
  ) {}

  async execute(searchState: SearchFilters): Promise<SearchExecutionResult> {
    const startedAt = Date.now();
    const effectiveSearchState = await this.enrichSearchState(searchState);
    const queryText = this.searchQueryBuilderService.buildPrimaryQuery(effectiveSearchState);
    this.logger.logEvent(
      'search execution started',
      {
        module: 'SearchExecutionService',
        action: 'search_execution_started',
        queryText,
        locations: effectiveSearchState.locations,
        geoConstraints: (effectiveSearchState.geoConstraints ?? []).map((constraint) => ({
          kind: constraint.kind,
          label: constraint.label,
          province: constraint.province,
          city: constraint.city,
          neighborhood: constraint.neighborhood,
          radiusMeters: constraint.radiusMeters,
          provider: constraint.provider,
        })),
        propertyTypes: effectiveSearchState.propertyTypes,
      },
      SearchExecutionService.name,
    );

    const cachedResult = await this.searchResultsCacheService.get(effectiveSearchState);
    if (cachedResult) {
      if (!this.isMockFallbackEnabled() && cachedResult.sourcesUsed.includes('mock-source')) {
        this.logger.warnEvent(
          'cached mock search result ignored because mock fallback is disabled',
          {
            module: 'SearchExecutionService',
            action: 'search_execution_mock_cache_ignored',
            queryText: cachedResult.queryText,
            resultCount: cachedResult.results.length,
          },
          SearchExecutionService.name,
        );
      } else {
        this.logger.logEvent(
          'search execution served from cache',
          {
            module: 'SearchExecutionService',
            action: 'search_execution_cache_hit',
            queryText: cachedResult.queryText,
            resultCount: cachedResult.results.length,
            durationMs: Date.now() - startedAt,
          },
          SearchExecutionService.name,
        );
        return cachedResult;
      }
    }

    const ownerSubmittedCandidates = await this.findOwnerSubmittedCandidates(effectiveSearchState, queryText);

    const pythonScraperResult = await this.tryPythonScraper(effectiveSearchState, queryText, startedAt, ownerSubmittedCandidates);
    if (pythonScraperResult) {
      await this.searchResultsCacheService.set(effectiveSearchState, pythonScraperResult);
      return pythonScraperResult;
    }

    const discoveryQueries = this.searchQueryBuilderService.buildDiscoveryQueries(effectiveSearchState);
    const discoveryStartedAt = Date.now();
    const discoveryResult = await this.searchDiscoveryService.discover(discoveryQueries);
    const discoveryDurationMs = Date.now() - discoveryStartedAt;
    const discoveryProviderLabel = this.formatDiscoveryProvider(discoveryResult.provider);

    if (!discoveryResult.enabled) {
      return this.buildMockFallback(
        effectiveSearchState,
        queryText,
        ownerSubmittedCandidates,
        `${discoveryProviderLabel} discovery is not configured yet.`,
      );
    }

    if (discoveryResult.candidateUrls.length === 0) {
      return this.buildMockFallback(
        effectiveSearchState,
        queryText,
        ownerSubmittedCandidates,
        `${discoveryProviderLabel} discovery did not return candidate URLs on the allowlist.`,
      );
    }

    const supportedUrls = this.propertySourceRegistryService.filterSupportedUrls(discoveryResult.candidateUrls);
    this.logger.logEvent(
      'search discovery stage completed',
      {
        module: 'SearchExecutionService',
        action: 'search_discovery_completed',
        queryText,
        discoveryProvider: discoveryResult.provider,
        attemptedQueriesCount: discoveryResult.attemptedQueries.length,
        candidateUrlCount: discoveryResult.candidateUrls.length,
        supportedUrlCount: supportedUrls.length,
        durationMs: discoveryDurationMs,
      },
      SearchExecutionService.name,
    );

    if (supportedUrls.length === 0) {
      return this.buildMockFallback(
        effectiveSearchState,
        queryText,
        ownerSubmittedCandidates,
        'Candidate URLs were discovered, but there are no source adapters registered yet.',
      );
    }

    const extractedCandidates: SearchCandidate[] = [];
    const extractionStartedAt = Date.now();

    for (const url of supportedUrls) {
      const adapter = this.propertySourceRegistryService.findAdapterForUrl(url);

      if (!adapter) {
        continue;
      }

      const html = await this.htmlFetchService.fetch(url);
      if (!html) {
        this.logger.warnEvent(
          'search candidate discarded because html fetch returned empty content',
          {
            module: 'SearchExecutionService',
            action: 'search_candidate_discarded',
            url,
            source: adapter.sourceName,
            reason: 'fetch_failed',
          },
          SearchExecutionService.name,
        );
        continue;
      }

      const listing = await adapter.extract(url, html);
      if (!listing) {
        this.logger.warnEvent(
          'search candidate discarded because adapter could not extract a valid listing',
          {
            module: 'SearchExecutionService',
            action: 'search_candidate_discarded',
            url,
            source: adapter.sourceName,
            reason: 'normalization_failed',
          },
          SearchExecutionService.name,
        );
        continue;
      }

      if (this.shouldDiscardAggregateListing(url, listing, adapter)) {
        this.logger.warnEvent(
          'search candidate discarded because it looks like an aggregate listing page instead of a property detail page',
          {
            module: 'SearchExecutionService',
            action: 'search_candidate_discarded',
            url,
            source: adapter.sourceName,
            reason: 'aggregate_listing_page',
          },
          SearchExecutionService.name,
        );
        continue;
      }

      extractedCandidates.push(listing);
    }

    if (extractedCandidates.length === 0) {
      return this.buildMockFallback(
        effectiveSearchState,
        queryText,
        ownerSubmittedCandidates,
        'The first real adapter could not extract usable listings. Falling back to mock search.',
      );
    }

    const extractionDurationMs = Date.now() - extractionStartedAt;
    const dedupeStartedAt = Date.now();
    const dedupedResults = this.searchDedupeService.dedupe([...ownerSubmittedCandidates, ...extractedCandidates]);
    const geoEnrichedResults = await this.enrichCandidates(dedupedResults);
    const dedupeDurationMs = Date.now() - dedupeStartedAt;
    const rankingStartedAt = Date.now();
    const rankedResults = this.searchRankingService.rank(effectiveSearchState, geoEnrichedResults);
    const rankingDurationMs = Date.now() - rankingStartedAt;

    if (rankedResults.length === 0) {
      this.logger.warn(
        'Real listings were extracted, but all of them were filtered out by essential ranking rules.',
        SearchExecutionService.name,
      );
    }

    const executionResult = {
      queryText,
      results: rankedResults,
      sourcesUsed: this.buildSourcesUsed(rankedResults.length > 0 ? rankedResults : extractedCandidates),
    };

    await this.searchResultsCacheService.set(effectiveSearchState, executionResult);
    this.logger.logEvent(
      'search execution completed',
      {
        module: 'SearchExecutionService',
        action: 'search_execution_completed',
        queryText,
        extractedCount: extractedCandidates.length,
        dedupedCount: dedupedResults.length,
        duplicateCount: Math.max(0, extractedCandidates.length - dedupedResults.length),
        rankedCount: rankedResults.length,
        sourcesUsed: executionResult.sourcesUsed,
        extractionDurationMs,
        dedupeDurationMs,
        rankingDurationMs,
        durationMs: Date.now() - startedAt,
      },
      SearchExecutionService.name,
    );

    return executionResult;
  }

  private buildMockFallback(searchState: SearchFilters, queryText: string, ownerSubmittedCandidates: SearchCandidate[]): SearchExecutionResult;
  private buildMockFallback(searchState: SearchFilters, queryText: string, ownerSubmittedCandidates: SearchCandidate[], reason: string): SearchExecutionResult;
  private buildMockFallback(
    searchState: SearchFilters,
    queryText: string,
    ownerSubmittedCandidates: SearchCandidate[],
    reason?: string,
  ): SearchExecutionResult {
    if (reason) {
      this.logger.warn(reason, SearchExecutionService.name);
    }

    if (!this.isMockFallbackEnabled()) {
      const ownerSubmittedResults = this.searchRankingService.rank(searchState, ownerSubmittedCandidates);
      this.logger.warnEvent(
        'mock fallback disabled; returning only real owner-submitted candidates',
        {
          module: 'SearchExecutionService',
          action: 'search_execution_mock_fallback_disabled',
          queryText,
          reason: reason ?? 'fallback_without_reason',
          resultCount: ownerSubmittedResults.length,
          sourcesUsed: this.buildSourcesUsed(ownerSubmittedResults),
        },
        SearchExecutionService.name,
      );

      return {
        queryText,
        results: ownerSubmittedResults,
        sourcesUsed: this.buildSourcesUsed(ownerSubmittedResults),
      };
    }

    const fallbackCandidates = this.mockSearchService.search(searchState).map((result) => {
      const { rank: _rank, ...candidate } = result;
      return candidate;
    });
    const fallbackResults = this.searchRankingService.rank(searchState, [
      ...ownerSubmittedCandidates,
      ...fallbackCandidates,
    ]);
    this.logger.logEvent(
      'search execution returned fallback results',
      {
        module: 'SearchExecutionService',
        action: 'search_execution_fallback',
        queryText,
        reason: reason ?? 'fallback_without_reason',
        resultCount: fallbackResults.length,
        sourcesUsed: this.buildSourcesUsed(fallbackResults),
      },
      SearchExecutionService.name,
    );

    return {
      queryText,
      results: fallbackResults,
      sourcesUsed: this.buildSourcesUsed(fallbackResults),
    };
  }

  private buildSourcesUsed(results: Array<{ source: string }>) {
    return Array.from(new Set(results.map((result) => result.source)));
  }

  private enrichSearchState(searchState: SearchFilters) {
    return this.searchGeoService?.enrichSearchState(searchState) ?? Promise.resolve(searchState);
  }

  private enrichCandidates(candidates: SearchCandidate[]) {
    return this.searchGeoService?.enrichCandidates(candidates) ?? Promise.resolve(candidates);
  }

  private async findOwnerSubmittedCandidates(searchState: SearchFilters, queryText: string) {
    if (!this.ownerSubmittedSearchService) {
      return [];
    }

    try {
      return await this.ownerSubmittedSearchService.findCandidates(searchState);
    } catch (error) {
      this.logger.warnEvent(
        'owner submitted search failed; continuing with external sources',
        {
          module: 'SearchExecutionService',
          action: 'search_execution_owner_submitted_failed',
          queryText,
          error: error instanceof Error ? error.message : 'owner_submitted_unknown_error',
        },
        SearchExecutionService.name,
      );
      return [];
    }
  }

  private async tryPythonScraper(
    searchState: SearchFilters,
    queryText: string,
    startedAt: number,
    ownerSubmittedCandidates: SearchCandidate[],
  ) {
    if (!this.pythonScraperSearchService?.isEnabled()) {
      return null;
    }

    try {
      const extractionStartedAt = Date.now();
      const pythonResult = await this.pythonScraperSearchService.search(searchState);
      const extractionDurationMs = Date.now() - extractionStartedAt;
      const dedupeStartedAt = Date.now();
      const dedupedResults = this.searchDedupeService.dedupe([...ownerSubmittedCandidates, ...pythonResult.items]);
      const geoEnrichedResults = await this.enrichCandidates(dedupedResults);
      const dedupeDurationMs = Date.now() - dedupeStartedAt;
      const rankingStartedAt = Date.now();
      const rankedResults = this.searchRankingService.rank(searchState, geoEnrichedResults);
      const rankingDurationMs = Date.now() - rankingStartedAt;
      const executionResult = {
        queryText,
        results: rankedResults,
        sourcesUsed:
          pythonResult.sourcesUsed.length > 0
            ? pythonResult.sourcesUsed
            : this.buildSourcesUsed(rankedResults.length > 0 ? rankedResults : dedupedResults),
      };

      this.logger.logEvent(
        'search execution completed through python scraper',
        {
          module: 'SearchExecutionService',
          action: 'search_execution_python_scraper_completed',
          queryText,
          extractedCount: pythonResult.items.length,
          dedupedCount: dedupedResults.length,
          duplicateCount: Math.max(0, pythonResult.items.length - dedupedResults.length),
          rankedCount: rankedResults.length,
          sourcesUsed: executionResult.sourcesUsed,
          partialFailures: pythonResult.partialFailures,
          extractionDurationMs,
          dedupeDurationMs,
          rankingDurationMs,
          durationMs: Date.now() - startedAt,
        },
        SearchExecutionService.name,
      );

      return executionResult;
    } catch (error) {
      this.logger.warnEvent(
        'python scraper execution failed, falling back to legacy pipeline',
        {
          module: 'SearchExecutionService',
          action: 'search_execution_python_scraper_failed',
          queryText,
          error:
            error instanceof Error
              ? error.message
              : 'python_scraper_unknown_error',
        },
        SearchExecutionService.name,
      );
      return null;
    }
  }

  private formatDiscoveryProvider(provider: string) {
    if (provider === 'vertex-ai-search') {
      return 'Vertex AI Search';
    }

    return 'Google Programmable Search';
  }

  private isMockFallbackEnabled() {
    if (!this.configService) {
      return true;
    }

    return this.configService.get<boolean>('search.mockFallbackEnabled', false);
  }

  private shouldDiscardAggregateListing(
    url: string,
    listing: SearchCandidate,
    adapter: { isDetailUrl?: (candidateUrl: string) => boolean },
  ) {
    const isDetailUrl = adapter.isDetailUrl?.(url) ?? true;
    if (isDetailUrl) {
      return false;
    }

    const title = listing.title.trim();
    const aggregateTitlePattern =
      /\b\d{1,3}(?:[.\s]\d{3})*\s+(departamentos?|casas?|propiedades|oficinas?|locales?|cocheras?|terrenos?|lotes?|ph)\s+en\s+(venta|alquiler)\b/i;
    const genericPortalTitlePattern =
      /\b(alquiler\s+y\s+venta|venta\s+y\s+alquiler)\s+de\s+(departamentos?|casas?|inmuebles|propiedades)\b/i;
    const looksLikeCategoryUrl =
      /\/(?:departamentos?|casas?|propiedades|oficinas?|locales?|cocheras?|terrenos?|lotes?)(?:\/|-)/i.test(url);
    const isHomepage = (() => {
      try {
        const pathname = new URL(url).pathname;
        return pathname === '/' || pathname === '';
      } catch {
        return false;
      }
    })();
    const lacksDetailSignals = listing.externalId === null && listing.price === null;

    return (
      aggregateTitlePattern.test(title) ||
      genericPortalTitlePattern.test(title) ||
      isHomepage ||
      (looksLikeCategoryUrl && lacksDetailSignals)
    );
  }
}
