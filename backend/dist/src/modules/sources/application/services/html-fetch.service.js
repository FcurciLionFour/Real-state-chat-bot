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
var HtmlFetchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlFetchService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const redis_service_1 = require("../../../../infrastructure/redis/redis.service");
let HtmlFetchService = class HtmlFetchService {
    static { HtmlFetchService_1 = this; }
    redisService;
    logger;
    static TTL_SECONDS = 900;
    constructor(redisService, logger) {
        this.redisService = redisService;
        this.logger = logger;
    }
    async fetch(url) {
        const cacheKey = `search:html:${url}`;
        const cachedHtml = await this.redisService.get(cacheKey);
        if (cachedHtml) {
            this.logger.logEvent('html cache hit', {
                module: 'HtmlFetchService',
                action: 'html_cache_hit',
                url,
            }, HtmlFetchService_1.name);
            return cachedHtml;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const startedAt = Date.now();
        try {
            const response = await globalThis.fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'RealStateChatBotMvp/0.1 (+https://localhost)',
                    Accept: 'text/html,application/xhtml+xml',
                },
                redirect: 'follow',
                signal: controller.signal,
            });
            if (!response.ok) {
                this.logger.warn(`HTML fetch failed with status ${response.status} for ${url}.`, HtmlFetchService_1.name);
                return null;
            }
            const contentType = response.headers.get('content-type') ?? '';
            if (!contentType.includes('text/html')) {
                this.logger.warn(`Discarding non-HTML content fetched from ${url}.`, HtmlFetchService_1.name);
                return null;
            }
            const html = await response.text();
            await this.redisService.set(cacheKey, html, HtmlFetchService_1.TTL_SECONDS);
            this.logger.logEvent('html fetched successfully', {
                module: 'HtmlFetchService',
                action: 'html_fetch_completed',
                url,
                durationMs: Date.now() - startedAt,
            }, HtmlFetchService_1.name);
            return html;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown HTML fetch error';
            this.logger.warn(`HTML fetch failed for ${url}: ${message}`, HtmlFetchService_1.name);
            return null;
        }
        finally {
            clearTimeout(timeout);
        }
    }
};
exports.HtmlFetchService = HtmlFetchService;
exports.HtmlFetchService = HtmlFetchService = HtmlFetchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        logger_service_1.LoggerService])
], HtmlFetchService);
