"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatApplicationService = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const search_decision_type_1 = require("../../../ai/domain/types/search-decision.type");
const ai_search_decision_service_1 = require("../../../ai/application/services/ai-search-decision.service");
const messages_service_1 = require("../../../messages/application/services/messages.service");
const search_execution_service_1 = require("../../../search/application/services/search-execution.service");
const search_run_service_1 = require("../../../search/application/services/search-run.service");
const search_state_merge_service_1 = require("../../../search-state/application/services/search-state-merge.service");
const search_state_service_1 = require("../../../search-state/application/services/search-state.service");
const properties_service_1 = require("../../../properties/application/services/properties.service");
const conversations_service_1 = require("./conversations.service");
let ChatApplicationService = class ChatApplicationService {
    aiSearchDecisionService;
    conversationsService;
    messagesService;
    searchStateService;
    searchStateMergeService;
    searchExecutionService;
    propertiesService;
    searchRunService;
    requestContextService;
    constructor(aiSearchDecisionService, conversationsService, messagesService, searchStateService, searchStateMergeService, searchExecutionService, propertiesService, searchRunService, requestContextService) {
        this.aiSearchDecisionService = aiSearchDecisionService;
        this.conversationsService = conversationsService;
        this.messagesService = messagesService;
        this.searchStateService = searchStateService;
        this.searchStateMergeService = searchStateMergeService;
        this.searchExecutionService = searchExecutionService;
        this.propertiesService = propertiesService;
        this.searchRunService = searchRunService;
        this.requestContextService = requestContextService;
    }
    async sendMessage(userId, conversationId, message) {
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
        let searchRunId = null;
        let sourcesUsed = searchExecution?.sourcesUsed ?? [];
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
                filtersSnapshot: mergeResult.searchState,
                queryText: searchExecution?.queryText ?? 'busqueda inmobiliaria',
                sourcesUsed,
                results: persistedRankings,
            });
            searchRunId = searchRun.id;
            this.requestContextService?.set({ searchRunId: searchRun.id });
            await this.conversationsService.markSearchExecuted(conversation.id);
        }
        const structuredPayload = {
            mode: 'ai',
            intent: searchDecision.intent,
            requestedAction: searchDecision.requestedAction,
            didSearch: mergeResult.didSearch,
            requiresClarification: mergeResult.requiresClarification,
            searchState: mergeResult.searchState,
            resultCount: results.length,
            searchRunId,
        };
        await this.messagesService.createAssistantMessage(conversation.id, mergeResult.assistantMessage, structuredPayload);
        return {
            conversationId: conversation.id,
            assistantMessage: mergeResult.assistantMessage,
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
    async patchSearchState(userId, conversationId, input) {
        this.requestContextService?.set({ userId, conversationId });
        const conversation = await this.conversationsService.assertOwnership(userId, conversationId);
        const currentState = await this.searchStateService.getOrCreateByConversationId(conversation.id);
        const normalizedPatch = this.normalizeStructuredSearchStatePatch(input);
        const changedKeys = Object.keys(normalizedPatch.filterPatch);
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
            intent: 'MODIFY_SEARCH',
            shouldSearch: normalizedPatch.shouldSearch,
            requiresClarification: false,
            clarificationQuestion: null,
            userFacingMessage: '',
            filterPatch: normalizedPatch.filterPatch,
            filtersToUnset: normalizedPatch.filtersToUnset,
            requestedAction: normalizedPatch.shouldSearch ? 'SEARCH' : 'NONE',
        };
        const mergeResult = this.searchStateMergeService.applySearchDecision(currentState, searchDecision);
        const assistantMessage = this.buildStructuredPatchMessage(mergeResult.searchState, changedKeys, normalizedPatch.filtersToUnset, mergeResult.didSearch);
        await this.searchStateService.updateByConversationId(conversation.id, mergeResult.searchState);
        const searchExecution = mergeResult.didSearch
            ? await this.searchExecutionService.execute(mergeResult.searchState)
            : null;
        const rawResults = searchExecution?.results ?? [];
        let searchRunId = null;
        const sourcesUsed = searchExecution?.sourcesUsed ?? [];
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
                filtersSnapshot: mergeResult.searchState,
                queryText: searchExecution?.queryText ?? 'busqueda inmobiliaria',
                sourcesUsed,
                results: persistedRankings,
            });
            searchRunId = searchRun.id;
            this.requestContextService?.set({ searchRunId: searchRun.id });
            await this.conversationsService.markSearchExecuted(conversation.id);
        }
        await this.messagesService.createAssistantMessage(conversation.id, assistantMessage, {
            mode: 'structured_filter_update',
            requestedAction: mergeResult.didSearch ? 'SEARCH' : 'NONE',
            didSearch: mergeResult.didSearch,
            searchState: mergeResult.searchState,
            changedKeys,
            filtersToUnset: normalizedPatch.filtersToUnset,
            resultCount: results.length,
            searchRunId,
        });
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
    serializeResult(propertyId, rawResult) {
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
    normalizeStructuredSearchStatePatch(input) {
        const filterPatch = this.validateFilterPatch(input.filterPatch ?? {});
        const filtersToUnset = this.validateFiltersToUnset(input.filtersToUnset ?? []);
        return {
            filterPatch,
            filtersToUnset,
            shouldSearch: input.shouldSearch !== false,
        };
    }
    validateFilterPatch(candidate) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            throw new common_1.BadRequestException('filterPatch debe ser un objeto.');
        }
        const filterPatch = {};
        for (const [rawKey, value] of Object.entries(candidate)) {
            const key = rawKey;
            if (!search_decision_type_1.SEARCH_FILTER_KEYS.includes(key)) {
                throw new common_1.BadRequestException(`Filtro no soportado: ${rawKey}.`);
            }
            switch (key) {
                case 'operation':
                    filterPatch.operation = this.parseOptionalEnum(value, ['BUY', 'RENT']);
                    break;
                case 'propertyTypes':
                    filterPatch.propertyTypes = this.parseStringArray(value, ['APARTMENT', 'HOUSE', 'PH', 'LAND', 'OFFICE', 'LOCAL', 'GARAGE']);
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
                    filterPatch[key] = this.parseOptionalNumber(value);
                    break;
                case 'currency':
                    filterPatch.currency = this.parseOptionalEnum(value, ['USD', 'ARS']);
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
                    ]);
                    break;
                default:
                    throw new common_1.BadRequestException(`Filtro no soportado: ${rawKey}.`);
            }
        }
        return filterPatch;
    }
    validateFiltersToUnset(candidate) {
        if (!Array.isArray(candidate)) {
            throw new common_1.BadRequestException('filtersToUnset debe ser un array.');
        }
        return Array.from(new Set(candidate.map((value) => {
            if (!search_decision_type_1.SEARCH_FILTER_KEYS.includes(value)) {
                throw new common_1.BadRequestException(`Filtro no soportado para limpiar: ${value}.`);
            }
            return value;
        })));
    }
    parseOptionalEnum(value, allowedValues) {
        if (value === null) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new common_1.BadRequestException('Valor de enum invalido.');
        }
        const normalizedValue = value.trim().toUpperCase();
        if (!allowedValues.includes(normalizedValue)) {
            throw new common_1.BadRequestException(`Valor no soportado: ${value}.`);
        }
        return normalizedValue;
    }
    parseOptionalNumber(value) {
        if (value === null) {
            return null;
        }
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            throw new common_1.BadRequestException('Valor numerico invalido.');
        }
        return value;
    }
    parseStringArray(value, allowedValues) {
        if (!Array.isArray(value)) {
            throw new common_1.BadRequestException('El valor debe ser un array.');
        }
        const normalizedValues = value.map((item) => {
            if (typeof item !== 'string') {
                throw new common_1.BadRequestException('El array contiene un valor invalido.');
            }
            const normalizedItem = item.trim().toUpperCase();
            if (!allowedValues.includes(normalizedItem)) {
                throw new common_1.BadRequestException(`Valor no soportado: ${item}.`);
            }
            return normalizedItem;
        });
        return Array.from(new Set(normalizedValues));
    }
    parseFreeTextArray(value) {
        if (!Array.isArray(value)) {
            throw new common_1.BadRequestException('El valor debe ser un array.');
        }
        return Array.from(new Set(value
            .map((item) => {
            if (typeof item !== 'string') {
                throw new common_1.BadRequestException('El array contiene un valor invalido.');
            }
            return item.trim();
        })
            .filter((item) => item.length > 0)));
    }
    buildStructuredPatchMessage(searchState, changedKeys, filtersToUnset, didSearch) {
        const touchedKeys = Array.from(new Set([...changedKeys, ...filtersToUnset]));
        const changes = touchedKeys
            .map((key) => this.describeStructuredFilter(searchState, key))
            .filter((value) => value !== null);
        if (changes.length === 0) {
            return didSearch
                ? 'Actualizo el estado de busqueda y corro una nueva busqueda.'
                : 'Actualizo el estado de busqueda.';
        }
        return `${didSearch ? 'Actualizo filtros y busco de nuevo' : 'Actualizo filtros'}: ${changes.join(', ')}.`;
    }
    describeStructuredFilter(searchState, key) {
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
    formatOperation(value) {
        return value === 'BUY' ? 'compra' : 'alquiler';
    }
    formatPropertyType(value) {
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
};
exports.ChatApplicationService = ChatApplicationService;
exports.ChatApplicationService = ChatApplicationService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [ai_search_decision_service_1.AiSearchDecisionService,
        conversations_service_1.ConversationsService,
        messages_service_1.MessagesService,
        search_state_service_1.SearchStateService,
        search_state_merge_service_1.SearchStateMergeService,
        search_execution_service_1.SearchExecutionService,
        properties_service_1.PropertiesService,
        search_run_service_1.SearchRunService,
        request_context_service_1.RequestContextService])
], ChatApplicationService);
