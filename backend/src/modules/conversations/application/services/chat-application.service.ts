import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { AiResponseGeneratorService } from '../../../ai/application/services/ai-response-generator.service';
import { SEARCH_FILTER_KEYS, SearchFilterKey } from '../../../ai/domain/types/search-decision.type';
import { AiSearchDecisionService } from '../../../ai/application/services/ai-search-decision.service';
import { MessagesService } from '../../../messages/application/services/messages.service';
import { SearchExecutionService } from '../../../search/application/services/search-execution.service';
import { SearchRunService } from '../../../search/application/services/search-run.service';
import { SearchResultItem } from '../../../search/domain/types/search-result.type';
import { SearchStateMergeService } from '../../../search-state/application/services/search-state-merge.service';
import { SearchStateService } from '../../../search-state/application/services/search-state.service';
import { PropertiesService } from '../../../properties/application/services/properties.service';
import { ConversationsService } from './conversations.service';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';

type StructuredSearchStatePatchInput = {
  filterPatch?: Record<string, unknown>;
  filtersToUnset?: string[];
  shouldSearch?: boolean;
};

@Injectable()
export class ChatApplicationService {
  constructor(
    private readonly aiSearchDecisionService: AiSearchDecisionService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly searchStateService: SearchStateService,
    private readonly searchStateMergeService: SearchStateMergeService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly propertiesService: PropertiesService,
    private readonly searchRunService: SearchRunService,
    @Optional() private readonly requestContextService?: RequestContextService,
    @Optional() private readonly aiResponseGeneratorService?: AiResponseGeneratorService,
  ) {}

  async sendMessage(userId: string, conversationId: string, message: string) {
    this.requestContextService?.set({ userId, conversationId });
    const conversation = await this.conversationsService.assertOwnership(userId, conversationId);

    await this.messagesService.createUserMessage(conversation.id, message);

    const currentState = await this.searchStateService.getOrCreateByConversationId(conversation.id);
    const searchDecision = await this.aiSearchDecisionService.decide({
      userMessage: message,
      searchState: currentState,
    });
    const mergeResult = this.searchStateMergeService.applySearchDecision(currentState, searchDecision);

    await this.searchStateService.updateByConversationId(conversation.id, mergeResult.searchState);

    const searchExecution = mergeResult.didSearch
      ? await this.searchExecutionService.execute(mergeResult.searchState)
      : null;
    const rawResults = searchExecution?.results ?? [];
    let searchRunId: string | null = null;
    let sourcesUsed: string[] = searchExecution?.sourcesUsed ?? [];

    const results = [];
    const persistedRankings = [];
    for (const rawResult of rawResults) {
      const property = await this.propertiesService.persistSearchResult(rawResult);
      results.push(this.serializeResult(property.id, rawResult));
      persistedRankings.push({
        propertyCacheId: property.id,
        rank: rawResult.rank,
      });
    }

    if (mergeResult.didSearch) {
      const searchRun = await this.searchRunService.persistSearchRun({
        conversationId: conversation.id,
        filtersSnapshot: mergeResult.searchState as Prisma.InputJsonValue,
        queryText: searchExecution?.queryText ?? 'busqueda inmobiliaria',
        sourcesUsed,
        results: persistedRankings,
      });

      searchRunId = searchRun.id;
      this.requestContextService?.set({ searchRunId: searchRun.id });
      await this.conversationsService.markSearchExecuted(conversation.id);
    }

    const assistantMessage = await this.generateAssistantMessage(
      message,
      mergeResult.searchState,
      mergeResult.didSearch,
      rawResults,
      mergeResult.assistantMessage,
    );

    const structuredPayload = {
      mode: 'ai',
      intent: searchDecision.intent,
      requestedAction: searchDecision.requestedAction,
      didSearch: mergeResult.didSearch,
      requiresClarification: mergeResult.requiresClarification,
      searchState: mergeResult.searchState,
      resultCount: results.length,
      searchRunId,
    } satisfies Prisma.JsonObject;

    await this.messagesService.createAssistantMessage(
      conversation.id,
      assistantMessage,
      structuredPayload as Prisma.InputJsonValue,
    );

    return {
      conversationId: conversation.id,
      assistantMessage,
      searchState: mergeResult.searchState,
      didSearch: mergeResult.didSearch,
      requiresClarification: mergeResult.requiresClarification,
      clarificationQuestion: mergeResult.clarificationQuestion,
      results,
      meta: {
        searchRunId,
        sourcesUsed,
        resultCount: results.length,
      },
    };
  }

