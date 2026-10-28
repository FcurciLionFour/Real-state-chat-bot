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
exports.SearchGeoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const DEFAULT_PROXIMITY_RADIUS_METERS = 1000;
const LOCAL_PLACES = [
    {
        aliases: ['alto palermo', 'alto palermo shopping'],
        label: 'Alto Palermo Shopping',
        province: 'CABA',
        city: 'CABA',
        neighborhood: 'Palermo',
        latitude: -34.5881,
        longitude: -58.4106,
        confidence: 0.95,
    },
    {
        aliases: ['bosques de palermo', 'bosque de palermo', 'parque tres de febrero'],
        label: 'Bosques de Palermo',
        province: 'CABA',
        city: 'CABA',
        neighborhood: 'Palermo',
        latitude: -34.5697,
        longitude: -58.4173,
        confidence: 0.9,
    },
    {
        aliases: ['palermo'],
        label: 'Palermo',
        province: 'CABA',
        city: 'CABA',
        neighborhood: 'Palermo',
        latitude: -34.5889,
        longitude: -58.4306,
        confidence: 0.82,
    },
];
const LOCAL_NEIGHBORHOODS = {
    palermo: { province: 'CABA', city: 'CABA', latitude: -34.5889, longitude: -58.4306 },
    recoleta: { province: 'CABA', city: 'CABA', latitude: -34.5883, longitude: -58.3974 },
    caballito: { province: 'CABA', city: 'CABA', latitude: -34.6187, longitude: -58.4431 },
    almagro: { province: 'CABA', city: 'CABA', latitude: -34.6094, longitude: -58.4217 },
    belgrano: { province: 'CABA', city: 'CABA', latitude: -34.5627, longitude: -58.4583 },
    'villa crespo': { province: 'CABA', city: 'CABA', latitude: -34.5985, longitude: -58.4427 },
};
let SearchGeoService = class SearchGeoService {
    configService;
    logger;
    memoryCache = new Map();
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    async enrichSearchState(searchState) {
        const nextState = structuredClone(searchState);
        const currentConstraints = nextState.geoConstraints ?? [];
        const constraints = currentConstraints.length > 0
            ? currentConstraints
            : this.buildAreaConstraintsFromLocations(nextState.locations);
        nextState.geoConstraints = await Promise.all(constraints.map((constraint) => this.resolveConstraint(constraint)));
        return nextState;
    }
    async enrichCandidates(candidates) {
        return candidates.map((candidate) => this.enrichCandidate(candidate));
    }
    async resolveConstraint(constraint) {
        if (this.isResolved(constraint)) {
            return this.normalizeConstraintDefaults(constraint);
        }
        const cacheKey = `${constraint.kind}:${constraint.sourceText}:${constraint.city ?? ''}:${constraint.province ?? ''}`.toLowerCase();
        if (this.memoryCache.has(cacheKey)) {
            return this.memoryCache.get(cacheKey) ?? this.normalizeConstraintDefaults(constraint);
        }
        const local = this.resolveLocalPlace(constraint);
        if (local) {
            this.memoryCache.set(cacheKey, local);
            return local;
        }
        const google = await this.resolveWithGoogle(constraint);
        const resolved = google ?? this.normalizeConstraintDefaults(constraint);
        this.memoryCache.set(cacheKey, resolved);
        return resolved;
    }
    buildAreaConstraintsFromLocations(locations) {
        return locations
            .map((location) => this.resolveLocalNeighborhood(location))
            .filter((constraint) => constraint !== null);
    }
    resolveLocalPlace(constraint) {
        const normalizedSource = this.normalizeText(`${constraint.sourceText} ${constraint.label}`);
        const place = LOCAL_PLACES.find((item) => item.aliases.some((alias) => normalizedSource.includes(alias)));
        if (!place) {
            return this.resolveLocalNeighborhood(constraint.sourceText) ?? this.resolveLocalNeighborhood(constraint.label);
        }
        return {
            ...constraint,
            label: place.label,
            province: place.province,
            city: place.city,
            neighborhood: place.neighborhood,
            latitude: place.latitude,
            longitude: place.longitude,
            radiusMeters: constraint.kind === 'PROXIMITY'
                ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
                : constraint.radiusMeters,
            confidence: Math.max(constraint.confidence, place.confidence),
            provider: 'local-poi',
        };
    }
    resolveLocalNeighborhood(value) {
        const normalized = this.normalizeText(value);
        const key = Object.keys(LOCAL_NEIGHBORHOODS).find((item) => normalized.includes(item));
        if (!key) {
            return null;
        }
        const neighborhood = LOCAL_NEIGHBORHOODS[key];
        return {
            kind: 'AREA',
            sourceText: value,
            label: this.titleCase(key),
            province: neighborhood.province,
            city: neighborhood.city,
            neighborhood: this.titleCase(key),
            latitude: neighborhood.latitude,
            longitude: neighborhood.longitude,
            radiusMeters: null,
            confidence: 0.8,
            provider: 'local-neighborhood',
        };
    }
    async resolveWithGoogle(constraint) {
        if (this.configService.get('geocoding.provider', 'local') !== 'google') {
            return null;
        }
        const apiKey = this.configService.get('geocoding.googleApiKey', '').trim();
        if (!apiKey) {
            return null;
        }
        try {
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('address', this.buildGoogleQuery(constraint));
            url.searchParams.set('region', 'ar');
            url.searchParams.set('language', 'es');
            url.searchParams.set('components', 'country:AR');
            url.searchParams.set('key', apiKey);
            const response = await fetch(url, {
                signal: AbortSignal.timeout(this.configService.get('geocoding.timeoutMs', 3500)),
            });
            if (!response.ok) {
                return null;
            }
            const payload = (await response.json());
            const first = payload.results?.[0];
            const latitude = first?.geometry?.location?.lat;
            const longitude = first?.geometry?.location?.lng;
            if (!first || payload.status !== 'OK' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return null;
            }
            return {
                ...constraint,
                label: first.formatted_address ?? constraint.label,
                province: this.readGoogleComponent(first.address_components, ['administrative_area_level_1']) ?? constraint.province,
                city: this.readGoogleComponent(first.address_components, ['locality', 'administrative_area_level_2']) ??
                    constraint.city,
                neighborhood: this.readGoogleComponent(first.address_components, ['neighborhood', 'sublocality', 'sublocality_level_1']) ??
                    constraint.neighborhood,
                latitude: latitude,
                longitude: longitude,
                radiusMeters: constraint.kind === 'PROXIMITY'
                    ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
                    : constraint.radiusMeters,
                confidence: Math.max(constraint.confidence, 0.85),
                provider: 'google-geocoding',
            };
        }
        catch (error) {
            this.logger.warn('google geocoding failed for search geo constraint', {
                module: 'SearchGeoService',
                action: 'search_geo_google_failed',
                sourceText: constraint.sourceText,
                error: error instanceof Error ? error.message : 'unknown',
            });
            return null;
        }
    }
    enrichCandidate(candidate) {
        if (candidate.geo) {
            return candidate;
        }
        const location = this.normalizeText(`${candidate.locationText ?? ''} ${candidate.neighborhood ?? ''} ${candidate.city ?? ''} ${candidate.province ?? ''}`);
        const place = LOCAL_PLACES.find((item) => item.aliases.some((alias) => location.includes(alias)));
        if (place) {
            return {
                ...candidate,
                province: candidate.province ?? place.province,
                city: candidate.city ?? place.city,
                neighborhood: candidate.neighborhood ?? place.neighborhood,
                geo: {
                    latitude: place.latitude,
                    longitude: place.longitude,
                    precision: 'neighborhood',
                    provider: 'local-poi',
                },
            };
        }
        const neighborhoodKey = Object.keys(LOCAL_NEIGHBORHOODS).find((item) => location.includes(item));
        if (!neighborhoodKey) {
            return candidate;
        }
        const neighborhood = LOCAL_NEIGHBORHOODS[neighborhoodKey];
        return {
            ...candidate,
            province: candidate.province ?? neighborhood.province,
            city: candidate.city ?? neighborhood.city,
            neighborhood: candidate.neighborhood ?? this.titleCase(neighborhoodKey),
            geo: {
                latitude: neighborhood.latitude,
                longitude: neighborhood.longitude,
                precision: 'neighborhood',
                provider: 'local-neighborhood',
            },
        };
    }
    normalizeConstraintDefaults(constraint) {
        return {
            ...constraint,
            radiusMeters: constraint.kind === 'PROXIMITY'
                ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
                : constraint.radiusMeters,
            confidence: Number(Math.max(0, Math.min(1, constraint.confidence)).toFixed(2)),
        };
    }
    isResolved(constraint) {
        return Number.isFinite(constraint.latitude) && Number.isFinite(constraint.longitude);
    }
    buildGoogleQuery(constraint) {
        return [
            constraint.sourceText,
            constraint.neighborhood,
            constraint.city,
            constraint.province,
            'Argentina',
        ]
            .filter((value) => Boolean(value?.trim()))
            .join(', ');
    }
    readGoogleComponent(components, types) {
        if (!Array.isArray(components)) {
            return null;
        }
        const component = components.find((item) => item.types?.some((type) => types.includes(type)));
        return component?.long_name ?? component?.short_name ?? null;
    }
    normalizeText(value) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    titleCase(value) {
        return value
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
};
exports.SearchGeoService = SearchGeoService;
exports.SearchGeoService = SearchGeoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], SearchGeoService);
