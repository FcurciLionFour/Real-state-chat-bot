"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SearchExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchExecutionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const html_fetch_service_1 = require("../../../sources/application/services/html-fetch.service");
const property_source_registry_service_1 = require("../../../sources/application/services/property-source-registry.service");
const mock_search_service_1 = require("./mock-search.service");
const search_discovery_service_1 = require("./search-discovery.service");
const search_dedupe_service_1 = require("./search-dedupe.service");
const python_scraper_search_service_1 = require("./python-scraper-search.service");
const search_results_cache_service_1 = require("./search-results-cache.service");
const search_query_builder_service_1 = require("./search-query-builder.service");
const search_ranking_service_1 = require("./search-ranking.service");
const owner_submitted_search_service_1 = require("./owner-submitted-search.service");
const search_geo_service_1 = require("./search-geo.service");
let SearchExecutionService = SearchExecutionService_1 = class SearchExecutionService {
    searchQueryBuilderService;
    searchDiscoveryService;
    htmlFetchService;
    propertySourceRegistryService;
    searchDedupeService;
    searchRankingService;
    searchResultsCacheService;
    mockSearchService;
    logger;
    pythonScraperSearchService;
    ownerSubmittedSearchService;
    configService;
    searchGeoService;
    constructor(searchQueryBuilderService, searchDiscoveryService, htmlFetchService, propertySourceRegistryService, searchDedupeService, searchRankingService, searchResultsCacheService, mockSearchService, logger, pythonScraperSearchService, ownerSubmittedSearchService, configService, searchGeoService) {
        this.searchQueryBuilderService = searchQueryBuilderService;
        this.searchDiscoveryService = searchDiscoveryService;
        this.htmlFetchService = htmlFetchService;
        this.propertySourceRegistryService = propertySourceRegistryService;
        this.searchDedupeService = searchDedupeService;
        this.searchRankingService = searchRankingService;
        this.searchResultsCacheService = searchResultsCacheService;
        this.mockSearchService = mockSearchService;
        this.logger = logger;
        this.pythonScraperSearchService = pythonScraperSearchService;
        this.ownerSubmittedSearchService = ownerSubmittedSearchService;
        this.configService = configService;
        this.searchGeoService = searchGeoService;
    }
    async execute(searchState) {
        const startedAt = Date.now();
        const effectiveSearchState = await this.enrichSearchState(searchState);
        const queryText = this.searchQueryBuilderService.buildPrimaryQuery(effectiveSearchState);
        this.logger.logEvent('search execution started', {
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
        }, SearchExecutionService_1.name);
        const cachedResult = await this.searchResultsCacheService.get(effectiveSearchState);
        if (cachedResult) {
            if (!this.isMockFallbackEnabled() && cachedResult.sourcesUsed.includes('mock-source')) {
                this.logger.warnEvent('cached mock search result ignored because mock fallback is disabled', {
                    module: 'SearchExecutionService',
                    action: 'search_execution_mock_cache_ignored',
                    queryText: cachedResult.queryText,
                    resultCount: cachedResult.results.length,
                }, SearchExecutionService_1.name);
            }
            else {
                this.logger.logEvent('search execution served from cache', {
                    module: 'SearchExecutionService',
                    action: 'search_execution_cache_hit',
                    queryText: cachedResult.queryText,
                    resultCount: cachedResult.results.length,
                    durationMs: Date.now() - startedAt,
                }, SearchExecutionService_1.name);
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
            return this.buildMockFallback(effectiveSearchState, queryText, ownerSubmittedCandidates, `${discoveryProviderLabel} discovery is not configured yet.`);
        }
        if (discoveryResult.candidateUrls.length === 0) {
            return this.buildMockFallback(effectiveSearchState, queryText, ownerSubmittedCandidates, `${discoveryProviderLabel} discovery did not return candidate URLs on the allowlist.`);
        }
        const supportedUrls = this.propertySourceRegistryService.filterSupportedUrls(discoveryResult.candidateUrls);
        this.logger.logEvent('search discovery stage completed', {
            module: 'SearchExecutionService',
            action: 'search_discovery_completed',
            queryText,
            discoveryProvider: discoveryResult.provider,
            attemptedQueriesCount: discoveryResult.attemptedQueries.length,
            candidateUrlCount: discoveryResult.candidateUrls.length,
            supportedUrlCount: supportedUrls.length,
            durationMs: discoveryDurationMs,
        }, SearchExecutionService_1.name);
        if (supportedUrls.length === 0) {
            return this.buildMockFallback(effectiveSearchState, queryText, ownerSubmittedCandidates, 'Candidate URLs were discovered, but there are no source adapters registered yet.');
        }
        const extractedCandidates = [];
        const extractionStartedAt = Date.now();
        for (const url of supportedUrls) {
            const adapter = this.propertySourceRegistryService.findAdapterForUrl(url);
            if (!adapter) {
                continue;
            }
            const html = await this.htmlFetchService.fetch(url);
            if (!html) {
                this.logger.warnEvent('search candidate discarded because html fetch returned empty content', {
                    module: 'SearchExecutionService',
                    action: 'search_candidate_discarded',
                    url,
                    source: adapter.sourceName,
                    reason: 'fetch_failed',
                }, SearchExecutionService_1.name);
                continue;
            }
            const listing = await adapter.extract(url, html);
            if (!listing) {
                this.logger.warnEvent('search candidate discarded because adapter could not extract a valid listing', {
                    module: 'SearchExecutionService',
                    action: 'search_candidate_discarded',
                    url,
                    source: adapter.sourceName,
                    reason: 'normalization_failed',
                }, SearchExecutionService_1.name);
                continue;
            }
            if (this.shouldDiscardAggregateListing(url, listing, adapter)) {
                this.logger.warnEvent('search candidate discarded because it looks like an aggregate listing page instead of a property detail page', {
                    module: 'SearchExecutionService',
                    action: 'search_candidate_discarded',
                    url,
                    source: adapter.sourceName,
                    reason: 'aggregate_listing_page',
                }, SearchExecutionService_1.name);
                continue;
            }
            extractedCandidates.push(listing);
        }
        if (extractedCandidates.length === 0) {
            return this.buildMockFallback(effectiveSearchState, queryText, ownerSubmittedCandidates, 'The first real adapter could not extract usable listings. Falling back to mock search.');
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
            this.logger.warn('Real listings were extracted, but all of them were filtered out by essential ranking rules.', SearchExecutionService_1.name);
        }
        const executionResult = {
            queryText,
            results: rankedResults,
            sourcesUsed: this.buildSourcesUsed(rankedResults.length > 0 ? rankedResults : extractedCandidates),
        };
        await this.searchResultsCacheService.set(effectiveSearchState, executionResult);
        this.logger.logEvent('search execution completed', {
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
        }, SearchExecutionService_1.name);
        return executionResult;
    }
    buildMockFallback(searchState, queryText, ownerSubmittedCandidates, reason) {
        if (reason) {
            this.logger.warn(reason, SearchExecutionService_1.name);
        }
        if (!this.isMockFallbackEnabled()) {
            const ownerSubmittedResults = this.searchRankingService.rank(searchState, ownerSubmittedCandidates);
            this.logger.warnEvent('mock fallback disabled; returning only real owner-submitted candidates', {
                module: 'SearchExecutionService',
                action: 'search_execution_mock_fallback_disabled',
                queryText,
                reason: reason ?? 'fallback_without_reason',
                resultCount: ownerSubmittedResults.length,
                sourcesUsed: this.buildSourcesUsed(ownerSubmittedResults),
            }, SearchExecutionService_1.name);
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
        this.logger.logEvent('search execution returned fallback results', {
            module: 'SearchExecutionService',
            action: 'search_execution_fallback',
            queryText,
            reason: reason ?? 'fallback_without_reason',
            resultCount: fallbackResults.length,
            sourcesUsed: this.buildSourcesUsed(fallbackResults),
        }, SearchExecutionService_1.name);
        return {
            queryText,
            results: fallbackResults,
            sourcesUsed: this.buildSourcesUsed(fallbackResults),
        };
    }
    buildSourcesUsed(results) {
        return Array.from(new Set(results.map((result) => result.source)));
    }
    enrichSearchState(searchState) {
        return this.searchGeoService?.enrichSearchState(searchState) ?? Promise.resolve(searchState);
    }
    enrichCandidates(candidates) {
        return this.searchGeoService?.enrichCandidates(candidates) ?? Promise.resolve(candidates);
    }
    async findOwnerSubmittedCandidates(searchState, queryText) {
        if (!this.ownerSubmittedSearchService) {
            return [];
        }
        try {
            return await this.ownerSubmittedSearchService.findCandidates(searchState);
        }
        catch (error) {
            this.logger.warnEvent('owner submitted search failed; continuing with external sources', {
                module: 'SearchExecutionService',
                action: 'search_execution_owner_submitted_failed',
                queryText,
                error: error instanceof Error ? error.message : 'owner_submitted_unknown_error',
            }, SearchExecutionService_1.name);
            return [];
        }
    }
    async tryPythonScraper(searchState, queryText, startedAt, ownerSubmittedCandidates) {
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
                sourcesUsed: pythonResult.sourcesUsed.length > 0
                    ? pythonResult.sourcesUsed
                    : this.buildSourcesUsed(rankedResults.length > 0 ? rankedResults : dedupedResults),
            };
            this.logger.logEvent('search execution completed through python scraper', {
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
            }, SearchExecutionService_1.name);
            return executionResult;
        }
        catch (error) {
            this.logger.warnEvent('python scraper execution failed, falling back to legacy pipeline', {
                module: 'SearchExecutionService',
                action: 'search_execution_python_scraper_failed',
                queryText,
                error: error instanceof Error
                    ? error.message
                    : 'python_scraper_unknown_error',
            }, SearchExecutionService_1.name);
            return null;
        }
    }
    formatDiscoveryProvider(provider) {
        if (provider === 'vertex-ai-search') {
            return 'Vertex AI Search';
        }
        return 'Google Programmable Search';
    }
    isMockFallbackEnabled() {
        if (!this.configService) {
            return true;
        }
        return this.configService.get('search.mockFallbackEnabled', false);
    }
    shouldDiscardAggregateListing(url, listing, adapter) {
        const isDetailUrl = adapter.isDetailUrl?.(url) ?? true;
        if (isDetailUrl) {
            return false;
        }
        const title = listing.title.trim();
        const aggregateTitlePattern = /\b\d{1,3}(?:[.\s]\d{3})*\s+(departamentos?|casas?|propiedades|oficinas?|locales?|cocheras?|terrenos?|lotes?|ph)\s+en\s+(venta|alquiler)\b/i;
        const genericPortalTitlePattern = /\b(alquiler\s+y\s+venta|venta\s+y\s+alquiler)\s+de\s+(departamentos?|casas?|inmuebles|propiedades)\b/i;
        const looksLikeCategoryUrl = /\/(?:departamentos?|casas?|propiedades|oficinas?|locales?|cocheras?|terrenos?|lotes?)(?:\/|-)/i.test(url);
        const isHomepage = (() => {
            try {
                const pathname = new URL(url).pathname;
                return pathname === '/' || pathname === '';
            }
            catch {
                return false;
            }
        })();
        const lacksDetailSignals = listing.externalId === null && listing.price === null;
        return (aggregateTitlePattern.test(title) ||
            genericPortalTitlePattern.test(title) ||
            isHomepage ||
            (looksLikeCategoryUrl && lacksDetailSignals));
    }
};
exports.SearchExecutionService = SearchExecutionService;
exports.SearchExecutionService = SearchExecutionService = SearchExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, common_1.Optional)()),
    __param(10, (0, common_1.Optional)()),
    __param(11, (0, common_1.Optional)()),
    __param(12, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [search_query_builder_service_1.SearchQueryBuilderService,
        search_discovery_service_1.SearchDiscoveryService,
        html_fetch_service_1.HtmlFetchService,
        property_source_registry_service_1.PropertySourceRegistryService,
        search_dedupe_service_1.SearchDedupeService,
        search_ranking_service_1.SearchRankingService,
        search_results_cache_service_1.SearchResultsCacheService,
        mock_search_service_1.MockSearchService,
        logger_service_1.LoggerService,
        python_scraper_search_service_1.PythonScraperSearchService,
        owner_submitted_search_service_1.OwnerSubmittedSearchService,
        config_1.ConfigService,
        search_geo_service_1.SearchGeoService])
], SearchExecutionService);
