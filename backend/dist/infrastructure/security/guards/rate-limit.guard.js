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
var RateLimitGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const node_crypto_1 = require("node:crypto");
const logger_service_1 = require("../../observability/logger.service");
const redis_service_1 = require("../../redis/redis.service");
const rate_limit_decorator_1 = require("../decorators/rate-limit.decorator");
const request_client_ip_service_1 = require("../request-client-ip.service");
let RateLimitGuard = RateLimitGuard_1 = class RateLimitGuard {
    reflector;
    redisService;
    logger;
    requestClientIpService;
    constructor(reflector, redisService, logger, requestClientIpService) {
        this.reflector = reflector;
        this.redisService = redisService;
        this.logger = logger;
        this.requestClientIpService = requestClientIpService;
    }
    async canActivate(context) {
        const options = this.reflector.getAllAndOverride(rate_limit_decorator_1.RATE_LIMIT_OPTIONS, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!options) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const key = this.buildStorageKey(request, options);
        const incrementResult = await this.redisService.incrementWithinWindow(key, options.windowSeconds);
        if (!incrementResult) {
            this.logger.warnEvent('rate limiting skipped because redis is unavailable', {
                module: 'RateLimitGuard',
                action: 'rate_limit_skipped',
                namespace: options.namespace,
            }, RateLimitGuard_1.name);
            return true;
        }
        if (incrementResult.value > options.limit) {
            this.logger.warnEvent('rate limit exceeded', {
                module: 'RateLimitGuard',
                action: 'rate_limit_exceeded',
                namespace: options.namespace,
                limit: options.limit,
                windowSeconds: options.windowSeconds,
                retryAfterSeconds: incrementResult.ttlSeconds,
            }, RateLimitGuard_1.name);
            throw new common_1.HttpException('Too many requests, please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
    buildStorageKey(request, options) {
        const actorKey = options.keyStrategy === 'user_or_ip'
            ? request.user?.id ?? this.extractIpAddress(request) ?? 'anonymous'
            : this.extractIpAddress(request) ?? 'anonymous';
        const hashedActorKey = (0, node_crypto_1.createHash)('sha1').update(actorKey).digest('hex');
        return `rate-limit:${options.namespace}:${hashedActorKey}`;
    }
    extractIpAddress(request) {
        return this.requestClientIpService.extractClientIp(request);
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = RateLimitGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        redis_service_1.RedisService,
        logger_service_1.LoggerService,
        request_client_ip_service_1.RequestClientIpService])
], RateLimitGuard);
