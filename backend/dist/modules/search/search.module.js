"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchModule = void 0;
const common_1 = require("@nestjs/common");
const sources_module_1 = require("../sources/sources.module");
const google_discovery_service_1 = require("./application/services/google-discovery.service");
const mock_search_service_1 = require("./application/services/mock-search.service");
const search_discovery_service_1 = require("./application/services/search-discovery.service");
const search_dedupe_service_1 = require("./application/services/search-dedupe.service");
const search_execution_service_1 = require("./application/services/search-execution.service");
const python_scraper_search_service_1 = require("./application/services/python-scraper-search.service");
const search_results_cache_service_1 = require("./application/services/search-results-cache.service");
const search_query_builder_service_1 = require("./application/services/search-query-builder.service");
const search_ranking_service_1 = require("./application/services/search-ranking.service");
const search_run_service_1 = require("./application/services/search-run.service");
const vertex_discovery_service_1 = require("./application/services/vertex-discovery.service");
const search_run_properties_repository_1 = require("./infrastructure/repositories/search-run-properties.repository");
const search_runs_repository_1 = require("./infrastructure/repositories/search-runs.repository");
let SearchModule = class SearchModule {
};
exports.SearchModule = SearchModule;
exports.SearchModule = SearchModule = __decorate([
    (0, common_1.Module)({
        imports: [sources_module_1.SourcesModule],
        providers: [
            mock_search_service_1.MockSearchService,
            search_query_builder_service_1.SearchQueryBuilderService,
            google_discovery_service_1.GoogleDiscoveryService,
            vertex_discovery_service_1.VertexDiscoveryService,
            search_discovery_service_1.SearchDiscoveryService,
            search_dedupe_service_1.SearchDedupeService,
            search_ranking_service_1.SearchRankingService,
            search_results_cache_service_1.SearchResultsCacheService,
            python_scraper_search_service_1.PythonScraperSearchService,
            search_execution_service_1.SearchExecutionService,
            search_run_service_1.SearchRunService,
            search_runs_repository_1.SearchRunsRepository,
            search_run_properties_repository_1.SearchRunPropertiesRepository,
        ],
        exports: [
            mock_search_service_1.MockSearchService,
            search_query_builder_service_1.SearchQueryBuilderService,
            search_discovery_service_1.SearchDiscoveryService,
            search_dedupe_service_1.SearchDedupeService,
            search_ranking_service_1.SearchRankingService,
            search_results_cache_service_1.SearchResultsCacheService,
            search_execution_service_1.SearchExecutionService,
            search_run_service_1.SearchRunService,
        ],
    })
], SearchModule);
