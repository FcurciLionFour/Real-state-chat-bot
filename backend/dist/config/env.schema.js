"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const Joi = require("joi");
const envSchema = Joi.object({
    PORT: Joi.number().integer().positive().default(3000),
    FRONTEND_URL: Joi.string().uri().required(),
    TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
    DATABASE_URL: Joi.string().required(),
    REDIS_URL: Joi.string().uri().required(),
    OPENAI_API_KEY: Joi.string().allow('').required(),
    OPENAI_MODEL: Joi.string().default('gpt-4.1-mini'),
    OPENAI_MOCK_MODE: Joi.boolean().truthy('true').falsy('false').default(false),
    SEARCH_DISCOVERY_PROVIDER: Joi.string()
        .valid('google-programmable-search', 'vertex-ai-search')
        .default('google-programmable-search'),
    PYTHON_SCRAPER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
    PYTHON_SCRAPER_BASE_URL: Joi.string().uri().allow('').default(''),
    PYTHON_SCRAPER_TIMEOUT_MS: Joi.number().integer().positive().default(15000),
    PYTHON_SCRAPER_INTERNAL_TOKEN: Joi.string()
        .allow('')
        .custom((value, helpers) => validateOptionalInternalToken(value, helpers), 'python scraper internal token validation')
        .default(''),
    PYTHON_SCRAPER_ALLOW_BROWSER_FALLBACK: Joi.boolean().truthy('true').falsy('false').default(false),
    GOOGLE_SEARCH_API_KEY: Joi.string().allow('').required(),
    GOOGLE_SEARCH_ENGINE_ID: Joi.string().allow('').required(),
    VERTEX_AI_SEARCH_API_KEY: Joi.string().allow('').default(''),
    VERTEX_AI_SEARCH_PROJECT_ID: Joi.string().allow('').default(''),
    VERTEX_AI_SEARCH_LOCATION: Joi.string().default('global'),
    VERTEX_AI_SEARCH_COLLECTION: Joi.string().default('default_collection'),
    VERTEX_AI_SEARCH_APP_ID: Joi.string().allow('').default(''),
    VERTEX_AI_SEARCH_SERVING_CONFIG: Joi.string().default('default_search'),
    JWT_ACCESS_SECRET: Joi.string()
        .required()
        .custom((value, helpers) => validateJwtSecret(value, 'JWT_ACCESS_SECRET', helpers), 'jwt access secret validation'),
    JWT_REFRESH_SECRET: Joi.string()
        .required()
        .custom((value, helpers) => validateJwtSecret(value, 'JWT_REFRESH_SECRET', helpers), 'jwt refresh secret validation'),
    JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
    AUTH_REFRESH_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').optional(),
    AUTH_REFRESH_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
    AUTH_REFRESH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
    AUTH_REFRESH_COOKIE_PATH: Joi.string().pattern(/^\/.*/).default('/api/auth'),
}).unknown(true);
function validateEnv(config) {
    const { error, value } = envSchema.validate(config, {
        abortEarly: false,
    });
    if (error) {
        throw new Error(`Invalid environment configuration: ${error.message}`);
    }
    return value;
}
function validateJwtSecret(value, envName, helpers) {
    const normalized = value.trim();
    if (normalized.length < 32) {
        return helpers.error('any.invalid', {
            message: `${envName} must be at least 32 characters long`,
        });
    }
    if (isWeakSecret(normalized)) {
        return helpers.error('any.invalid', {
            message: `${envName} must not use placeholder or weak secret values`,
        });
    }
    return normalized;
}
function validateOptionalInternalToken(value, helpers) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        return '';
    }
    if (normalized.length < 24) {
        return helpers.error('any.invalid', {
            message: 'PYTHON_SCRAPER_INTERNAL_TOKEN must be at least 24 characters long when configured',
        });
    }
    if (isWeakSecret(normalized)) {
        return helpers.error('any.invalid', {
            message: 'PYTHON_SCRAPER_INTERNAL_TOKEN must not use placeholder or weak secret values',
        });
    }
    return normalized;
}
function isWeakSecret(value) {
    const normalized = value.trim().toLowerCase();
    return (normalized.length === 0 ||
        normalized.includes('change-me') ||
        normalized.includes('changeme') ||
        normalized.includes('replace-me') ||
        normalized.includes('example') ||
        normalized.includes('secret') ||
        normalized.includes('password') ||
        normalized.includes('default'));
}
