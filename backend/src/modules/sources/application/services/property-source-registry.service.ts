import { Injectable } from '@nestjs/common';
import { PropertySourceAdapter } from '../../domain/interfaces/property-source-adapter.interface';
import { ArgenpropSourceAdapter } from '../../infrastructure/adapters/argenprop-source.adapter';
import { MudafySourceAdapter } from '../../infrastructure/adapters/mudafy-source.adapter';
import { ProperatiSourceAdapter } from '../../infrastructure/adapters/properati-source.adapter';
import { ZonapropSourceAdapter } from '../../infrastructure/adapters/zonaprop-source.adapter';

@Injectable()
export class PropertySourceRegistryService {
  private readonly adapters: PropertySourceAdapter[];

  constructor(
    private readonly zonapropSourceAdapter: ZonapropSourceAdapter,
    private readonly argenpropSourceAdapter: ArgenpropSourceAdapter,
    private readonly properatiSourceAdapter: ProperatiSourceAdapter,
    private readonly mudafySourceAdapter: MudafySourceAdapter,
  ) {
    this.adapters = [
      this.zonapropSourceAdapter,
      this.argenpropSourceAdapter,
      this.properatiSourceAdapter,
      this.mudafySourceAdapter,
    ];
  }

  getAdapters() {
    return [...this.adapters];
  }

  hasRegisteredAdapters() {
    return this.adapters.length > 0;
  }

  findAdapterForUrl(url: string) {
    return this.adapters.find((adapter) => adapter.canHandle(url)) ?? null;
  }

  filterSupportedUrls(urls: string[]) {
    const supportedEntries = urls
      .map((url) => ({
        url,
        adapter: this.findAdapterForUrl(url),
      }))
      .filter((entry): entry is { url: string; adapter: PropertySourceAdapter } => entry.adapter !== null);

    const detailEntries = supportedEntries.filter((entry) => entry.adapter.isDetailUrl?.(entry.url) ?? true);

    return (detailEntries.length > 0 ? detailEntries : supportedEntries).map((entry) => entry.url);
  }
}
