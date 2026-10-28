import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { LoggerService } from '../infrastructure/observability/logger.service';
import { RequestContextService } from '../infrastructure/observability/request-context.service';

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url?: string;
};

type HttpResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  on: (event: 'finish', listener: () => void) => void;
};

export function configureApp(
  app: INestApplication,
  configService: ConfigService,
  logger: LoggerService,
  requestContextService: RequestContextService,
) {
  const frontendUrl = configService.get<string>('app.frontendUrl', 'http://localhost:4200');
  const environment = configService.get<string>('app.environment', 'development');
  const trustProxy = configService.get<boolean>('app.trustProxy', false);
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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use((_request: HttpRequest, response: HttpResponse, next: () => void) => {
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
  app.use((request: HttpRequest, response: HttpResponse, next: () => void) => {
    const requestId = resolveRequestId(readHeader(request.headers['x-request-id']));
    const contextStore = {
      requestId,
      httpMethod: request.method,
      httpPath: request.originalUrl ?? request.url ?? '/',
    };

    response.setHeader('x-request-id', requestId);

    requestContextService.run(contextStore, () => {
      const startedAt = Date.now();
      logger.logEvent(
        'http request started',
        {
          module: 'HttpServer',
          action: 'http_request_started',
        },
        'HttpServer',
      );

      response.on('finish', () => {
        requestContextService.run(contextStore, () => {
          requestContextService.set({ httpStatusCode: response.statusCode });
          logger.logEvent(
            'http request completed',
            {
              module: 'HttpServer',
              action: 'http_request_completed',
              durationMs: Date.now() - startedAt,
            },
            'HttpServer',
          );
        });
      });

      next();
    });
  });
}

function readHeader(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

function resolveRequestId(candidate?: string) {
  const normalized = candidate?.trim();

  if (!normalized) {
    return randomUUID();
  }

  if (normalized.length > 120) {
    return randomUUID();
  }

  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    return randomUUID();
  }

  return normalized;
}
