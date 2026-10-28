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
var SearchRunService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchRunService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const search_runs_repository_1 = require("../../infrastructure/repositories/search-runs.repository");
const search_run_properties_repository_1 = require("../../infrastructure/repositories/search-run-properties.repository");
let SearchRunService = SearchRunService_1 = class SearchRunService {
    searchRunsRepository;
    searchRunPropertiesRepository;
    logger;
    requestContextService;
    constructor(searchRunsRepository, searchRunPropertiesRepository, logger, requestContextService) {
        this.searchRunsRepository = searchRunsRepository;
        this.searchRunPropertiesRepository = searchRunPropertiesRepository;
        this.logger = logger;
        this.requestContextService = requestContextService;
    }
    async persistSearchRun(input) {
        const searchRun = await this.searchRunsRepository.create({
            conversationId: input.conversationId,
            filtersSnapshotJson: input.filtersSnapshot,
            queryText: input.queryText,
            resultCount: input.results.length,
            sourcesUsedJson: input.sourcesUsed,
            status: client_1.SearchRunStatus.COMPLETED,
        });
        await this.searchRunPropertiesRepository.createMany(input.results.map((result) => ({
            searchRunId: searchRun.id,
            propertyCacheId: result.propertyCacheId,
            position: result.rank.position,
            rankScore: result.rank.score,
            rankReasonJson: this.buildRankReasonJson(result.rank),
        })));
        this.requestContextService?.set({ searchRunId: searchRun.id });
        this.logger.logEvent('search run persisted', {
            module: 'SearchRunService',
            action: 'search_run_persisted',
            conversationId: input.conversationId,
            searchRunId: searchRun.id,
            resultCount: input.results.length,
            sourcesUsed: input.sourcesUsed,
        }, SearchRunService_1.name);
        return searchRun;
    }
    persistMockSearchRun(input) {
        return this.persistSearchRun(input);
    }
    async getLatestResultsByConversationId(conversationId) {
        const searchRun = await this.searchRunsRepository.findLatestByConversationId(conversationId);
        if (!searchRun) {
            return null;
        }
        return {
            searchRun: {
                id: searchRun.id,
                status: searchRun.status,
                resultCount: searchRun.resultCount,
                createdAt: searchRun.createdAt,
            },
            results: searchRun.results.map((item) => this.serializeSearchRunProperty(item)),
        };
    }
    buildRankReasonJson(rank) {
        return {
            reasons: rank.reasons,
            ...(rank.reasonDetails ?? {}),
        };
    }
    serializeSearchRunProperty(item) {
        const property = item.propertyCache;
        const rankReasonJson = this.readRankReasonJson(item.rankReasonJson);
        return {
            propertyId: property.id,
            source: property.source,
            sourceUrl: property.sourceUrl,
            publisher: property.publisher,
            contactPhone: property.contactPhone,
            contactWhatsApp: property.contactWhatsApp,
            title: property.title,
            operation: property.operation,
            propertyType: property.propertyType,
            price: property.priceAmount === null ? null : Number(property.priceAmount),
            currency: property.priceCurrency,
            expenses: property.expensesAmount === null ? null : Number(property.expensesAmount),
            city: property.city,
            neighborhood: property.neighborhood,
            locationText: property.locationText,
            geo: property.latitude !== null && property.longitude !== null
                ? {
                    latitude: Number(property.latitude),
                    longitude: Number(property.longitude),
                    precision: property.geoPrecision ?? 'unknown',
                    provider: property.geocodingProvider ?? 'unknown',
                    geocodedAt: property.geocodedAt,
                }
                : null,
            rooms: property.rooms === null ? null : Number(property.rooms),
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            areaTotal: property.areaTotal === null ? null : Number(property.areaTotal),
            areaCovered: property.areaCovered === null ? null : Number(property.areaCovered),
            features: Array.isArray(property.featuresJson) ? property.featuresJson : [],
            images: Array.isArray(property.imagesJson) ? property.imagesJson : [],
            scrapedAt: property.scrapedAt,
            publishedAt: property.publishedAt,
            rank: {
                position: item.position,
                score: Number(item.rankScore),
                reasons: rankReasonJson.reasons,
            },
        };
    }
    readRankReasonJson(value) {
        const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const reasons = Array.isArray(payload.reasons)
            ? payload.reasons.filter((reason) => typeof reason === 'string')
            : [];
        return {
            reasons,
        };
    }
};
exports.SearchRunService = SearchRunService;
exports.SearchRunService = SearchRunService = SearchRunService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [search_runs_repository_1.SearchRunsRepository,
        search_run_properties_repository_1.SearchRunPropertiesRepository,
        logger_service_1.LoggerService,
        request_context_service_1.RequestContextService])
], SearchRunService);
