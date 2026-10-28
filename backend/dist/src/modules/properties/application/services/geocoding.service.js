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
exports.GeocodingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const NEIGHBORHOOD_COORDS = {
    palermo: [-34.5889, -58.4306],
    'palermo chico': [-34.5795, -58.4076],
    'palermo soho': [-34.5895, -58.4297],
    'palermo hollywood': [-34.5799, -58.4368],
    recoleta: [-34.5883, -58.3974],
    caballito: [-34.6187, -58.4431],
    almagro: [-34.6094, -58.4217],
    belgrano: [-34.5627, -58.4583],
    'villa crespo': [-34.5985, -58.4427],
    'villa urquiza': [-34.5733, -58.4872],
    'puerto madero': [-34.6118, -58.3626],
    colegiales: [-34.5746, -58.4482],
    chacarita: [-34.5881, -58.4545],
};
const STREET_BLOCK_COORDS = [
    {
        pattern: /jer[oó]nimo\s+salguero|salguero/i,
        blocks: [
            { min: 2500, max: 2899, coords: [-34.5799, -58.4108] },
            { min: 2100, max: 2499, coords: [-34.5862, -58.4152] },
            { min: 1500, max: 2099, coords: [-34.5954, -58.4219] },
        ],
    },
    {
        pattern: /gurruchaga/i,
        blocks: [
            { min: 1900, max: 2299, coords: [-34.5864, -58.4268] },
            { min: 1400, max: 1899, coords: [-34.5948, -58.4344] },
        ],
    },
    {
        pattern: /araoz|ar[aá]oz/i,
        blocks: [
            { min: 1000, max: 1499, coords: [-34.5946, -58.4302] },
            { min: 1500, max: 1999, coords: [-34.5888, -58.4248] },
        ],
    },
    {
        pattern: /acu[nñ]a\s+de\s+figueroa/i,
        blocks: [
            { min: 1000, max: 1399, coords: [-34.5942, -58.4208] },
            { min: 1400, max: 1799, coords: [-34.5887, -58.4155] },
        ],
    },
];
let GeocodingService = class GeocodingService {
    configService;
    logger;
    memoryCache = new Map();
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    async geocode(input) {
        const query = this.buildQuery(input);
        if (!query) {
            return null;
        }
        const cacheKey = query.toLowerCase();
        if (this.memoryCache.has(cacheKey)) {
            return this.memoryCache.get(cacheKey) ?? null;
        }
        const remote = await this.geocodeRemote(query);
        const result = remote ?? this.geocodeLocal(input);
        this.memoryCache.set(cacheKey, result);
        return result;
    }
    async geocodeRemote(query) {
        if (this.configService.get('geocoding.provider', 'local') !== 'nominatim') {
            return null;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.configService.get('geocoding.timeoutMs', 3500));
        try {
            const baseUrl = this.configService.get('geocoding.nominatimBaseUrl', 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
            const url = new URL('/search', baseUrl);
            url.searchParams.set('format', 'jsonv2');
            url.searchParams.set('limit', '1');
            url.searchParams.set('countrycodes', 'ar');
            url.searchParams.set('q', query);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'busca.ar-real-estate-dev/1.0',
                },
            });
            if (!response.ok) {
                return null;
            }
            const payload = (await response.json());
            const first = payload[0];
            const latitude = Number(first?.lat);
            const longitude = Number(first?.lon);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return null;
            }
            return {
                latitude,
                longitude,
                precision: this.mapNominatimPrecision(first),
                provider: 'nominatim',
            };
        }
        catch (error) {
            this.logger.warn('geocoding provider failed, falling back to local resolver', {
                module: 'GeocodingService',
                action: 'geocoding_remote_failed',
                error: error instanceof Error ? error.message : 'unknown',
            });
            return null;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    geocodeLocal(input) {
        const location = this.buildQuery(input);
        if (!location) {
            return null;
        }
        const streetCoords = this.resolveStreetBlockCoords(location);
        if (streetCoords) {
            return {
                latitude: streetCoords[0],
                longitude: streetCoords[1],
                precision: 'street',
                provider: 'local',
            };
        }
        const normalized = location.toLowerCase();
        const key = Object.keys(NEIGHBORHOOD_COORDS).find((item) => normalized.includes(item));
        if (!key) {
            return null;
        }
        const coords = NEIGHBORHOOD_COORDS[key];
        return {
            latitude: coords[0],
            longitude: coords[1],
            precision: 'neighborhood',
            provider: 'local',
        };
    }
    buildQuery(input) {
        return [
            input.locationText,
            input.neighborhood,
            input.city,
            input.province,
            input.country ?? 'Argentina',
        ]
            .filter((value) => Boolean(value?.trim()))
            .join(', ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    resolveStreetBlockCoords(location) {
        const numberMatch = location.match(/\b(\d{3,5})\b/);
        const streetNumber = numberMatch ? Number(numberMatch[1]) : null;
        if (streetNumber === null) {
            return null;
        }
        for (const street of STREET_BLOCK_COORDS) {
            if (!street.pattern.test(location)) {
                continue;
            }
            const block = street.blocks.find((item) => streetNumber >= item.min && streetNumber <= item.max);
            if (block) {
                return block.coords;
            }
        }
        return null;
    }
    mapNominatimPrecision(result) {
        const type = `${result?.addresstype ?? ''} ${result?.class ?? ''} ${result?.type ?? ''}`.toLowerCase();
        if (/house|building|address/.test(type)) {
            return 'exact';
        }
        if (/road|street|residential/.test(type)) {
            return 'street';
        }
        if (/suburb|neighbourhood|neighborhood|quarter|city/.test(type)) {
            return 'neighborhood';
        }
        return 'unknown';
    }
};
exports.GeocodingService = GeocodingService;
exports.GeocodingService = GeocodingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], GeocodingService);
