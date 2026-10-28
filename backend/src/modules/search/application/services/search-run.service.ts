import { Injectable, Optional } from '@nestjs/common';
import { Prisma, PropertyCache, SearchRunProperty, SearchRunStatus } from '@prisma/client';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { SearchResultItem } from '../../domain/types/search-result.type';
import { SearchRunsRepository } from '../../infrastructure/repositories/search-runs.repository';
import { SearchRunPropertiesRepository } from '../../infrastructure/repositories/search-run-properties.repository';

type PersistSearchRunInput = {
  conversationId: string;
  filtersSnapshot: Prisma.InputJsonValue;
  queryText: string;
  sourcesUsed: string[];
  results: Array<{
    propertyCacheId: string;
    rank: SearchResultItem['rank'];
  }>;
};

@Injectable()
export class SearchRunService {
  constructor(
    private readonly searchRunsRepository: SearchRunsRepository,
    private readonly searchRunPropertiesRepository: SearchRunPropertiesRepository,
    private readonly logger: LoggerService,
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  async persistSearchRun(input: PersistSearchRunInput) {
    const searchRun = await this.searchRunsRepository.create({
      conversationId: input.conversationId,
      filtersSnapshotJson: input.filtersSnapshot,
      queryText: input.queryText,
      resultCount: input.results.length,
      sourcesUsedJson: input.sourcesUsed,
      status: SearchRunStatus.COMPLETED,
    });

    await this.searchRunPropertiesRepository.createMany(
      input.results.map((result) => ({
        searchRunId: searchRun.id,
        propertyCacheId: result.propertyCacheId,
        position: result.rank.position,
        rankScore: result.rank.score,
        rankReasonJson: this.buildRankReasonJson(result.rank),
      })),
    );
    this.requestContextService?.set({ searchRunId: searchRun.id });

    this.logger.logEvent(
      'search run persisted',
      {
        module: 'SearchRunService',
        action: 'search_run_persisted',
        conversationId: input.conversationId,
        searchRunId: searchRun.id,
        resultCount: input.results.length,
        sourcesUsed: input.sourcesUsed,
      },
      SearchRunService.name,
    );

    return searchRun;
  }

  persistMockSearchRun(input: PersistSearchRunInput) {
    return this.persistSearchRun(input);
  }

  async getLatestResultsByConversationId(conversationId: string) {
    const searchRun = await this.searchRunsRepository.findLatestByConversationId(conversationId);

    if (!searchRun) {
      return null;
    }

    return {
      searchRun: {
        id: searchRun.id,
        status: searchRun.status,
        resultCount: searchRun.resultCount,
        createdAt: searchRun.createdAt,
      },
      results: searchRun.results.map((item) => this.serializeSearchRunProperty(item)),
    };
  }

  private buildRankReasonJson(rank: SearchResultItem['rank']) {
    return {
      reasons: rank.reasons,
      ...(rank.reasonDetails ?? {}),
    } satisfies Prisma.InputJsonValue;
  }

  private serializeSearchRunProperty(item: SearchRunProperty & { propertyCache: PropertyCache }) {
    const property = item.propertyCache;
    const rankReasonJson = this.readRankReasonJson(item.rankReasonJson);

    return {
      propertyId: property.id,
      source: property.source,
      sourceUrl: property.sourceUrl,
      publisher: property.publisher,
      contactPhone: property.contactPhone,
      contactWhatsApp: property.contactWhatsApp,
      title: property.title,
      operation: property.operation,
      propertyType: property.propertyType,
      price: property.priceAmount === null ? null : Number(property.priceAmount),
      currency: property.priceCurrency,
      expenses: property.expensesAmount === null ? null : Number(property.expensesAmount),
      city: property.city,
      neighborhood: property.neighborhood,
      locationText: property.locationText,
      geo:
        property.latitude !== null && property.longitude !== null
          ? {
              latitude: Number(property.latitude),
              longitude: Number(property.longitude),
              precision: property.geoPrecision ?? 'unknown',
              provider: property.geocodingProvider ?? 'unknown',
              geocodedAt: property.geocodedAt,
            }
          : null,
      rooms: property.rooms === null ? null : Number(property.rooms),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaTotal: property.areaTotal === null ? null : Number(property.areaTotal),
      areaCovered: property.areaCovered === null ? null : Number(property.areaCovered),
      features: Array.isArray(property.featuresJson) ? property.featuresJson : [],
      images: Array.isArray(property.imagesJson) ? property.imagesJson : [],
      scrapedAt: property.scrapedAt,
      publishedAt: property.publishedAt,
      rank: {
        position: item.position,
        score: Number(item.rankScore),
        reasons: rankReasonJson.reasons,
      },
    };
  }

  private readRankReasonJson(value: Prisma.JsonValue) {
    const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const reasons = Array.isArray((payload as { reasons?: unknown }).reasons)
      ? (payload as { reasons: unknown[] }).reasons.filter((reason): reason is string => typeof reason === 'string')
      : [];

    return {
      reasons,
    };
  }
}
