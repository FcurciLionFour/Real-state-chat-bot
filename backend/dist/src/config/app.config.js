"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = void 0;
const configuration = () => ({
    app: {
        port: parseInt(process.env.PORT ?? '3000', 10),
        environment: process.env.NODE_ENV ?? 'development',
        frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
        trustProxy: readBooleanEnv(process.env.TRUST_PROXY, false),
    },
    database: {
        url: process.env.DATABASE_URL ?? '',
    },
    redis: {
        url: process.env.REDIS_URL ?? '',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY ?? '',
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        mockMode: process.env.OPENAI_MOCK_MODE === 'true',
    },
    search: {
        discoveryProvider: process.env.SEARCH_DISCOVERY_PROVIDER ?? 'google-programmable-search',
        pythonScraperEnabled: readBooleanEnv(process.env.PYTHON_SCRAPER_ENABLED, false),
        pythonScraperBaseUrl: process.env.PYTHON_SCRAPER_BASE_URL ?? '',
        pythonScraperTimeoutMs: parseInt(process.env.PYTHON_SCRAPER_TIMEOUT_MS ?? '15000', 10),
        pythonScraperInternalToken: process.env.PYTHON_SCRAPER_INTERNAL_TOKEN ?? '',
        pythonScraperSources: readCsvEnv(process.env.PYTHON_SCRAPER_SOURCES, ['argenprop']),
        pythonScraperAllowBrowserFallback: readBooleanEnv(process.env.PYTHON_SCRAPER_ALLOW_BROWSER_FALLBACK, false),
        mockFallbackEnabled: readBooleanEnv(process.env.SEARCH_MOCK_FALLBACK_ENABLED, false),
        googleApiKey: process.env.GOOGLE_SEARCH_API_KEY ?? '',
        googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID ?? '',
        vertexApiKey: process.env.VERTEX_AI_SEARCH_API_KEY ?? '',
        vertexProjectId: process.env.VERTEX_AI_SEARCH_PROJECT_ID ?? '',
        vertexLocation: process.env.VERTEX_AI_SEARCH_LOCATION ?? 'global',
        vertexCollection: process.env.VERTEX_AI_SEARCH_COLLECTION ?? 'default_collection',
        vertexAppId: process.env.VERTEX_AI_SEARCH_APP_ID ?? '',
        vertexServingConfig: process.env.VERTEX_AI_SEARCH_SERVING_CONFIG ?? 'default_search',
    },
    geocoding: {
        provider: process.env.GEOCODING_PROVIDER ?? 'local',
        googleApiKey: process.env.GEOCODING_GOOGLE_API_KEY ?? '',
        nominatimBaseUrl: process.env.GEOCODING_NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org',
        timeoutMs: parseInt(process.env.GEOCODING_TIMEOUT_MS ?? '3500', 10),
    },
    auth: {
        accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
        refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
        refreshCookie: {
            secure: readBooleanEnv(process.env.AUTH_REFRESH_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
            sameSite: readCookieSameSite(process.env.AUTH_REFRESH_COOKIE_SAME_SITE),
            domain: process.env.AUTH_REFRESH_COOKIE_DOMAIN?.trim() || null,
            path: process.env.AUTH_REFRESH_COOKIE_PATH?.trim() || '/api/auth',
        },
    },
});
exports.configuration = configuration;
function readBooleanEnv(value, fallback) {
    if (!value) {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    return fallback;
}
function readCookieSameSite(value) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'strict' || normalized === 'none') {
        return normalized;
    }
    return 'lax';
}
function readCsvEnv(value, fallback) {
    if (!value) {
        return fallback;
    }
    const items = value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0);
    return items.length > 0 ? Array.from(new Set(items)) : fallback;
}
