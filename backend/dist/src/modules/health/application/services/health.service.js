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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const openai_service_1 = require("../../../../infrastructure/openai/openai.service");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
const redis_service_1 = require("../../../../infrastructure/redis/redis.service");
const search_discovery_service_1 = require("../../../search/application/services/search-discovery.service");
let HealthService = class HealthService {
    prisma;
    redis;
    openAiService;
    searchDiscoveryService;
    constructor(prisma, redis, openAiService, searchDiscoveryService) {
        this.prisma = prisma;
        this.redis = redis;
        this.openAiService = openAiService;
        this.searchDiscoveryService = searchDiscoveryService;
    }
    getLiveness() {
        return {
            status: 'ok',
            service: 'real-state-chat-bot-backend',
            timestamp: new Date().toISOString(),
        };
    }
    async getReadiness() {
        const [databaseCheck, redisCheck] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
        const openAiConfigured = this.openAiService.getApiKey().trim().length > 0;
        const discoveryStatus = this.searchDiscoveryService.getStatus();
        const status = databaseCheck.status === 'up' ? 'ready' : 'down';
        return {
            status,
            service: 'real-state-chat-bot-backend',
            timestamp: new Date().toISOString(),
            checks: {
                database: databaseCheck,
                redis: redisCheck,
                openai: {
                    status: this.resolveConfiguredStatus(openAiConfigured),
                },
                discovery: {
                    status: this.resolveConfiguredStatus(discoveryStatus.configured),
                },
            },
            capabilities: {
                aiInterpretation: openAiConfigured ? 'live' : 'safe-fallback',
                discovery: discoveryStatus.configured ? 'live' : 'not_configured',
            },
        };
    }
    async checkDatabase() {
        const startedAt = Date.now();
        try {
            await this.prisma.$queryRawUnsafe('SELECT 1');
            return {
                status: 'up',
                latencyMs: Date.now() - startedAt,
            };
        }
        catch {
            return {
                status: 'down',
                latencyMs: Date.now() - startedAt,
                error: 'database_unavailable',
            };
        }
    }
    async checkRedis() {
        const startedAt = Date.now();
        const reachable = await this.redis.ping();
        if (reachable) {
            return {
                status: 'up',
                optional: true,
                latencyMs: Date.now() - startedAt,
            };
        }
        return {
            status: 'degraded',
            optional: true,
            latencyMs: Date.now() - startedAt,
            error: 'redis_unavailable',
        };
    }
    resolveConfiguredStatus(isConfigured) {
        return isConfigured ? 'configured' : 'not_configured';
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        openai_service_1.OpenAiService,
        search_discovery_service_1.SearchDiscoveryService])
], HealthService);
