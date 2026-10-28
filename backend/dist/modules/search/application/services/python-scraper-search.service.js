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
var PythonScraperSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonScraperSearchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const PYTHON_SCRAPER_SUPPORTED_SOURCES = ['argenprop', 'zonaprop', 'mudafy', 'properati'];
let PythonScraperSearchService = PythonScraperSearchService_1 = class PythonScraperSearchService {
    configService;
    logger;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    isEnabled() {
        return this.configService.get('search.pythonScraperEnabled', false);
    }
    isConfigured() {
        return this.baseUrl.length > 0;
    }
    async search(searchState) {
        if (!this.isEnabled()) {
            throw new Error('python_scraper_disabled');
        }
        if (!this.isConfigured()) {
            throw new Error('python_scraper_not_configured');
        }
        const startedAt = Date.now();
        const response = await fetch(new URL('/v1/search', this.baseUrl).toString(), {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify({
                requestId: `backend-${Date.now()}`,
                conversationId: null,
                searchRunId: null,
                filters: {
                    operation: this.mapOperationToPython(searchState.operation),
                    propertyType: this.mapPropertyTypeToPython(searchState.propertyTypes[0] ?? null),
                    locations: searchState.locations,
                    priceMin: searchState.priceMin,
                    priceMax: searchState.priceMax,
                    currency: searchState.currency,
                    rooms: searchState.rooms,
                    bedrooms: searchState.bedrooms,
                    bathrooms: searchState.bathrooms,
                    features: searchState.features.map((feature) => this.mapFeatureToPython(feature)),
                    areaMin: searchState.areaMin,
                    areaMax: searchState.areaMax,
                },
                sources: this.sources,
                discovery: {
                    providers: ['portal-native'],
                    allowDomains: [],
                    maxCandidateUrls: 40,
                },
                execution: {
                    limitPerSource: 10,
                    timeoutMs: 12000,
                    preferDetailPages: true,
                    allowBrowserFallback: this.allowBrowserFallback,
                },
            }),
            signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
            throw new Error(`python_scraper_http_${response.status}`);
        }
        const payload = (await response.json());
        const items = payload.items.map((item) => this.normalizeForSearchContext(this.mapResultItem(item), searchState));
        this.logger.logEvent('python scraper search completed', {
            module: 'PythonScraperSearchService',
            action: 'python_scraper_search_completed',
            baseUrl: this.baseUrl,
            requestedSources: this.sources,
            resultCount: items.length,
            sourcesUsed: payload.meta.sourcesUsed ?? [],
            partialFailureCount: payload.meta.partialFailures?.length ?? 0,
            durationMs: Date.now() - startedAt,
        }, PythonScraperSearchService_1.name);
        return {
            items,
            sourcesUsed: payload.meta.sourcesUsed ?? Array.from(new Set(items.map((item) => item.source))),
            partialFailures: payload.meta.partialFailures ?? [],
        };
    }
    mapResultItem(item) {
        const title = this.cleanText(item.title) ?? item.title.trim();
        const description = this.cleanText(item.description ?? null);
        const publisher = this.cleanText(item.publisher ?? null);
        const locationText = this.cleanText(item.locationText ?? null);
        const city = this.cleanText(item.city ?? null);
        const neighborhood = this.cleanText(item.neighborhood ?? null);
        const textForOperation = [title, description, item.sourceUrl].filter(Boolean).join(' ');
        const textForPropertyType = [title, item.sourceUrl].filter(Boolean).join(' ');
        return {
            externalId: item.externalId ?? null,
            source: item.source,
            sourceUrl: item.sourceUrl,
            publisher,
            contactPhone: item.contactPhone ?? null,
            contactWhatsApp: item.contactWhatsApp ?? null,
            title,
            description,
            operation: this.inferOperation(item.operation, textForOperation),
            propertyType: this.inferPropertyType(item.propertyType, textForPropertyType),
            price: item.price ?? null,
            currency: this.inferCurrency(item.currency, [title, description].filter(Boolean).join(' ')),
            expenses: item.expenses ?? null,
            city,
            neighborhood,
            locationText,
            rooms: item.rooms ?? null,
            bedrooms: item.bedrooms ?? null,
            bathrooms: item.bathrooms ?? null,
            areaTotal: item.areaTotal ?? null,
            areaCovered: item.areaCovered ?? null,
            features: (item.features ?? [])
                .map((feature) => this.mapFeatureFromPython(feature))
                .filter((feature) => feature !== null),
            images: item.images ?? [],
            scrapedAt: item.scrapedAt,
            publishedAt: item.publishedAt ?? null,
        };
    }
    normalizeForSearchContext(item, searchState) {
        return {
            ...item,
            operation: item.operation ?? searchState.operation ?? null,
            propertyType: item.propertyType ??
                (searchState.propertyTypes.length === 1 ? searchState.propertyTypes[0] ?? null : null),
            currency: item.currency ?? (item.price !== null ? searchState.currency ?? null : null),
        };
    }
    mapOperationToPython(value) {
        if (value === 'BUY') {
            return 'buy';
        }
        if (value === 'RENT') {
            return 'rent';
        }
        return null;
    }
    mapOperationFromPython(value) {
        if (value === 'buy') {
            return 'BUY';
        }
        if (value === 'rent') {
            return 'RENT';
        }
        return null;
    }
    inferOperation(value, text) {
        const mapped = this.mapOperationFromPython(value);
        if (mapped) {
            return mapped;
        }
        const normalized = this.normalizeSearchText(text);
        if (/\bventa\b|\bcomprar\b/.test(normalized)) {
            return 'BUY';
        }
        if (/\balquiler\b|\brenta\b/.test(normalized)) {
            return 'RENT';
        }
        return null;
    }
    mapPropertyTypeToPython(value) {
        switch (value) {
            case 'APARTMENT':
                return 'apartment';
            case 'HOUSE':
                return 'house';
            case 'PH':
                return 'ph';
            case 'LAND':
                return 'land';
            case 'OFFICE':
                return 'office';
            case 'LOCAL':
                return 'local';
            case 'GARAGE':
                return 'garage';
            default:
                return null;
        }
    }
    mapPropertyTypeFromPython(value) {
        switch ((value ?? '').toLowerCase()) {
            case 'apartment':
                return 'APARTMENT';
            case 'house':
                return 'HOUSE';
            case 'ph':
                return 'PH';
            case 'land':
                return 'LAND';
            case 'office':
                return 'OFFICE';
            case 'local':
                return 'LOCAL';
            case 'garage':
                return 'GARAGE';
            default:
                return null;
        }
    }
    inferPropertyType(value, text) {
        const explicit = this.detectPropertyTypeFromText(text);
        const mapped = this.mapPropertyTypeFromPython(value);
        if (explicit) {
            if (!mapped) {
                return explicit;
            }
            if (mapped === 'GARAGE' && explicit !== 'GARAGE') {
                return explicit;
            }
            return mapped;
        }
        return mapped;
    }
    mapCurrencyFromPython(value) {
        return value === 'USD' || value === 'ARS' ? value : null;
    }
    inferCurrency(value, text) {
        const mapped = this.mapCurrencyFromPython(value);
        if (mapped) {
            return mapped;
        }
        const normalized = this.normalizeSearchText(text);
        if (/\busd\b|\bu\$s\b|\bus\$\b/.test(normalized)) {
            return 'USD';
        }
        if (/\bars\b|\bpesos\b/.test(normalized)) {
            return 'ARS';
        }
        return null;
    }
    mapFeatureToPython(value) {
        switch (value) {
            case 'BALCONY':
                return 'balcony';
            case 'TERRACE':
                return 'terrace';
            case 'PATIO':
                return 'patio';
            case 'GARAGE':
                return 'garage';
            case 'POOL':
                return 'pool';
            case 'BARBECUE':
                return 'barbecue';
            case 'GYM':
                return 'gym';
            case 'PROFESSIONAL_USE':
                return 'professional_use';
            case 'MORTGAGE_ELIGIBLE':
                return 'mortgage_eligible';
            case 'FURNISHED':
                return 'furnished';
            case 'PETS_ALLOWED':
                return 'pets_allowed';
        }
    }
    mapFeatureFromPython(value) {
        switch (value.toLowerCase()) {
            case 'balcony':
                return 'BALCONY';
            case 'terrace':
                return 'TERRACE';
            case 'patio':
                return 'PATIO';
            case 'garage':
                return 'GARAGE';
            case 'pool':
                return 'POOL';
            case 'barbecue':
                return 'BARBECUE';
            case 'gym':
                return 'GYM';
            case 'professional_use':
                return 'PROFESSIONAL_USE';
            case 'mortgage_eligible':
                return 'MORTGAGE_ELIGIBLE';
            case 'furnished':
                return 'FURNISHED';
            case 'pets_allowed':
                return 'PETS_ALLOWED';
            default:
                return null;
        }
    }
    detectPropertyTypeFromText(text) {
        const normalized = this.normalizeSearchText(text);
        if (/\bph\b|\bp\.h\b/.test(normalized)) {
            return 'PH';
        }
        if (/\bdepartamento\b|\bdepto\b|\bpiso\b|\bsemipiso\b|\bmonoambiente\b/.test(normalized)) {
            return 'APARTMENT';
        }
        if (/\bcasa\b/.test(normalized)) {
            return 'HOUSE';
        }
        if (/\boficina\b/.test(normalized)) {
            return 'OFFICE';
        }
        if (/\blocal\b/.test(normalized)) {
            return 'LOCAL';
        }
        if (/\bterreno\b|\blote\b/.test(normalized)) {
            return 'LAND';
        }
        if (/\bcochera\b/.test(normalized)) {
            return 'GARAGE';
        }
        return null;
    }
    cleanText(value) {
        if (!value) {
            return null;
        }
        return this.repairMojibake(value).replace(/\s+/g, ' ').trim();
    }
    repairMojibake(value) {
        const candidates = [value];
        try {
            candidates.push(Buffer.from(value, 'latin1').toString('utf8'));
        }
        catch { }
        try {
            candidates.push(Buffer.from(value, 'binary').toString('utf8'));
        }
        catch { }
        return Array.from(new Set(candidates)).sort((left, right) => this.textQualityScore(left) - this.textQualityScore(right))[0];
    }
    textQualityScore(value) {
        const mojibakeMarkerCount = (value.match(/[ÃÂ�]/g) ?? []).length;
        const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
        return mojibakeMarkerCount + replacementCount;
    }
    normalizeSearchText(value) {
        return value
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^\w\s$]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    get baseUrl() {
        return this.configService.get('search.pythonScraperBaseUrl', '').trim().replace(/\/+$/, '');
    }
    get timeoutMs() {
        return this.configService.get('search.pythonScraperTimeoutMs', 15000);
    }
    get internalToken() {
        return this.configService.get('search.pythonScraperInternalToken', '').trim();
    }
    get allowBrowserFallback() {
        return this.configService.get('search.pythonScraperAllowBrowserFallback', false);
    }
    get sources() {
        const configuredSources = this.configService.get('search.pythonScraperSources', []);
        const normalizedSources = configuredSources
            .map((source) => source.trim().toLowerCase())
            .filter((source) => PYTHON_SCRAPER_SUPPORTED_SOURCES.includes(source));
        return normalizedSources.length > 0 ? Array.from(new Set(normalizedSources)) : [...PYTHON_SCRAPER_SUPPORTED_SOURCES];
    }
    buildHeaders() {
        return {
            'content-type': 'application/json',
            ...(this.internalToken ? { 'x-internal-token': this.internalToken } : {}),
        };
    }
};
exports.PythonScraperSearchService = PythonScraperSearchService;
exports.PythonScraperSearchService = PythonScraperSearchService = PythonScraperSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        logger_service_1.LoggerService])
], PythonScraperSearchService);
