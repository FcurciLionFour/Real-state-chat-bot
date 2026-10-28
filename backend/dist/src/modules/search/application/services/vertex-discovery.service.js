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
var VertexDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const redis_service_1 = require("../../../../infrastructure/redis/redis.service");
const allowed_source_domains_service_1 = require("../../../sources/application/services/allowed-source-domains.service");
let VertexDiscoveryService = class VertexDiscoveryService {
    static { VertexDiscoveryService_1 = this; }
    configService;
    allowedSourceDomainsService;
    redisService;
    logger;
    static TTL_SECONDS = 300;
    static PROVIDER = 'vertex-ai-search';
    constructor(configService, allowedSourceDomainsService, redisService, logger) {
        this.configService = configService;
        this.allowedSourceDomainsService = allowedSourceDomainsService;
        this.redisService = redisService;
        this.logger = logger;
    }
    getProvider() {
        return VertexDiscoveryService_1.PROVIDER;
    }
    isConfigured() {
        return this.getCredentialGaps().length === 0;
    }
    getCredentialGaps() {
        const gaps = [];
        if (!this.configService.get('search.vertexApiKey', '').trim()) {
            gaps.push('VERTEX_AI_SEARCH_API_KEY');
        }
        if (!this.configService.get('search.vertexProjectId', '').trim()) {
            gaps.push('VERTEX_AI_SEARCH_PROJECT_ID');
        }
        if (!this.configService.get('search.vertexAppId', '').trim()) {
            gaps.push('VERTEX_AI_SEARCH_APP_ID');
        }
        return gaps;
    }
    async discover(queries) {
        const apiKey = this.configService.get('search.vertexApiKey', '').trim();
        const projectId = this.configService.get('search.vertexProjectId', '').trim();
        const location = this.configService.get('search.vertexLocation', 'global').trim() || 'global';
        const collection = this.configService.get('search.vertexCollection', 'default_collection').trim() || 'default_collection';
        const appId = this.configService.get('search.vertexAppId', '').trim();
        const servingConfig = this.configService.get('search.vertexServingConfig', 'default_search').trim() || 'default_search';
        const attemptedQueries = queries.slice(0, 4).filter((query) => query.length > 0);
        if (!apiKey || !projectId || !appId || attemptedQueries.length === 0) {
            return {
                provider: VertexDiscoveryService_1.PROVIDER,
                enabled: false,
                attemptedQueries,
                candidateUrls: [],
            };
        }
        const cacheKey = this.buildCacheKey({
            attemptedQueries,
            projectId,
            location,
            collection,
            appId,
            servingConfig,
        });
        const cached = await this.redisService.getJson(cacheKey);
        if (cached) {
            this.logger.logEvent('vertex discovery cache hit', {
                module: 'VertexDiscoveryService',
                action: 'vertex_discovery_cache_hit',
                attemptedQueriesCount: attemptedQueries.length,
                candidateCount: cached.candidateUrls.length,
            }, VertexDiscoveryService_1.name);
            return cached;
        }
        const discoveryStartedAt = Date.now();
        const discoveredUrls = [];
        const endpoint = this.buildEndpoint({
            apiKey,
            projectId,
            location,
            collection,
            appId,
            servingConfig,
        });
        for (const query of attemptedQueries) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        query,
                        pageSize: 10,
                        userPseudoId: this.buildUserPseudoId(query),
                    }),
                });
                if (!response.ok) {
                    this.logger.warn(`Vertex discovery failed with status ${response.status} for query "${query}".`, VertexDiscoveryService_1.name);
                    continue;
                }
                const payload = (await response.json());
                discoveredUrls.push(...this.extractCandidateUrls(payload));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown discovery error';
                this.logger.warn(`Vertex discovery request failed for query "${query}": ${message}`, VertexDiscoveryService_1.name);
            }
            finally {
                clearTimeout(timeout);
            }
        }
        const result = {
            provider: VertexDiscoveryService_1.PROVIDER,
            enabled: true,
            attemptedQueries,
            candidateUrls: this.allowedSourceDomainsService.filterCandidateUrls(discoveredUrls),
        };
        await this.redisService.setJson(cacheKey, result, VertexDiscoveryService_1.TTL_SECONDS);
        this.logger.logEvent('vertex discovery completed', {
            module: 'VertexDiscoveryService',
            action: 'vertex_discovery_completed',
            attemptedQueriesCount: attemptedQueries.length,
            candidateCount: result.candidateUrls.length,
            durationMs: Date.now() - discoveryStartedAt,
        }, VertexDiscoveryService_1.name);
        return result;
    }
    buildEndpoint(input) {
        return `https://discoveryengine.googleapis.com/v1/projects/${input.projectId}/locations/${input.location}/collections/${input.collection}/engines/${input.appId}/servingConfigs/${input.servingConfig}:searchLite?key=${encodeURIComponent(input.apiKey)}`;
    }
    extractCandidateUrls(payload) {
        const candidates = [];
        for (const result of payload.results ?? []) {
            const document = result.document;
            const possibleValues = [
                document?.derivedStructData?.['link'],
                document?.derivedStructData?.['url'],
                document?.structData?.['link'],
                document?.structData?.['url'],
                document?.id,
            ];
            for (const value of possibleValues) {
                if (typeof value === 'string' && value.startsWith('http')) {
                    candidates.push(value);
                }
            }
        }
        return candidates;
    }
    buildCacheKey(input) {
        const hash = (0, node_crypto_1.createHash)('sha1')
            .update([
            VertexDiscoveryService_1.PROVIDER,
            input.projectId,
            input.location,
            input.collection,
            input.appId,
            input.servingConfig,
            input.attemptedQueries.join('||'),
        ].join('||'))
            .digest('hex');
        return `search:discovery:${hash}`;
    }
    buildUserPseudoId(query) {
        return (0, node_crypto_1.createHash)('sha1').update(query).digest('hex').slice(0, 32);
    }
};
exports.VertexDiscoveryService = VertexDiscoveryService;
exports.VertexDiscoveryService = VertexDiscoveryService = VertexDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        allowed_source_domains_service_1.AllowedSourceDomainsService,
        redis_service_1.RedisService,
        logger_service_1.LoggerService])
], VertexDiscoveryService);