  async patchSearchState(userId: string, conversationId: string, input: StructuredSearchStatePatchInput) {
    this.requestContextService?.set({ userId, conversationId });
    const conversation = await this.conversationsService.assertOwnership(userId, conversationId);
    const currentState = await this.searchStateService.getOrCreateByConversationId(conversation.id);
    const normalizedPatch = this.normalizeStructuredSearchStatePatch(input);
    const changedKeys = Object.keys(normalizedPatch.filterPatch) as SearchFilterKey[];

    if (changedKeys.length === 0 && normalizedPatch.filtersToUnset.length === 0) {
      return {
        conversationId: conversation.id,
        assistantMessage: 'No detecto cambios estructurados para aplicar.',
        searchState: currentState,
        didSearch: false,
        requiresClarification: false,
        clarificationQuestion: null,
        results: [],
        meta: {
          searchRunId: null,
          sourcesUsed: [],
          resultCount: 0,
        },
      };
    }

    const searchDecision = {
      intent: 'MODIFY_SEARCH' as const,
      shouldSearch: normalizedPatch.shouldSearch,
      requiresClarification: false,
      clarificationQuestion: null,
      userFacingMessage: '',
      filterPatch: normalizedPatch.filterPatch,
      filtersToUnset: normalizedPatch.filtersToUnset,
      requestedAction: normalizedPatch.shouldSearch ? ('SEARCH' as const) : ('NONE' as const),
    };
    const mergeResult = this.searchStateMergeService.applySearchDecision(currentState, searchDecision);
    const assistantMessage = this.buildStructuredPatchMessage(
      mergeResult.searchState,
      changedKeys,
      normalizedPatch.filtersToUnset,
      mergeResult.didSearch,
    );

    await this.searchStateService.updateByConversationId(conversation.id, mergeResult.searchState);

    const searchExecution = mergeResult.didSearch
      ? await this.searchExecutionService.execute(mergeResult.searchState)
      : null;
    const rawResults = searchExecution?.results ?? [];
    let searchRunId: string | null = null;
    const sourcesUsed: string[] = searchExecution?.sourcesUsed ?? [];

    const results = [];
    const persistedRankings = [];
    for (const rawResult of rawResults) {
      const property = await this.propertiesService.persistSearchResult(rawResult);
      results.push(this.serializeResult(property.id, rawResult));
      persistedRankings.push({
        propertyCacheId: property.id,
        rank: rawResult.rank,
      });
    }

    if (mergeResult.didSearch) {
      const searchRun = await this.searchRunService.persistSearchRun({
        conversationId: conversation.id,
        filtersSnapshot: mergeResult.searchState as Prisma.InputJsonValue,
        queryText: searchExecution?.queryText ?? 'busqueda inmobiliaria',
        sourcesUsed,
        results: persistedRankings,
      });

      searchRunId = searchRun.id;
      this.requestContextService?.set({ searchRunId: searchRun.id });
      await this.conversationsService.markSearchExecuted(conversation.id);
    }

    await this.messagesService.createAssistantMessage(
      conversation.id,
      assistantMessage,
      {
        mode: 'structured_filter_update',
        requestedAction: mergeResult.didSearch ? 'SEARCH' : 'NONE',
        didSearch: mergeResult.didSearch,
        searchState: mergeResult.searchState,
        changedKeys,
        filtersToUnset: normalizedPatch.filtersToUnset,
        resultCount: results.length,
        searchRunId,
      } satisfies Prisma.JsonObject,
    );

    return {
      conversationId: conversation.id,
      assistantMessage,
      searchState: mergeResult.searchState,
      didSearch: mergeResult.didSearch,
      requiresClarification: false,
      clarificationQuestion: null,
      results,
      meta: {
        searchRunId,
        sourcesUsed,
        resultCount: results.length,
      },
    };
  }

