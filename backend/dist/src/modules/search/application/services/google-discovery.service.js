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
var GoogleDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("../../../../infrastructure/redis/redis.service");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const allowed_source_domains_service_1 = require("../../../sources/application/services/allowed-source-domains.service");
let GoogleDiscoveryService = class GoogleDiscoveryService {
    static { GoogleDiscoveryService_1 = this; }
    configService;
    allowedSourceDomainsService;
    redisService;
    logger;
    static TTL_SECONDS = 300;
    static PROVIDER = 'google-programmable-search';
    constructor(configService, allowedSourceDomainsService, redisService, logger) {
        this.configService = configService;
        this.allowedSourceDomainsService = allowedSourceDomainsService;
        this.redisService = redisService;
        this.logger = logger;
    }
    getProvider() {
        return GoogleDiscoveryService_1.PROVIDER;
    }
    isConfigured() {
        const apiKey = this.configService.get('search.googleApiKey', '').trim();
        const searchEngineId = this.configService.get('search.googleSearchEngineId', '').trim();
        return apiKey.length > 0 && searchEngineId.length > 0;
    }
    getCredentialGaps() {
        const gaps = [];
        if (!this.configService.get('search.googleApiKey', '').trim()) {
            gaps.push('GOOGLE_SEARCH_API_KEY');
        }
        if (!this.configService.get('search.googleSearchEngineId', '').trim()) {
            gaps.push('GOOGLE_SEARCH_ENGINE_ID');
        }
        return gaps;
    }
    async discover(queries) {
        const apiKey = this.configService.get('search.googleApiKey', '');
        const searchEngineId = this.configService.get('search.googleSearchEngineId', '');
        const attemptedQueries = queries.slice(0, 4).filter((query) => query.length > 0);
        if (!apiKey || !searchEngineId || attemptedQueries.length === 0) {
            return {
                provider: GoogleDiscoveryService_1.PROVIDER,
                enabled: false,
                attemptedQueries,
                candidateUrls: [],
            };
        }
        const cacheKey = this.buildCacheKey(attemptedQueries);
        const cached = await this.redisService.getJson(cacheKey);
        if (cached) {
            this.logger.logEvent('google discovery cache hit', {
                module: 'GoogleDiscoveryService',
                action: 'google_discovery_cache_hit',
                attemptedQueriesCount: attemptedQueries.length,
                candidateCount: cached.candidateUrls.length,
            }, GoogleDiscoveryService_1.name);
            return cached;
        }
        const discoveryStartedAt = Date.now();
        const discoveredUrls = [];
        for (const query of attemptedQueries) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const searchParams = new URLSearchParams({
                    key: apiKey,
                    cx: searchEngineId,
                    q: query,
                    num: '10',
                });
                const response = await fetch(`https://www.googleapis.com/customsearch/v1?${searchParams.toString()}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    this.logger.warn(`Google discovery failed with status ${response.status} for query "${query}".`, GoogleDiscoveryService_1.name);
                    continue;
                }
                const payload = (await response.json());
                for (const item of payload.items ?? []) {
                    if (item.link) {
                        discoveredUrls.push(item.link);
                    }
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown discovery error';
                this.logger.warn(`Google discovery request failed for query "${query}": ${message}`, GoogleDiscoveryService_1.name);
            }
            finally {
                clearTimeout(timeout);
            }
        }
        const result = {
            provider: GoogleDiscoveryService_1.PROVIDER,
            enabled: true,
            attemptedQueries,
            candidateUrls: this.allowedSourceDomainsService.filterCandidateUrls(discoveredUrls),
        };
        await this.redisService.setJson(cacheKey, result, GoogleDiscoveryService_1.TTL_SECONDS);
        this.logger.logEvent('google discovery completed', {
            module: 'GoogleDiscoveryService',
            action: 'google_discovery_completed',
            attemptedQueriesCount: attemptedQueries.length,
            candidateCount: result.candidateUrls.length,
            durationMs: Date.now() - discoveryStartedAt,
        }, GoogleDiscoveryService_1.name);
        return result;
    }
    buildCacheKey(attemptedQueries) {
        const hash = (0, node_crypto_1.createHash)('sha1').update(attemptedQueries.join('||')).digest('hex');
        return `search:discovery:${hash}`;
    }
};
exports.GoogleDiscoveryService = GoogleDiscoveryService;
exports.GoogleDiscoveryService = GoogleDiscoveryService = GoogleDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        allowed_source_domains_service_1.AllowedSourceDomainsService,
        redis_service_1.RedisService,
        logger_service_1.LoggerService])
], GoogleDiscoveryService);
