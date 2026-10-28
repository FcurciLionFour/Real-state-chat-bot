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
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
const logger_service_1 = require("../observability/logger.service");
let RedisService = RedisService_1 = class RedisService {
    configService;
    logger;
    client;
    connectionAttempted = false;
    connectionAvailable = false;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const redisUrl = this.configService.get('redis.url', '');
        this.client = new ioredis_1.default(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
        });
    }
    getClient() {
        return this.client;
    }
    async get(key) {
        const client = await this.getConnectedClient();
        if (!client) {
            return null;
        }
        try {
            return await client.get(key);
        }
        catch (error) {
            this.logRedisWarning('redis get failed', { action: 'redis_get', key, error });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        const client = await this.getConnectedClient();
        if (!client) {
            return false;
        }
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await client.set(key, value, 'EX', ttlSeconds);
            }
            else {
                await client.set(key, value);
            }
            return true;
        }
        catch (error) {
            this.logRedisWarning('redis set failed', { action: 'redis_set', key, ttlSeconds, error });
            return false;
        }
    }
    async getJson(key) {
        const rawValue = await this.get(key);
        if (!rawValue) {
            return null;
        }
        try {
            return JSON.parse(rawValue);
        }
        catch (error) {
            this.logRedisWarning('redis cached json could not be parsed', { action: 'redis_get_json', key, error });
            return null;
        }
    }
    async setJson(key, value, ttlSeconds) {
        return this.set(key, JSON.stringify(value), ttlSeconds);
    }
    async incrementWithinWindow(key, ttlSeconds) {
        const client = await this.getConnectedClient();
        if (!client) {
            return null;
        }
        try {
            const nextValue = await client.incr(key);
            if (nextValue === 1) {
                await client.expire(key, ttlSeconds);
            }
            const ttl = await client.ttl(key);
            return {
                value: nextValue,
                ttlSeconds: ttl >= 0 ? ttl : ttlSeconds,
            };
        }
        catch (error) {
            this.logRedisWarning('redis increment failed', { action: 'redis_incr', key, ttlSeconds, error });
            return null;
        }
    }
    async ping() {
        const client = await this.getConnectedClient();
        if (!client) {
            return false;
        }
        try {
            return (await client.ping()) === 'PONG';
        }
        catch (error) {
            this.logRedisWarning('redis ping failed', { action: 'redis_ping', error });
            return false;
        }
    }
    async deleteByPrefixes(prefixes) {
        const client = await this.getConnectedClient();
        if (!client) {
            return {
                available: false,
                matchedKeys: 0,
                deletedKeys: 0,
            };
        }
        const normalizedPrefixes = prefixes
            .map((prefix) => prefix.trim())
            .filter((prefix, index, array) => prefix.length > 0 && array.indexOf(prefix) === index);
        if (normalizedPrefixes.length === 0) {
            return {
                available: true,
                matchedKeys: 0,
                deletedKeys: 0,
            };
        }
        const matchingKeys = new Set();
        try {
            for (const prefix of normalizedPrefixes) {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
                    cursor = nextCursor;
                    for (const key of keys) {
                        matchingKeys.add(key);
                    }
                } while (cursor !== '0');
            }
            if (matchingKeys.size === 0) {
                return {
                    available: true,
                    matchedKeys: 0,
                    deletedKeys: 0,
                };
            }
            const deletedKeys = await client.del(...matchingKeys);
            return {
                available: true,
                matchedKeys: matchingKeys.size,
                deletedKeys,
            };
        }
        catch (error) {
            this.logRedisWarning('redis delete by prefixes failed', {
                action: 'redis_delete_by_prefixes',
                prefixes: normalizedPrefixes,
                error,
            });
            return {
                available: true,
                matchedKeys: 0,
                deletedKeys: 0,
            };
        }
    }
    async onModuleDestroy() {
        await this.client.quit();
    }
    async getConnectedClient() {
        if (this.connectionAvailable) {
            return this.client;
        }
        if (this.connectionAttempted) {
            return null;
        }
        this.connectionAttempted = true;
        try {
            await this.client.connect();
            this.connectionAvailable = true;
            this.logger.logEvent('redis connection established', {
                module: 'RedisService',
                action: 'redis_connect',
            }, RedisService_1.name);
            return this.client;
        }
        catch (error) {
            this.logRedisWarning('redis connection unavailable, continuing without cache', {
                action: 'redis_connect',
                error,
            });
            return null;
        }
    }
    logRedisWarning(message, metadata) {
        this.logger.warnEvent(message, {
            module: 'RedisService',
            ...metadata,
        }, RedisService_1.name);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], RedisService);
