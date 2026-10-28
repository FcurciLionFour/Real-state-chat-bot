"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureApp = configureApp;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
function configureApp(app, configService, logger, requestContextService) {
    const frontendUrl = configService.get('app.frontendUrl', 'http://localhost:4200');
    const environment = configService.get('app.environment', 'development');
    const trustProxy = configService.get('app.trustProxy', false);
    const httpAdapter = app.getHttpAdapter();
    const adapterInstance = httpAdapter.getInstance?.();
    app.useLogger(logger);
    if (typeof adapterInstance?.disable === 'function') {
        adapterInstance.disable('x-powered-by');
    }
    if (trustProxy && typeof adapterInstance?.set === 'function') {
        adapterInstance.set('trust proxy', true);
    }
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: frontendUrl,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.use((_request, response, next) => {
        response.setHeader('x-content-type-options', 'nosniff');
        response.setHeader('x-frame-options', 'DENY');
        response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
        response.setHeader('cross-origin-opener-policy', 'same-origin');
        response.setHeader('cross-origin-resource-policy', 'same-site');
        response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
        response.setHeader('origin-agent-cluster', '?1');
        response.setHeader('cache-control', 'no-store, max-age=0');
        response.setHeader('pragma', 'no-cache');
        response.setHeader('expires', '0');
        if (environment === 'production') {
            response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
        }
        next();
    });
    app.use((request, response, next) => {
        const requestId = resolveRequestId(readHeader(request.headers['x-request-id']));
        const contextStore = {
            requestId,
            httpMethod: request.method,
            httpPath: request.originalUrl ?? request.url ?? '/',
        };
        response.setHeader('x-request-id', requestId);
        requestContextService.run(contextStore, () => {
            const startedAt = Date.now();
            logger.logEvent('http request started', {
                module: 'HttpServer',
                action: 'http_request_started',
            }, 'HttpServer');
            response.on('finish', () => {
                requestContextService.run(contextStore, () => {
                    requestContextService.set({ httpStatusCode: response.statusCode });
                    logger.logEvent('http request completed', {
                        module: 'HttpServer',
                        action: 'http_request_completed',
                        durationMs: Date.now() - startedAt,
                    }, 'HttpServer');
                });
            });
            next();
        });
    });
}
function readHeader(value) {
    if (Array.isArray(value)) {
        return value[0] ?? undefined;
    }
    return value;
}
function resolveRequestId(candidate) {
    const normalized = candidate?.trim();
    if (!normalized) {
        return (0, node_crypto_1.randomUUID)();
    }
    if (normalized.length > 120) {
        return (0, node_crypto_1.randomUUID)();
    }
    if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
        return (0, node_crypto_1.randomUUID)();
    }
    return normalized;
}