  private serializeResult(propertyId: string, rawResult: SearchResultItem) {
    return {
      propertyId,
      source: rawResult.source,
      sourceUrl: rawResult.sourceUrl,
      publisher: rawResult.publisher ?? null,
      contactPhone: rawResult.contactPhone ?? null,
      contactWhatsApp: rawResult.contactWhatsApp ?? null,
      title: rawResult.title,
      operation: rawResult.operation,
      propertyType: rawResult.propertyType,
      price: rawResult.price,
      currency: rawResult.currency,
      expenses: rawResult.expenses,
      city: rawResult.city,
      neighborhood: rawResult.neighborhood,
      locationText: rawResult.locationText,
      rooms: rawResult.rooms,
      bedrooms: rawResult.bedrooms,
      bathrooms: rawResult.bathrooms,
      areaTotal: rawResult.areaTotal,
      areaCovered: rawResult.areaCovered,
      features: rawResult.features,
      images: rawResult.images,
      scrapedAt: rawResult.scrapedAt,
      publishedAt: rawResult.publishedAt,
      rank: {
        position: rawResult.rank.position,
        score: rawResult.rank.score,
        reasons: rawResult.rank.reasons,
      },
    };
  }

  private async generateAssistantMessage(
    userMessage: string,
    searchState: SearchFilters,
    searchExecuted: boolean,
    rawResults: SearchResultItem[],
    fallbackMessage: string,
  ) {
    if (!this.aiResponseGeneratorService) {
      return fallbackMessage;
    }

    try {
      const aiResponse = await this.aiResponseGeneratorService.generate({
        userMessage,
        searchState,
        searchExecuted,
        results: searchExecuted ? this.buildResponseResultsSummary(rawResults) : null,
      });

      return aiResponse ?? this.buildDeterministicAssistantFallback(searchState, searchExecuted, rawResults, fallbackMessage);
    } catch {
      return this.buildDeterministicAssistantFallback(searchState, searchExecuted, rawResults, fallbackMessage);
    }
  }

  private buildDeterministicAssistantFallback(
    searchState: SearchFilters,
    searchExecuted: boolean,
    rawResults: SearchResultItem[],
    fallbackMessage: string,
  ) {
    if (!searchExecuted) {
      return fallbackMessage;
    }

    const summaryParts: string[] = [];

    if (searchState.operation) {
      summaryParts.push(this.formatOperation(searchState.operation));
    }

    if (searchState.locations.length > 0) {
      summaryParts.push(`en ${searchState.locations.join(', ')}`);
    }

    const rooms = (searchState.roomsAnyOf ?? []).length > 0
      ? searchState.roomsAnyOf?.join(' o ')
      : searchState.rooms !== null
        ? `${searchState.rooms}`
        : null;

    if (rooms) {
      summaryParts.push(`${rooms} ambientes`);
    }

    if (searchState.priceMax !== null && searchState.currency) {
      summaryParts.push(`hasta ${searchState.currency} ${searchState.priceMax}`);
    }

    const criteria = summaryParts.length > 0 ? ` ${summaryParts.join(' ')}` : '';

    if (rawResults.length === 0) {
      return `Busque${criteria}, pero no encontre propiedades reales para esos filtros.`;
    }

    return `Busque${criteria} y encontre ${rawResults.length} opciones reales.`;
  }

  private buildResponseResultsSummary(rawResults: SearchResultItem[]) {
    return {
      count: rawResults.length,
      properties: rawResults.slice(0, 4).map((result) => ({
        title: result.title,
        price: result.price ?? 0,
        currency: result.currency ?? '',
        address: result.locationText || result.neighborhood || result.city || result.title,
        neighborhood: result.neighborhood || result.city || '',
        rooms: result.rooms,
        area: result.areaTotal ?? result.areaCovered,
        bathrooms: result.bathrooms,
        features: result.features,
      })),
    };
  }

  private normalizeStructuredSearchStatePatch(input: StructuredSearchStatePatchInput) {
    const filterPatch = this.validateFilterPatch(input.filterPatch ?? {});
    const filtersToUnset = this.validateFiltersToUnset(input.filtersToUnset ?? []);

    return {
      filterPatch,
      filtersToUnset,
      shouldSearch: input.shouldSearch !== false,
    };
  }

