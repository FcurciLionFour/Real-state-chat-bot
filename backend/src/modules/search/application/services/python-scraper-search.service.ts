import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyCode, OperationType, PropertyType } from '@prisma/client';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { PropertyFeature, SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';

type PythonScraperResponse = {
  items: Array<{
    externalId?: string | null;
    source: string;
    sourceUrl: string;
    publisher?: string | null;
    contactPhone?: string | null;
    contactWhatsApp?: string | null;
    title: string;
    description?: string | null;
    operation?: string | null;
    propertyType?: string | null;
    price?: number | null;
    currency?: string | null;
    expenses?: number | null;
    locationText?: string | null;
    city?: string | null;
    neighborhood?: string | null;
    rooms?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    areaTotal?: number | null;
    areaCovered?: number | null;
    features?: string[];
    images?: string[];
    publishedAt?: string | null;
    scrapedAt: string;
  }>;
  meta: {
    sourcesUsed?: string[];
    partialFailures?: Array<{
      source: string;
      stage: string;
      reason: string;
    }>;
  };
};

type PythonScraperSearchResult = {
  items: Array<Omit<SearchResultItem, 'rank'>>;
  sourcesUsed: string[];
  partialFailures: Array<{
    source: string;
    stage: string;
    reason: string;
  }>;
};

const PYTHON_SCRAPER_SUPPORTED_SOURCES = ['argenprop', 'zonaprop', 'mudafy', 'properati'] as const;
type PythonScraperSourceName = (typeof PYTHON_SCRAPER_SUPPORTED_SOURCES)[number];

@Injectable()
export class PythonScraperSearchService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  isEnabled() {
    return this.configService.get<boolean>('search.pythonScraperEnabled', false);
  }

  isConfigured() {
    return this.baseUrl.length > 0;
  }

  async search(searchState: SearchFilters): Promise<PythonScraperSearchResult> {
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
          locations: this.buildPythonLocations(searchState),
          priceMin: searchState.priceMin,
          priceMax: searchState.priceMax,
          currency: searchState.currency,
          rooms: searchState.rooms ?? ((searchState.roomsAnyOf ?? []).length === 1 ? searchState.roomsAnyOf?.[0] : null),
          roomsAnyOf: searchState.roomsAnyOf ?? [],
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

    const payload = (await response.json()) as PythonScraperResponse;
    const items = payload.items.map((item) => this.normalizeForSearchContext(this.mapResultItem(item), searchState));

    this.logger.logEvent(
      'python scraper search completed',
      {
        module: 'PythonScraperSearchService',
        action: 'python_scraper_search_completed',
        baseUrl: this.baseUrl,
        requestedSources: this.sources,
        resultCount: items.length,
        sourcesUsed: payload.meta.sourcesUsed ?? [],
        partialFailureCount: payload.meta.partialFailures?.length ?? 0,
        durationMs: Date.now() - startedAt,
      },
      PythonScraperSearchService.name,
    );

    return {
      items,
      sourcesUsed: payload.meta.sourcesUsed ?? Array.from(new Set(items.map((item) => item.source))),
      partialFailures: payload.meta.partialFailures ?? [],
    };
  }

  private mapResultItem(item: PythonScraperResponse['items'][number]): Omit<SearchResultItem, 'rank'> {
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
        .filter((feature): feature is PropertyFeature => feature !== null),
      images: item.images ?? [],
      scrapedAt: item.scrapedAt,
      publishedAt: item.publishedAt ?? null,
    };
  }

  private normalizeForSearchContext(item: Omit<SearchResultItem, 'rank'>, searchState: SearchFilters) {
    return {
      ...item,
      operation: item.operation ?? searchState.operation ?? null,
      propertyType:
        item.propertyType ??
        (searchState.propertyTypes.length === 1 ? searchState.propertyTypes[0] ?? null : null),
      currency: item.currency ?? (item.price !== null ? searchState.currency ?? null : null),
    } satisfies Omit<SearchResultItem, 'rank'>;
  }

  private mapOperationToPython(value: OperationType | null) {
    if (value === 'BUY') {
      return 'buy';
    }

    if (value === 'RENT') {
      return 'rent';
    }

    return null;
  }

  private buildPythonLocations(searchState: SearchFilters) {
    const geoLocations = (searchState.geoConstraints ?? []).flatMap((constraint) =>
      [
        constraint.neighborhood,
        constraint.city === 'CABA' || constraint.province === 'CABA' ? 'Capital Federal' : constraint.city,
      ].filter((value): value is string => Boolean(value?.trim())),
    );

    return Array.from(new Set([...geoLocations, ...searchState.locations]));
  }

  private mapOperationFromPython(value: string | null | undefined): OperationType | null {
    if (value === 'buy') {
      return 'BUY';
    }

    if (value === 'rent') {
      return 'RENT';
    }

    return null;
  }

  private inferOperation(value: string | null | undefined, text: string): OperationType | null {
    const normalized = this.normalizeSearchText(text);
    if (/\bventa\b|\bcomprar\b/.test(normalized)) {
      return 'BUY';
    }

    if (/\balquiler\b|\brenta\b/.test(normalized)) {
      return 'RENT';
    }

    return this.mapOperationFromPython(value);
  }

  private mapPropertyTypeToPython(value: PropertyType | null) {
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

  private mapPropertyTypeFromPython(value: string | null | undefined): PropertyType | null {
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

  private inferPropertyType(value: string | null | undefined, text: string): PropertyType | null {
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

  private mapCurrencyFromPython(value: string | null | undefined): CurrencyCode | null {
    return value === 'USD' || value === 'ARS' ? value : null;
  }

  private inferCurrency(value: string | null | undefined, text: string): CurrencyCode | null {
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

  private mapFeatureToPython(value: PropertyFeature) {
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

  private mapFeatureFromPython(value: string): PropertyFeature | null {
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

  private detectPropertyTypeFromText(text: string): PropertyType | null {
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

  private cleanText(value: string | null) {
    if (!value) {
      return null;
    }

    return this.repairMojibake(value).replace(/\s+/g, ' ').trim();
  }

  private repairMojibake(value: string) {
    const candidates = [value];

    try {
      candidates.push(Buffer.from(value, 'latin1').toString('utf8'));
    } catch {}

    try {
      candidates.push(Buffer.from(value, 'binary').toString('utf8'));
    } catch {}

    return Array.from(new Set(candidates)).sort((left, right) => this.textQualityScore(left) - this.textQualityScore(right))[0]!;
  }

  private textQualityScore(value: string) {
    const mojibakeMarkerCount = (value.match(/[ÃÂ�]/g) ?? []).length;
    const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
    return mojibakeMarkerCount + replacementCount;
  }

  private normalizeSearchText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s$]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private get baseUrl() {
    return this.configService.get<string>('search.pythonScraperBaseUrl', '').trim().replace(/\/+$/, '');
  }

  private get timeoutMs() {
    return this.configService.get<number>('search.pythonScraperTimeoutMs', 15000);
  }

  private get internalToken() {
    return this.configService.get<string>('search.pythonScraperInternalToken', '').trim();
  }

  private get allowBrowserFallback() {
    return this.configService.get<boolean>('search.pythonScraperAllowBrowserFallback', false);
  }

  private get sources(): PythonScraperSourceName[] {
    const configuredSources = this.configService.get<string[]>('search.pythonScraperSources', []);
    const normalizedSources = configuredSources
      .map((source) => source.trim().toLowerCase())
      .filter((source): source is PythonScraperSourceName =>
        PYTHON_SCRAPER_SUPPORTED_SOURCES.includes(source as PythonScraperSourceName),
      );

    return normalizedSources.length > 0 ? Array.from(new Set(normalizedSources)) : [...PYTHON_SCRAPER_SUPPORTED_SOURCES];
  }

  private buildHeaders() {
    return {
      'content-type': 'application/json',
      ...(this.internalToken ? { 'x-internal-token': this.internalToken } : {}),
    };
  }
}
