import { ConsoleLogger, Injectable, Optional } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

type LogListenerPayload = {
  level: 'log' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class LoggerService extends ConsoleLogger {
  private readonly listeners = new Set<(payload: LogListenerPayload) => void>();

  constructor(@Optional() private readonly requestContextService?: RequestContextService) {
    super();
  }

  subscribe(listener: (payload: LogListenerPayload) => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  logEvent(message: string, metadata: Record<string, unknown>, context?: string) {
    super.log(this.serialize('log', message, metadata), context);
  }

  warnEvent(message: string, metadata: Record<string, unknown>, context?: string) {
    super.warn(this.serialize('warn', message, metadata), context);
  }

  errorEvent(message: string, metadata: Record<string, unknown>, trace?: string, context?: string) {
    super.error(this.serialize('error', message, metadata), trace, context);
  }

  private serialize(level: 'log' | 'warn' | 'error', message: string, metadata: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.requestContextService?.snapshot() ?? {}),
      ...metadata,
    };

    for (const listener of this.listeners) {
      listener({
        level,
        message,
        metadata: payload,
      });
    }

    return JSON.stringify(payload);
  }
}
