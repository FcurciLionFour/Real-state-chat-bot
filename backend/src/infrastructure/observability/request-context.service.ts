import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextStore = {
  requestId?: string;
  userId?: string;
  conversationId?: string;
  searchRunId?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(initialContext: RequestContextStore, callback: () => T) {
    return this.storage.run(initialContext, callback);
  }

  set(values: RequestContextStore) {
    const store = this.storage.getStore();

    if (!store) {
      return;
    }

    Object.assign(store, values);
  }

  get<K extends keyof RequestContextStore>(key: K) {
    return this.storage.getStore()?.[key];
  }

  snapshot() {
    const store = this.storage.getStore();
    return store ? { ...store } : null;
  }
}
