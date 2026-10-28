import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { LoggerService } from './infrastructure/observability/logger.service';
import { RequestContextService } from './infrastructure/observability/request-context.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  const port = configService.get<number>('app.port', 3000);
  const frontendUrl = configService.get<string>('app.frontendUrl', 'http://localhost:4200');
  const environment = configService.get<string>('app.environment', 'development');
  const trustProxy = configService.get<boolean>('app.trustProxy', false);
  const openAiMode = configService.get<string>('openai.apiKey', '') ? 'real-api' : 'safe-fallback';
  const refreshCookieSecure = configService.get<boolean>('auth.refreshCookie.secure', false);
  const refreshCookieSameSite = configService.get<string>('auth.refreshCookie.sameSite', 'lax');

  configureApp(app, configService, logger, requestContextService);

  await app.listen(port);
  logger.log(`Backend listening on http://localhost:${port}/api`, 'Bootstrap');
  logger.log(`Environment: ${environment}`, 'Bootstrap');
  logger.log(`Frontend origin: ${frontendUrl}`, 'Bootstrap');
  logger.log(`Trust proxy: ${trustProxy ? 'enabled' : 'disabled'}`, 'Bootstrap');
  logger.log(
    `Refresh cookie policy: secure=${refreshCookieSecure}, sameSite=${refreshCookieSameSite}`,
    'Bootstrap',
  );
  logger.log(`OpenAI mode: ${openAiMode}`, 'Bootstrap');
}

void bootstrap();
