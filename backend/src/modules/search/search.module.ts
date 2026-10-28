import { Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { GoogleDiscoveryService } from './application/services/google-discovery.service';
import { MockSearchService } from './application/services/mock-search.service';
import { SearchDiscoveryService } from './application/services/search-discovery.service';
import { SearchDedupeService } from './application/services/search-dedupe.service';
import { SearchExecutionService } from './application/services/search-execution.service';
import { PythonScraperSearchService } from './application/services/python-scraper-search.service';
import { SearchResultsCacheService } from './application/services/search-results-cache.service';
import { SearchGeoService } from './application/services/search-geo.service';
import { SearchQueryBuilderService } from './application/services/search-query-builder.service';
import { SearchRankingService } from './application/services/search-ranking.service';
import { SearchRunService } from './application/services/search-run.service';
import { OwnerSubmittedSearchService } from './application/services/owner-submitted-search.service';
import { VertexDiscoveryService } from './application/services/vertex-discovery.service';
import { SearchRunPropertiesRepository } from './infrastructure/repositories/search-run-properties.repository';
import { SearchRunsRepository } from './infrastructure/repositories/search-runs.repository';

@Module({
  imports: [SourcesModule],
  providers: [
    MockSearchService,
    SearchQueryBuilderService,
    GoogleDiscoveryService,
    VertexDiscoveryService,
    SearchDiscoveryService,
    SearchDedupeService,
    SearchRankingService,
    SearchGeoService,
    SearchResultsCacheService,
    OwnerSubmittedSearchService,
    PythonScraperSearchService,
    SearchExecutionService,
    SearchRunService,
    SearchRunsRepository,
    SearchRunPropertiesRepository,
  ],
  exports: [
    MockSearchService,
    SearchQueryBuilderService,
    SearchDiscoveryService,
    SearchDedupeService,
    SearchRankingService,
    SearchGeoService,
    SearchResultsCacheService,
    SearchExecutionService,
    SearchRunService,
  ],
})
export class SearchModule {}