  private validateFilterPatch(candidate: Record<string, unknown>) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new BadRequestException('filterPatch debe ser un objeto.');
    }

    const filterPatch: Partial<SearchFilters> = {};

    for (const [rawKey, value] of Object.entries(candidate)) {
      const key = rawKey as SearchFilterKey;

      if (!SEARCH_FILTER_KEYS.includes(key)) {
        throw new BadRequestException(`Filtro no soportado: ${rawKey}.`);
      }

      switch (key) {
        case 'operation':
          filterPatch.operation = this.parseOptionalEnum(value, ['BUY', 'RENT']) as SearchFilters['operation'];
          break;
        case 'propertyTypes':
          filterPatch.propertyTypes = this.parseStringArray(value, ['APARTMENT', 'HOUSE', 'PH', 'LAND', 'OFFICE', 'LOCAL', 'GARAGE']) as SearchFilters['propertyTypes'];
          break;
        case 'locations':
          filterPatch.locations = this.parseFreeTextArray(value);
          break;
        case 'priceMin':
        case 'priceMax':
        case 'rooms':
        case 'bedrooms':
        case 'bathrooms':
        case 'areaMin':
        case 'areaMax':
        case 'expensesMax':
          filterPatch[key] = this.parseOptionalNumber(value) as never;
          break;
        case 'roomsAnyOf':
          filterPatch.roomsAnyOf = this.parseNumberArray(value);
          break;
        case 'currency':
          filterPatch.currency = this.parseOptionalEnum(value, ['USD', 'ARS']) as SearchFilters['currency'];
          break;
        case 'features':
          filterPatch.features = this.parseStringArray(value, [
            'BALCONY',
            'TERRACE',
            'PATIO',
            'GARAGE',
            'POOL',
            'BARBECUE',
            'GYM',
            'PROFESSIONAL_USE',
            'MORTGAGE_ELIGIBLE',
            'FURNISHED',
            'PETS_ALLOWED',
          ]);
          break;
        case 'sortPreference':
          filterPatch.sortPreference = this.parseOptionalEnum(value, [
            'RELEVANCE',
            'PRICE_ASC',
            'PRICE_DESC',
            'NEWEST',
          ]) as SearchFilters['sortPreference'];
          break;
        default:
          throw new BadRequestException(`Filtro no soportado: ${rawKey}.`);
      }
    }

    return filterPatch;
  }

  private validateFiltersToUnset(candidate: string[]) {
    if (!Array.isArray(candidate)) {
      throw new BadRequestException('filtersToUnset debe ser un array.');
    }

    return Array.from(
      new Set(
        candidate.map((value) => {
          if (!SEARCH_FILTER_KEYS.includes(value as SearchFilterKey)) {
            throw new BadRequestException(`Filtro no soportado para limpiar: ${value}.`);
          }

          return value as SearchFilterKey;
        }),
      ),
    );
  }

  private parseOptionalEnum<T extends string>(value: unknown, allowedValues: readonly T[]) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Valor de enum invalido.');
    }

    const normalizedValue = value.trim().toUpperCase() as T;

    if (!allowedValues.includes(normalizedValue)) {
      throw new BadRequestException(`Valor no soportado: ${value}.`);
    }

    return normalizedValue;
  }

  private parseOptionalNumber(value: unknown) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Valor numerico invalido.');
    }

    return value;
  }

  private parseStringArray<T extends string>(value: unknown, allowedValues: readonly T[]) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('El valor debe ser un array.');
    }

    const normalizedValues = value.map((item) => {
      if (typeof item !== 'string') {
        throw new BadRequestException('El array contiene un valor invalido.');
      }

      const normalizedItem = item.trim().toUpperCase() as T;

      if (!allowedValues.includes(normalizedItem)) {
        throw new BadRequestException(`Valor no soportado: ${item}.`);
      }

      return normalizedItem;
    });

    return Array.from(new Set(normalizedValues));
  }

  private parseFreeTextArray(value: unknown) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('El valor debe ser un array.');
    }

    return Array.from(
      new Set(
        value
          .map((item) => {
            if (typeof item !== 'string') {
              throw new BadRequestException('El array contiene un valor invalido.');
            }

            return item.trim();
          })
          .filter((item) => item.length > 0),
      ),
    );
  }

  private parseNumberArray(value: unknown) {
    if (!Array.isArray(value)) {
      throw new BadRequestException('El valor debe ser un array.');
    }

    return Array.from(
      new Set(
        value.map((item) => {
          if (typeof item !== 'number' || !Number.isFinite(item) || item < 0) {
            throw new BadRequestException('El array contiene un numero invalido.');
          }

          return item;
        }),
      ),
    ).sort((left, right) => left - right);
  }

  private buildStructuredPatchMessage(
    searchState: SearchFilters,
    changedKeys: SearchFilterKey[],
    filtersToUnset: SearchFilterKey[],
    didSearch: boolean,
  ) {
    const touchedKeys = Array.from(new Set([...changedKeys, ...filtersToUnset]));
    const changes = touchedKeys
      .map((key) => this.describeStructuredFilter(searchState, key))
      .filter((value): value is string => value !== null);

    if (changes.length === 0) {
      return didSearch
        ? 'Actualizo el estado de busqueda y corro una nueva busqueda.'
        : 'Actualizo el estado de busqueda.';
    }

    return `${didSearch ? 'Actualizo filtros y busco de nuevo' : 'Actualizo filtros'}: ${changes.join(', ')}.`;
  }

  private describeStructuredFilter(searchState: SearchFilters, key: SearchFilterKey) {
    switch (key) {
      case 'operation':
        return searchState.operation ? `operacion ${this.formatOperation(searchState.operation)}` : 'sin operacion';
      case 'propertyTypes':
        return searchState.propertyTypes.length > 0
          ? `tipo ${searchState.propertyTypes.map((value) => this.formatPropertyType(value)).join(', ')}`
          : 'sin tipo';
      case 'locations':
        return searchState.locations.length > 0 ? `ubicacion ${searchState.locations.join(', ')}` : 'sin ubicacion';
      case 'priceMin':
        return searchState.priceMin !== null ? `precio minimo ${searchState.priceMin}` : 'sin precio minimo';
      case 'priceMax':
        return searchState.priceMax !== null
          ? `tope ${searchState.currency ? `${searchState.currency} ` : ''}${searchState.priceMax}`
          : 'sin tope';
      case 'currency':
        return searchState.currency ? `moneda ${searchState.currency}` : 'sin moneda';
      case 'rooms':
        return searchState.rooms !== null ? `${searchState.rooms} ambientes` : 'sin ambientes';
      case 'roomsAnyOf':
        return (searchState.roomsAnyOf ?? []).length > 0
          ? `ambientes ${searchState.roomsAnyOf?.join(' o ')}`
          : 'sin ambientes alternativos';
      case 'bedrooms':
        return searchState.bedrooms !== null ? `${searchState.bedrooms} dormitorios` : 'sin dormitorios';
      case 'bathrooms':
        return searchState.bathrooms !== null ? `${searchState.bathrooms} banos` : 'sin banos';
      case 'areaMin':
        return searchState.areaMin !== null ? `superficie minima ${searchState.areaMin} m2` : 'sin superficie minima';
      case 'areaMax':
        return searchState.areaMax !== null ? `superficie maxima ${searchState.areaMax} m2` : 'sin superficie maxima';
      case 'expensesMax':
        return searchState.expensesMax !== null ? `expensas maximas ${searchState.expensesMax}` : 'sin expensas maximas';
      case 'features':
        return searchState.features.length > 0 ? `features ${searchState.features.join(', ')}` : 'sin features';
      case 'sortPreference':
        return searchState.sortPreference ? `orden ${searchState.sortPreference}` : 'sin orden';
      default:
        return null;
    }
  }

  private formatOperation(value: NonNullable<SearchFilters['operation']>) {
    return value === 'BUY' ? 'compra' : 'alquiler';
  }

  private formatPropertyType(value: SearchFilters['propertyTypes'][number]) {
    switch (value) {
      case 'APARTMENT':
        return 'departamento';
      case 'HOUSE':
        return 'casa';
      case 'PH':
        return 'ph';
      case 'LAND':
        return 'terreno';
      case 'OFFICE':
        return 'oficina';
      case 'LOCAL':
        return 'local';
      case 'GARAGE':
        return 'garage';
    }
  }
}
