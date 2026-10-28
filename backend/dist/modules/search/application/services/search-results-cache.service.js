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
var SearchResultsCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResultsCacheService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const redis_service_1 = require("../../../../infrastructure/redis/redis.service");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
let SearchResultsCacheService = class SearchResultsCacheService {
    static { SearchResultsCacheService_1 = this; }
    redisService;
    logger;
    static TTL_SECONDS = 120;
    constructor(redisService, logger) {
        this.redisService = redisService;
        this.logger = logger;
    }
    async get(filters) {
        const cacheKey = this.buildCacheKey(filters);
        const cached = await this.redisService.getJson(cacheKey);
        if (cached) {
            this.logger.logEvent('search result cache hit', {
                module: 'SearchResultsCacheService',
                action: 'search_results_cache_hit',
                cacheKey,
                resultCount: cached.results.length,
            }, SearchResultsCacheService_1.name);
        }
        return cached;
    }
    async set(filters, payload) {
        const cacheKey = this.buildCacheKey(filters);
        const persisted = await this.redisService.setJson(cacheKey, payload, SearchResultsCacheService_1.TTL_SECONDS);
        if (persisted) {
            this.logger.logEvent('search result cache stored', {
                module: 'SearchResultsCacheService',
                action: 'search_results_cache_set',
                cacheKey,
                resultCount: payload.results.length,
                ttlSeconds: SearchResultsCacheService_1.TTL_SECONDS,
            }, SearchResultsCacheService_1.name);
        }
    }
    buildCacheKey(filters) {
        const normalizedPayload = JSON.stringify(filters);
        const hash = (0, node_crypto_1.createHash)('sha1').update(normalizedPayload).digest('hex');
        return `search:results:${hash}`;
    }
};
exports.SearchResultsCacheService = SearchResultsCacheService;
exports.SearchResultsCacheService = SearchResultsCacheService = SearchResultsCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        logger_service_1.LoggerService])
], SearchResultsCacheService);
