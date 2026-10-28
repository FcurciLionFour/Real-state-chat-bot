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
var AiSearchDecisionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiSearchDecisionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const openai_service_1 = require("../../../../infrastructure/openai/openai.service");
const search_decision_fallback_1 = require("../../domain/constants/search-decision-fallback");
const search_decision_type_1 = require("../../domain/types/search-decision.type");
const SORT_PREFERENCES = ['RELEVANCE', 'PRICE_ASC', 'PRICE_DESC', 'NEWEST'];
const FEATURES = [
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
];
let AiSearchDecisionService = AiSearchDecisionService_1 = class AiSearchDecisionService {
    openAiService;
    logger;
    constructor(openAiService, logger) {
        this.openAiService = openAiService;
        this.logger = logger;
    }
    async decide(input) {
        if (this.isMockModeEnabled()) {
            return this.decideWithMockMode(input);
        }
        try {
            const rawText = await this.openAiService.createStructuredJsonResponse({
                systemPrompt: this.buildSystemPrompt(),
                userInput: {
                    userMessage: input.userMessage,
                    searchState: input.searchState,
                    recentContextSummary: this.buildRecentContextSummary(input.searchState),
                    allowedEnums: {
                        operations: Object.values(client_1.OperationType),
                        currencies: Object.values(client_1.CurrencyCode),
                        propertyTypes: Object.values(client_1.PropertyType),
                        features: [...FEATURES],
                        sortPreferences: [...SORT_PREFERENCES],
                        intents: [...search_decision_type_1.SEARCH_INTENTS],
                        requestedActions: [...search_decision_type_1.REQUESTED_ACTIONS],
                        filterKeys: [...search_decision_type_1.SEARCH_FILTER_KEYS],
                    },
                },
                schemaName: 'search_decision',
                schemaDescription: 'Structured interpretation of a conversational real estate search message.',
                schema: this.buildResponseSchema(),
            });
            const parsed = JSON.parse(rawText);
            return this.validateSearchDecision(parsed);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown AI decision error';
            this.logger.warn(`Falling back to safe SearchDecision because OpenAI decisioning failed: ${message}`, AiSearchDecisionService_1.name);
            return search_decision_fallback_1.FALLBACK_SEARCH_DECISION;
        }
    }
    isMockModeEnabled() {
        return process.env.OPENAI_MOCK_MODE === 'true';
    }
    decideWithMockMode(input) {
        const message = this.normalizeMessage(input.userMessage);
        const currentState = input.searchState;
        const filterPatch = {};
        const filtersToUnset = [];
        const operation = this.detectOperation(message);
        if (operation) {
            filterPatch.operation = operation;
        }
        const propertyTypes = this.detectPropertyTypes(message);
        if (propertyTypes.length > 0) {
            filterPatch.propertyTypes = propertyTypes;
        }
        const locations = this.detectLocations(message);
        if (locations.length > 0) {
            filterPatch.locations = locations;
        }
        const price = this.detectPriceMax(message);
        if (price) {
            filterPatch.priceMax = price.amount;
            filterPatch.currency = price.currency;
        }
        const rooms = this.detectRooms(message);
        if (rooms !== null) {
            filterPatch.rooms = rooms;
        }
        const featuresToAdd = this.detectFeaturesToAdd(message);
        if (featuresToAdd.length > 0) {
            filterPatch.features = Array.from(new Set([...(currentState.features ?? []), ...featuresToAdd]));
        }
        if (this.detectRemoveBalcony(message)) {
            filtersToUnset.push('features');
            filterPatch.features = (currentState.features ?? []).filter((feature) => feature !== 'BALCONY');
        }
        const previewState = this.mergePreviewState(currentState, filterPatch, filtersToUnset);
        const hasCoreSearchFields = Boolean(previewState.operation) &&
            previewState.propertyTypes.length > 0 &&
            previewState.locations.length > 0;
        if (!hasCoreSearchFields) {
            return search_decision_fallback_1.FALLBACK_SEARCH_DECISION;
        }
        const isModify = currentState.locations.length > 0 ||
            message.includes('manten') ||
            message.includes('baja') ||
            message.includes('subi') ||
            message.includes('sac') ||
            message.includes('agreg');
        return {
            intent: isModify ? 'MODIFY_SEARCH' : 'NEW_SEARCH',
            shouldSearch: true,
            requiresClarification: false,
            clarificationQuestion: null,
            userFacingMessage: this.buildMockUserFacingMessage(previewState, isModify),
            filterPatch,
            filtersToUnset,
            requestedAction: 'SEARCH',
        };
    }
    buildSystemPrompt() {
        return [
            'You interpret user messages for a conversational real estate search backend.',
            'Return only structured data that matches the schema.',
            'Do not invent properties or search results.',
            'Do not act as if a search happened when shouldSearch is false.',
            'Use canonical enums only.',
            'Keep userFacingMessage short, operational, and concise.',
            'If the request is ambiguous, prefer clarification and no search.',
            'You may understand Spanish and English, but always output canonical backend values.',
        ].join(' ');
    }
    buildRecentContextSummary(searchState) {
        const parts = [];
        if (searchState.operation) {
            parts.push(searchState.operation === client_1.OperationType.BUY ? 'operation BUY' : 'operation RENT');
        }
        if (searchState.propertyTypes.length > 0) {
            parts.push(`propertyTypes ${searchState.propertyTypes.join(', ')}`);
        }
        if (searchState.locations.length > 0) {
            parts.push(`locations ${searchState.locations.join(', ')}`);
        }
        if (searchState.priceMax !== null && searchState.currency) {
            parts.push(`priceMax ${searchState.currency} ${searchState.priceMax}`);
        }
        if (searchState.rooms !== null) {
            parts.push(`rooms ${searchState.rooms}`);
        }
        if (searchState.features.length > 0) {
            parts.push(`features ${searchState.features.join(', ')}`);
        }
        return parts.length > 0 ? parts.join(' | ') : 'No active search filters yet.';
    }
    buildResponseSchema() {
        return {
            type: 'object',
            additionalProperties: false,
            required: [
                'intent',
                'shouldSearch',
                'requiresClarification',
                'clarificationQuestion',
                'userFacingMessage',
                'filterPatch',
                'filtersToUnset',
                'requestedAction',
            ],
            properties: {
                intent: {
                    type: 'string',
                    enum: [...search_decision_type_1.SEARCH_INTENTS],
                },
                shouldSearch: {
                    type: 'boolean',
                },
                requiresClarification: {
                    type: 'boolean',
                },
                clarificationQuestion: {
                    type: ['string', 'null'],
                },
                userFacingMessage: {
                    type: 'string',
                },
                filterPatch: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        operation: {
                            type: ['string', 'null'],
                            enum: [...Object.values(client_1.OperationType), null],
                        },
                        propertyTypes: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: [...Object.values(client_1.PropertyType)],
                            },
                        },
                        locations: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                        },
                        priceMin: {
                            type: ['number', 'null'],
                        },
                        priceMax: {
                            type: ['number', 'null'],
                        },
                        currency: {
                            type: ['string', 'null'],
                            enum: [...Object.values(client_1.CurrencyCode), null],
                        },
                        rooms: {
                            type: ['number', 'null'],
                        },
                        bedrooms: {
                            type: ['number', 'null'],
                        },
                        bathrooms: {
                            type: ['number', 'null'],
                        },
                        areaMin: {
                            type: ['number', 'null'],
                        },
                        areaMax: {
                            type: ['number', 'null'],
                        },
                        expensesMax: {
                            type: ['number', 'null'],
                        },
                        features: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: [...FEATURES],
                            },
                        },
                        sortPreference: {
                            type: ['string', 'null'],
                            enum: [...SORT_PREFERENCES, null],
                        },
                    },
                },
                filtersToUnset: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: [...search_decision_type_1.SEARCH_FILTER_KEYS],
                    },
                },
                requestedAction: {
                    type: 'string',
                    enum: [...search_decision_type_1.REQUESTED_ACTIONS],
                },
            },
        };
    }
    validateSearchDecision(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('SearchDecision must be an object');
        }
        const candidate = payload;
        const unknownKeys = Object.keys(candidate).filter((key) => ![
            'intent',
            'shouldSearch',
            'requiresClarification',
            'clarificationQuestion',
            'userFacingMessage',
            'filterPatch',
            'filtersToUnset',
            'requestedAction',
        ].includes(key));
        if (unknownKeys.length > 0) {
            throw new Error(`SearchDecision contains unknown keys: ${unknownKeys.join(', ')}`);
        }
        if (!search_decision_type_1.SEARCH_INTENTS.includes(candidate.intent)) {
            throw new Error('Invalid intent');
        }
        if (typeof candidate.shouldSearch !== 'boolean') {
            throw new Error('shouldSearch must be boolean');
        }
        if (typeof candidate.requiresClarification !== 'boolean') {
            throw new Error('requiresClarification must be boolean');
        }
        if (!(candidate.clarificationQuestion === null || typeof candidate.clarificationQuestion === 'string')) {
            throw new Error('clarificationQuestion must be string or null');
        }
        if (typeof candidate.userFacingMessage !== 'string' || candidate.userFacingMessage.trim().length === 0) {
            throw new Error('userFacingMessage must be a non-empty string');
        }
        if (!search_decision_type_1.REQUESTED_ACTIONS.includes(candidate.requestedAction)) {
            throw new Error('Invalid requestedAction');
        }
        const filterPatch = this.validateFilterPatch(candidate.filterPatch);
        const filtersToUnset = this.validateFiltersToUnset(candidate.filtersToUnset);
        return {
            intent: candidate.intent,
            shouldSearch: candidate.shouldSearch,
            requiresClarification: candidate.requiresClarification,
            clarificationQuestion: candidate.clarificationQuestion,
            userFacingMessage: candidate.userFacingMessage.trim(),
            filterPatch,
            filtersToUnset,
            requestedAction: candidate.requestedAction,
        };
    }
    validateFilterPatch(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            if (value === undefined || value === null) {
                return {};
            }
            throw new Error('filterPatch must be an object');
        }
        const candidate = value;
        const result = {};
        for (const key of Object.keys(candidate)) {
            if (!search_decision_type_1.SEARCH_FILTER_KEYS.includes(key)) {
                throw new Error(`Unknown filterPatch key: ${key}`);
            }
        }
        if (candidate.operation !== undefined) {
            if (candidate.operation !== null && !Object.values(client_1.OperationType).includes(candidate.operation)) {
                throw new Error('Invalid operation');
            }
            result.operation = candidate.operation;
        }
        if (candidate.propertyTypes !== undefined) {
            result.propertyTypes = this.validateEnumArray(candidate.propertyTypes, Object.values(client_1.PropertyType), 'propertyTypes');
        }
        if (candidate.locations !== undefined) {
            result.locations = this.validateStringArray(candidate.locations, 'locations');
        }
        if (candidate.priceMin !== undefined) {
            result.priceMin = this.validateNullableNumber(candidate.priceMin, 'priceMin');
        }
        if (candidate.priceMax !== undefined) {
            result.priceMax = this.validateNullableNumber(candidate.priceMax, 'priceMax');
        }
        if (candidate.currency !== undefined) {
            if (candidate.currency !== null && !Object.values(client_1.CurrencyCode).includes(candidate.currency)) {
                throw new Error('Invalid currency');
            }
            result.currency = candidate.currency;
        }
        if (candidate.rooms !== undefined) {
            result.rooms = this.validateNullableNumber(candidate.rooms, 'rooms');
        }
        if (candidate.bedrooms !== undefined) {
            result.bedrooms = this.validateNullableNumber(candidate.bedrooms, 'bedrooms');
        }
        if (candidate.bathrooms !== undefined) {
            result.bathrooms = this.validateNullableNumber(candidate.bathrooms, 'bathrooms');
        }
        if (candidate.areaMin !== undefined) {
            result.areaMin = this.validateNullableNumber(candidate.areaMin, 'areaMin');
        }
        if (candidate.areaMax !== undefined) {
            result.areaMax = this.validateNullableNumber(candidate.areaMax, 'areaMax');
        }
        if (candidate.expensesMax !== undefined) {
            result.expensesMax = this.validateNullableNumber(candidate.expensesMax, 'expensesMax');
        }
        if (candidate.features !== undefined) {
            result.features = this.validateEnumArray(candidate.features, [...FEATURES], 'features');
        }
        if (candidate.sortPreference !== undefined) {
            if (candidate.sortPreference !== null &&
                !SORT_PREFERENCES.includes(candidate.sortPreference)) {
                throw new Error('Invalid sortPreference');
            }
            result.sortPreference = candidate.sortPreference;
        }
        return result;
    }
    validateFiltersToUnset(value) {
        if (!Array.isArray(value)) {
            throw new Error('filtersToUnset must be an array');
        }
        for (const item of value) {
            if (!search_decision_type_1.SEARCH_FILTER_KEYS.includes(item)) {
                throw new Error(`Invalid filtersToUnset value: ${String(item)}`);
            }
        }
        return value;
    }
    validateEnumArray(value, allowed, fieldName) {
        if (!Array.isArray(value)) {
            throw new Error(`${fieldName} must be an array`);
        }
        for (const item of value) {
            if (!allowed.includes(item)) {
                throw new Error(`Invalid ${fieldName} value: ${String(item)}`);
            }
        }
        return value;
    }
    validateStringArray(value, fieldName) {
        if (!Array.isArray(value)) {
            throw new Error(`${fieldName} must be an array`);
        }
        for (const item of value) {
            if (typeof item !== 'string' || item.trim().length === 0) {
                throw new Error(`Invalid ${fieldName} value`);
            }
        }
        return value.map((item) => item.trim());
    }
    validateNullableNumber(value, fieldName) {
        if (value === null) {
            return null;
        }
        if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new Error(`${fieldName} must be number or null`);
        }
        return value;
    }
    normalizeMessage(value) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }
    detectOperation(message) {
        if (/\b(comprar|compra|venta|vender)\b/.test(message)) {
            return client_1.OperationType.BUY;
        }
        if (/\b(alquiler|alquilar|alquilo|rentar|rentar)\b/.test(message)) {
            return client_1.OperationType.RENT;
        }
        return null;
    }
    detectPropertyTypes(message) {
        if (/\b(monoambiente|departamento|depto|apartment)\b/.test(message)) {
            return [client_1.PropertyType.APARTMENT];
        }
        if (/\b(casa|house)\b/.test(message)) {
            return [client_1.PropertyType.HOUSE];
        }
        if (/\b(ph)\b/.test(message)) {
            return [client_1.PropertyType.PH];
        }
        if (/\b(oficina|office)\b/.test(message)) {
            return [client_1.PropertyType.OFFICE];
        }
        if (/\b(local)\b/.test(message)) {
            return [client_1.PropertyType.LOCAL];
        }
        if (/\b(terreno|lote|land)\b/.test(message)) {
            return [client_1.PropertyType.LAND];
        }
        if (/\b(garage|cochera)\b/.test(message)) {
            return [client_1.PropertyType.GARAGE];
        }
        return [];
    }
    detectLocations(message) {
        const knownLocations = ['palermo', 'caballito', 'almagro', 'belgrano', 'recoleta', 'villa crespo'];
        const matches = knownLocations.filter((location) => message.includes(location));
        return matches.map((location) => location
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '));
    }
    detectPriceMax(message) {
        const thousandsMatch = message.match(/(\d+(?:[\.,]\d+)?)\s*k\b/);
        if (thousandsMatch) {
            const base = Number.parseFloat(thousandsMatch[1].replace(',', '.'));
            if (!Number.isNaN(base)) {
                return {
                    amount: Math.round(base * 1000),
                    currency: this.detectCurrency(message),
                };
            }
        }
        const directMatch = message.match(/(?:hasta|tope|baja(?:me)?(?: el tope)? a|subi(?:me)?(?: el tope)? a)?\s*(\d{5,7})\b/);
        if (directMatch) {
            const amount = Number.parseInt(directMatch[1], 10);
            if (!Number.isNaN(amount)) {
                return {
                    amount,
                    currency: this.detectCurrency(message),
                };
            }
        }
        return null;
    }
    detectCurrency(message) {
        if (/\b(usd|dolar|dolares)\b/.test(message)) {
            return client_1.CurrencyCode.USD;
        }
        return client_1.CurrencyCode.ARS;
    }
    detectRooms(message) {
        if (message.includes('monoambiente')) {
            return 1;
        }
        const roomsMatch = message.match(/(\d+)\s+ambientes?/);
        if (!roomsMatch) {
            return null;
        }
        const rooms = Number.parseInt(roomsMatch[1], 10);
        return Number.isNaN(rooms) ? null : rooms;
    }
    detectFeaturesToAdd(message) {
        const features = [];
        if (/\b(balcon|balcones)\b/.test(message)) {
            features.push('BALCONY');
        }
        if (/\b(terraza)\b/.test(message)) {
            features.push('TERRACE');
        }
        if (/\b(cochera|garage)\b/.test(message)) {
            features.push('GARAGE');
        }
        if (/\b(patio)\b/.test(message)) {
            features.push('PATIO');
        }
        if (/\b(pileta|pool)\b/.test(message)) {
            features.push('POOL');
        }
        return features;
    }
    detectRemoveBalcony(message) {
        return /\b(sin balcon|sacale balcon|saca balcon|quitar balcon|quita balcon)\b/.test(message);
    }
    mergePreviewState(currentState, filterPatch, filtersToUnset) {
        const nextState = structuredClone(currentState);
        for (const key of filtersToUnset) {
            switch (key) {
                case 'propertyTypes':
                case 'locations':
                case 'features':
                    nextState[key] = [];
                    break;
                default:
                    nextState[key] = null;
            }
        }
        for (const [key, value] of Object.entries(filterPatch)) {
            nextState[key] = structuredClone(value);
        }
        return nextState;
    }
    buildMockUserFacingMessage(searchState, isModify) {
        const location = searchState.locations[0] ?? 'tu zona';
        const operation = searchState.operation === client_1.OperationType.BUY ? 'compra' : 'alquiler';
        const propertyType = searchState.propertyTypes[0] === client_1.PropertyType.APARTMENT ? 'departamento' : 'propiedad';
        const budget = searchState.priceMax !== null && searchState.currency
            ? ` hasta ${searchState.currency} ${searchState.priceMax}`
            : '';
        if (isModify) {
            return `Mantengo ${location} y actualizo filtros para ${operation} de ${propertyType}${budget}.`;
        }
        return `Armo la busqueda en ${location} para ${operation} de ${propertyType}${budget}.`;
    }
};
exports.AiSearchDecisionService = AiSearchDecisionService;
exports.AiSearchDecisionService = AiSearchDecisionService = AiSearchDecisionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        logger_service_1.LoggerService])
], AiSearchDecisionService);
