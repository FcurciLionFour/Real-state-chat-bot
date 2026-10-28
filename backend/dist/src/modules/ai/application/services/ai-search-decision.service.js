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
const default_search_filters_1 = require("../../../search-state/domain/constants/default-search-filters");
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
        const searchState = this.normalizeSearchState(input.searchState);
        const normalizedInput = {
            ...input,
            searchState,
        };
        if (this.isMockModeEnabled()) {
            return this.decideWithMockMode(normalizedInput);
        }
        try {
            const rawText = await this.openAiService.createStructuredJsonResponse({
                systemPrompt: this.buildSystemPrompt(),
                userInput: {
                    userMessage: normalizedInput.userMessage,
                    searchState: normalizedInput.searchState,
                    recentContextSummary: this.buildRecentContextSummary(normalizedInput.searchState),
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
            return this.applyDeterministicOverrides(normalizedInput.userMessage, normalizedInput.searchState, this.validateSearchDecision(parsed));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown AI decision error';
            this.logger.warn(`Falling back to safe SearchDecision because OpenAI decisioning failed: ${message}`, AiSearchDecisionService_1.name);
            return this.applyDeterministicOverrides(normalizedInput.userMessage, normalizedInput.searchState, search_decision_fallback_1.FALLBACK_SEARCH_DECISION);
        }
    }
    isMockModeEnabled() {
        return process.env.OPENAI_MOCK_MODE === 'true';
    }
    normalizeSearchState(value) {
        const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        return {
            operation: candidate.operation ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.operation,
            propertyTypes: Array.isArray(candidate.propertyTypes)
                ? structuredClone(candidate.propertyTypes)
                : structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS.propertyTypes),
            locations: Array.isArray(candidate.locations)
                ? structuredClone(candidate.locations)
                : structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS.locations),
            geoConstraints: Array.isArray(candidate.geoConstraints)
                ? structuredClone(candidate.geoConstraints)
                : structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS.geoConstraints),
            priceMin: candidate.priceMin ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.priceMin,
            priceMax: candidate.priceMax ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.priceMax,
            currency: candidate.currency ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.currency,
            rooms: candidate.rooms ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.rooms,
            roomsAnyOf: Array.isArray(candidate.roomsAnyOf)
                ? structuredClone(candidate.roomsAnyOf)
                : structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS.roomsAnyOf),
            bedrooms: candidate.bedrooms ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.bedrooms,
            bathrooms: candidate.bathrooms ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.bathrooms,
            areaMin: candidate.areaMin ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.areaMin,
            areaMax: candidate.areaMax ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.areaMax,
            expensesMax: candidate.expensesMax ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.expensesMax,
            features: Array.isArray(candidate.features)
                ? structuredClone(candidate.features)
                : structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS.features),
            sortPreference: candidate.sortPreference ?? default_search_filters_1.DEFAULT_SEARCH_FILTERS.sortPreference,
        };
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
        const geoConstraints = this.detectGeoConstraints(message);
        if (geoConstraints.length > 0) {
            filterPatch.geoConstraints = geoConstraints;
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
        const roomsAnyOf = this.detectRoomsAnyOf(message);
        if (roomsAnyOf.length > 1) {
            filterPatch.roomsAnyOf = roomsAnyOf;
            delete filterPatch.rooms;
            filtersToUnset.push('rooms');
        }
        const featuresToAdd = this.detectFeaturesToAdd(message);
        if (featuresToAdd.length > 0) {
            filterPatch.features = Array.from(new Set([...(currentState.features ?? []), ...featuresToAdd]));
        }
        if (this.detectPriceAscPreference(message)) {
            filterPatch.sortPreference = 'PRICE_ASC';
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
            'If the user message is not related to searching, renting, or buying real estate properties (for example: general questions, jokes, greetings, coding, math, politics, or any topic unrelated to property search), you must: set intent to SMALLTALK, set shouldSearch to false, set requestedAction to NONE, set requiresClarification to false, set clarificationQuestion to null, set filterPatch with all fields as null, set filtersToUnset to [], and set userFacingMessage to exactly: "Solo puedo ayudarte a buscar propiedades. \u00bfQu\u00e9 est\u00e1s buscando?" This rule applies regardless of the current searchState. Even if there is an active search context, a message that is clearly unrelated to real estate (math questions, jokes, greetings, general knowledge questions, coding, politics, etc.) must always return intent=SMALLTALK. The search context does not change this. Examples that must always return SMALLTALK: cu\u00e1nto es 2+2, qui\u00e9n gan\u00f3 el mundial, c\u00f3mo se hace una torta, escribime un poema. Do not engage with the off-topic content in any way. Do not answer the question. Do not explain why you cannot help. Just return the structure above.',
            'Use canonical enums only.',
            'In filterPatch, use null for fields that should not change.',
            'To clear an existing filter, add its key to filtersToUnset. For array filters, an empty array in filterPatch is also allowed when the user explicitly removes every value.',
            "For userFacingMessage, return a single short sentence (max 10 words) confirming only what changed. Example: 'Apliqu\u00e9 zona Recoleta y presupuesto 1M ARS.' This field is a fallback only - the real conversational response is generated later.",
            "Location replacement rule: if the user explicitly mentions a new neighborhood, zone, or city that is different from the current locations in searchState, you MUST set filterPatch.locations to the new location only. Do not keep the old location. Do not merge old and new. The new message wins over the current state. Example: if searchState.locations is ['Recoleta'] and the user says 'mejor en Belgrano' or 'que sea en Belgrano' or 'alquileres en Belgrano', you must return filterPatch.locations = ['Belgrano']. Never return filterPatch.locations = null in this case.",
            "Confirmation rule: if the user sends a short confirmation message like 'dale', 's\u00ed', 'ok', 'busc\u00e1', 'pod\u00e9s buscar', 'and\u00e1', 'buscame', 'mostr\u00e1' or any similar affirmative, AND the current searchState already has at minimum an operation and at least one location, you MUST return shouldSearch=true and requestedAction=SEARCH. Do not ask for clarification. Do not return shouldSearch=false for affirmative follow-ups when the state is already defined.",
            "Search threshold rule: if the user's message contains ALL of the following, set shouldSearch=true and requestedAction=SEARCH immediately - do not ask for clarification: 1. An operation (alquiler/venta/rent/buy or inferable from context) 2. At least one location (neighborhood, city, or zone) 3. Any price reference (even approximate: 'menos de 1M', 'hasta 800k', 'no m\u00e1s de 2 millones'). In this case, set requiresClarification=false and clarificationQuestion=null. The user gave enough to search. Execute. Additional rule: if the operation is already set in searchState and the user provides a new location + price, that is also sufficient. Use the existing operation from state.",
            'If the user says "sin tope", "sin limite", "sin maximo", or asks to remove the budget limit, clear priceMin, priceMax, and currency through filtersToUnset unless the same message provides a new explicit price.',
            'If the user asks for a clean focused search with wording like "solo buscame", "solo busc\u00e1", or "solo quiero buscar" plus an operation and location, reset secondary filters from the previous search. Keep only the operation and location from the current message, plus any filters explicitly restated in that same message.',
            'If the request is ambiguous, prefer clarification and no search.',
            'When the user asks for proximity with words like "cerca de", "cerca del", "a cuadras de", "por la zona de", add a geoConstraints item with kind PROXIMITY, sourceText as the referenced place, radiusMeters 1000 by default, and leave latitude/longitude null unless explicitly known.',
            'For named points of interest such as Alto Palermo or Bosques de Palermo, keep locations as the broad area (for example Palermo or CABA) and put the point of interest in geoConstraints.',
            'If the user asks for alternatives such as "monoambiente o 2 ambientes", set roomsAnyOf to [1, 2], clear rooms through filtersToUnset, and do not collapse it to a single rooms value.',
            'For one exact room count such as "2 ambientes", set rooms to 2 and leave roomsAnyOf null.',
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
        if ((searchState.roomsAnyOf ?? []).length > 0) {
            parts.push(`roomsAnyOf ${(searchState.roomsAnyOf ?? []).join(', ')}`);
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
                    type: ['string', 'null'],
                },
                filterPatch: {
                    type: 'object',
                    additionalProperties: false,
                    required: [...search_decision_type_1.SEARCH_FILTER_KEYS],
                    properties: {
                        operation: {
                            type: ['string', 'null'],
                            enum: [...Object.values(client_1.OperationType), null],
                        },
                        propertyTypes: {
                            anyOf: [
                                {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: [...Object.values(client_1.PropertyType)],
                                    },
                                },
                                { type: 'null' },
                            ],
                        },
                        locations: {
                            anyOf: [
                                {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                    },
                                },
                                { type: 'null' },
                            ],
                        },
                        geoConstraints: {
                            anyOf: [
                                {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: [
                                            'kind',
                                            'sourceText',
                                            'label',
                                            'province',
                                            'city',
                                            'neighborhood',
                                            'latitude',
                                            'longitude',
                                            'radiusMeters',
                                            'confidence',
                                            'provider',
                                        ],
                                        properties: {
                                            kind: {
                                                type: 'string',
                                                enum: ['AREA', 'PROXIMITY'],
                                            },
                                            sourceText: {
                                                type: 'string',
                                            },
                                            label: {
                                                type: 'string',
                                            },
                                            province: {
                                                type: ['string', 'null'],
                                            },
                                            city: {
                                                type: ['string', 'null'],
                                            },
                                            neighborhood: {
                                                type: ['string', 'null'],
                                            },
                                            latitude: {
                                                type: ['number', 'null'],
                                            },
                                            longitude: {
                                                type: ['number', 'null'],
                                            },
                                            radiusMeters: {
                                                type: ['number', 'null'],
                                            },
                                            confidence: {
                                                type: 'number',
                                            },
                                            provider: {
                                                type: 'string',
                                            },
                                        },
                                    },
                                },
                                { type: 'null' },
                            ],
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
                        roomsAnyOf: {
                            anyOf: [
                                {
                                    type: 'array',
                                    items: {
                                        type: 'number',
                                    },
                                },
                                { type: 'null' },
                            ],
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
                            anyOf: [
                                {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: [...FEATURES],
                                    },
                                },
                                { type: 'null' },
                            ],
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
            userFacingMessage: this.normalizeUserFacingMessage(candidate.userFacingMessage),
            filterPatch,
            filtersToUnset,
            requestedAction: candidate.requestedAction,
        };
    }
    normalizeUserFacingMessage(value) {
        if (typeof value !== 'string') {
            return 'Entendido, procesando tu b\u00fasqueda.';
        }
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : 'Entendido, procesando tu b\u00fasqueda.';
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
        if (candidate.operation !== undefined && candidate.operation !== null) {
            if (!Object.values(client_1.OperationType).includes(candidate.operation)) {
                throw new Error('Invalid operation');
            }
            result.operation = candidate.operation;
        }
        if (candidate.propertyTypes !== undefined && candidate.propertyTypes !== null) {
            result.propertyTypes = this.validateEnumArray(candidate.propertyTypes, Object.values(client_1.PropertyType), 'propertyTypes');
        }
        if (candidate.locations !== undefined && candidate.locations !== null) {
            result.locations = this.validateStringArray(candidate.locations, 'locations');
        }
        if (candidate.geoConstraints !== undefined && candidate.geoConstraints !== null) {
            result.geoConstraints = this.validateGeoConstraints(candidate.geoConstraints);
        }
        if (candidate.priceMin !== undefined && candidate.priceMin !== null) {
            result.priceMin = this.validateNullableNumber(candidate.priceMin, 'priceMin');
        }
        if (candidate.priceMax !== undefined && candidate.priceMax !== null) {
            result.priceMax = this.validateNullableNumber(candidate.priceMax, 'priceMax');
        }
        if (candidate.currency !== undefined && candidate.currency !== null) {
            if (!Object.values(client_1.CurrencyCode).includes(candidate.currency)) {
                throw new Error('Invalid currency');
            }
            result.currency = candidate.currency;
        }
        if (candidate.rooms !== undefined && candidate.rooms !== null) {
            result.rooms = this.validateNullableNumber(candidate.rooms, 'rooms');
        }
        if (candidate.roomsAnyOf !== undefined && candidate.roomsAnyOf !== null) {
            result.roomsAnyOf = this.validateNumberArray(candidate.roomsAnyOf, 'roomsAnyOf');
        }
        if (candidate.bedrooms !== undefined && candidate.bedrooms !== null) {
            result.bedrooms = this.validateNullableNumber(candidate.bedrooms, 'bedrooms');
        }
        if (candidate.bathrooms !== undefined && candidate.bathrooms !== null) {
            result.bathrooms = this.validateNullableNumber(candidate.bathrooms, 'bathrooms');
        }
        if (candidate.areaMin !== undefined && candidate.areaMin !== null) {
            result.areaMin = this.validateNullableNumber(candidate.areaMin, 'areaMin');
        }
        if (candidate.areaMax !== undefined && candidate.areaMax !== null) {
            result.areaMax = this.validateNullableNumber(candidate.areaMax, 'areaMax');
        }
        if (candidate.expensesMax !== undefined && candidate.expensesMax !== null) {
            result.expensesMax = this.validateNullableNumber(candidate.expensesMax, 'expensesMax');
        }
        if (candidate.features !== undefined && candidate.features !== null) {
            result.features = this.validateEnumArray(candidate.features, [...FEATURES], 'features');
        }
        if (candidate.sortPreference !== undefined && candidate.sortPreference !== null) {
            if (!SORT_PREFERENCES.includes(candidate.sortPreference)) {
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
    validateNumberArray(value, fieldName) {
        if (!Array.isArray(value)) {
            throw new Error(`${fieldName} must be an array`);
        }
        const values = value.map((item) => this.validateNullableNumber(item, fieldName));
        const numbers = values.filter((item) => item !== null);
        return Array.from(new Set(numbers)).sort((left, right) => left - right);
    }
    validateGeoConstraints(value) {
        if (!Array.isArray(value)) {
            throw new Error('geoConstraints must be an array');
        }
        return value.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw new Error('Invalid geoConstraints item');
            }
            const candidate = item;
            const kind = candidate.kind;
            if (kind !== 'AREA' && kind !== 'PROXIMITY') {
                throw new Error('Invalid geoConstraints kind');
            }
            return {
                kind,
                sourceText: this.validateRequiredString(candidate.sourceText, 'geoConstraints.sourceText'),
                label: this.validateRequiredString(candidate.label, 'geoConstraints.label'),
                province: this.validateNullableString(candidate.province, 'geoConstraints.province'),
                city: this.validateNullableString(candidate.city, 'geoConstraints.city'),
                neighborhood: this.validateNullableString(candidate.neighborhood, 'geoConstraints.neighborhood'),
                latitude: this.validateNullableNumber(candidate.latitude ?? null, 'geoConstraints.latitude'),
                longitude: this.validateNullableNumber(candidate.longitude ?? null, 'geoConstraints.longitude'),
                radiusMeters: this.validateNullableNumber(candidate.radiusMeters ?? null, 'geoConstraints.radiusMeters'),
                confidence: this.clampConfidence(this.validateNullableNumber(candidate.confidence, 'geoConstraints.confidence') ?? 0.5),
                provider: this.validateRequiredString(candidate.provider, 'geoConstraints.provider'),
            };
        });
    }
    validateRequiredString(value, fieldName) {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} must be a non-empty string`);
        }
        return value.trim();
    }
    validateNullableString(value, fieldName) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value !== 'string') {
            throw new Error(`${fieldName} must be string or null`);
        }
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
    }
    clampConfidence(value) {
        return Number(Math.max(0, Math.min(1, value)).toFixed(2));
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
        if (/\b(alquiler|alquileres|alquilar|alquilo|rentar|rent)\b/.test(message)) {
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
        const knownLocations = [
            'palermo',
            'caballito',
            'almagro',
            'belgrano',
            'recoleta',
            'villa crespo',
            'villa urquiza',
        ];
        const matches = knownLocations.filter((location) => message.includes(location));
        return matches.map((location) => location
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '));
    }
    detectGeoConstraints(message) {
        const constraints = [];
        const isProximity = /\b(cerca|cercano|cercana|alrededor|a cuadras|por la zona)\b/.test(message);
        if (message.includes('alto palermo')) {
            constraints.push({
                kind: 'PROXIMITY',
                sourceText: 'Alto Palermo',
                label: 'Alto Palermo',
                province: 'CABA',
                city: 'CABA',
                neighborhood: 'Palermo',
                latitude: null,
                longitude: null,
                radiusMeters: isProximity ? 1000 : 1500,
                confidence: 0.9,
                provider: 'deterministic',
            });
        }
        if (message.includes('bosques de palermo')) {
            constraints.push({
                kind: 'PROXIMITY',
                sourceText: 'Bosques de Palermo',
                label: 'Bosques de Palermo',
                province: 'CABA',
                city: 'CABA',
                neighborhood: 'Palermo',
                latitude: null,
                longitude: null,
                radiusMeters: isProximity ? 1000 : 1500,
                confidence: 0.88,
                provider: 'deterministic',
            });
        }
        return constraints;
    }
    detectPriceMax(message) {
        const millionMatch = message.match(/(\d+(?:[\.,]\d+)?)\s*(?:m|millon|millones)\b/);
        if (millionMatch) {
            const base = Number.parseFloat(millionMatch[1].replace(',', '.'));
            if (!Number.isNaN(base)) {
                return {
                    amount: Math.round(base * 1000000),
                    currency: this.detectCurrency(message),
                };
            }
        }
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
    detectRoomsAnyOf(message) {
        const values = new Set();
        if (message.includes('monoambiente')) {
            values.add(1);
        }
        for (const match of message.matchAll(/(\d+)\s+ambientes?/g)) {
            const parsed = Number.parseInt(match[1], 10);
            if (!Number.isNaN(parsed)) {
                values.add(parsed);
            }
        }
        const numberWords = new Map([
            ['un', 1],
            ['una', 1],
            ['uno', 1],
            ['dos', 2],
            ['tres', 3],
            ['cuatro', 4],
        ]);
        for (const match of message.matchAll(/\b(un|una|uno|dos|tres|cuatro)\s+ambientes?\b/g)) {
            const parsed = numberWords.get(match[1]);
            if (parsed) {
                values.add(parsed);
            }
        }
        const roomsAnyOf = Array.from(values).sort((left, right) => left - right);
        const hasAlternativeLanguage = /\b(o|u|entre|hasta)\b/.test(message);
        return hasAlternativeLanguage && roomsAnyOf.length > 1 ? roomsAnyOf : [];
    }
    applyDeterministicOverrides(userMessage, currentState, decision) {
        currentState = this.normalizeSearchState(currentState);
        const normalizedMessage = this.normalizeMessage(userMessage);
        const roomsAnyOf = this.detectRoomsAnyOf(normalizedMessage);
        const geoConstraints = this.detectGeoConstraints(normalizedMessage);
        const explicitLocations = this.detectLocations(normalizedMessage);
        const explicitOperation = this.detectOperation(normalizedMessage);
        const explicitPrice = this.detectPriceMax(normalizedMessage);
        const explicitRooms = this.detectRooms(normalizedMessage);
        const hasNoBudgetLimit = this.detectNoBudgetLimit(normalizedMessage);
        const hasFocusedSearchReset = this.detectFocusedSearchReset(normalizedMessage);
        const hasExplicitLocationReplacement = explicitLocations.length > 0 && !this.haveSameLocations(explicitLocations, currentState.locations);
        const isAffirmativeSearch = this.detectAffirmativeSearch(normalizedMessage);
        const hasDefinedSearchState = Boolean(currentState.operation) && currentState.locations.length > 0;
        const hasSearchThreshold = explicitLocations.length > 0 && Boolean(explicitPrice) && Boolean(explicitOperation ?? currentState.operation);
        const shouldForceSearchForLocation = hasExplicitLocationReplacement && Boolean(currentState.operation ?? decision.filterPatch.operation);
        const shouldForceSearchForAffirmative = isAffirmativeSearch && hasDefinedSearchState;
        const shouldForceSearchForNoBudgetLimit = hasNoBudgetLimit && Boolean(explicitOperation ?? currentState.operation ?? decision.filterPatch.operation) &&
            (explicitLocations.length > 0 || currentState.locations.length > 0 || (decision.filterPatch.locations ?? []).length > 0);
        const shouldForceSearchForFocusedReset = hasFocusedSearchReset && Boolean(explicitOperation ?? currentState.operation ?? decision.filterPatch.operation) &&
            (explicitLocations.length > 0 || (decision.filterPatch.locations ?? []).length > 0);
        const sortPreference = decision.shouldSearch && this.detectPriceAscPreference(normalizedMessage)
            ? 'PRICE_ASC'
            : decision.filterPatch.sortPreference;
        const filterPatch = {
            ...decision.filterPatch,
            ...(explicitOperation ? { operation: explicitOperation } : {}),
            ...(hasExplicitLocationReplacement ? { locations: explicitLocations } : {}),
            ...(explicitPrice && !hasNoBudgetLimit ? { priceMax: explicitPrice.amount, currency: explicitPrice.currency } : {}),
            ...(explicitRooms !== null && roomsAnyOf.length <= 1 ? { rooms: explicitRooms } : {}),
            ...(geoConstraints.length > 0 ? { geoConstraints } : {}),
            ...(sortPreference ? { sortPreference } : {}),
        };
        const filtersToUnset = new Set(decision.filtersToUnset);
        if (hasFocusedSearchReset) {
            [
                'propertyTypes',
                'priceMin',
                'priceMax',
                'currency',
                'rooms',
                'roomsAnyOf',
                'bedrooms',
                'bathrooms',
                'areaMin',
                'areaMax',
                'expensesMax',
                'features',
                'sortPreference',
            ].forEach((key) => filtersToUnset.add(key));
        }
        if (hasNoBudgetLimit) {
            filtersToUnset.add('priceMin');
            filtersToUnset.add('priceMax');
            filtersToUnset.add('currency');
            delete filterPatch.priceMin;
            delete filterPatch.priceMax;
            delete filterPatch.currency;
        }
        const overriddenDecision = {
            ...decision,
            ...(hasSearchThreshold ||
                shouldForceSearchForLocation ||
                shouldForceSearchForAffirmative ||
                shouldForceSearchForNoBudgetLimit ||
                shouldForceSearchForFocusedReset
                ? {
                    shouldSearch: true,
                    requestedAction: 'SEARCH',
                    requiresClarification: false,
                    clarificationQuestion: null,
                }
                : {}),
            filterPatch,
            filtersToUnset: Array.from(filtersToUnset),
        };
        if (roomsAnyOf.length <= 1) {
            return hasExplicitLocationReplacement ||
                explicitOperation ||
                explicitPrice ||
                hasNoBudgetLimit ||
                hasFocusedSearchReset ||
                explicitRooms !== null ||
                geoConstraints.length > 0 ||
                sortPreference ||
                hasSearchThreshold ||
                shouldForceSearchForLocation ||
                shouldForceSearchForAffirmative ||
                shouldForceSearchForNoBudgetLimit ||
                shouldForceSearchForFocusedReset
                ? overriddenDecision
                : decision;
        }
        return {
            ...overriddenDecision,
            filterPatch: {
                ...filterPatch,
                propertyTypes: decision.filterPatch.propertyTypes && decision.filterPatch.propertyTypes.length > 0
                    ? decision.filterPatch.propertyTypes
                    : [client_1.PropertyType.APARTMENT],
                roomsAnyOf,
            },
            filtersToUnset: Array.from(new Set([...overriddenDecision.filtersToUnset, 'rooms'])),
        };
    }
    haveSameLocations(left, right) {
        const normalizeLocations = (locations) => locations.map((location) => this.normalizeMessage(location)).sort();
        const normalizedLeft = normalizeLocations(left);
        const normalizedRight = normalizeLocations(right);
        return (normalizedLeft.length === normalizedRight.length &&
            normalizedLeft.every((location, index) => location === normalizedRight[index]));
    }
    detectAffirmativeSearch(message) {
        return /^(dale|si|ok|busca|podes buscar|anda|mostra|buscame)(?:[.!?\s]*)$/.test(message) ||
            /\b(podes ya buscar|podes buscar|busca(?:me)?|mostra|dale|anda)\b/.test(message);
    }
    detectNoBudgetLimit(message) {
        return /\b(sin tope|sin limite|sin maximo|sin presupuesto|maximo libre|sin precio maximo|saca(?:me)? el tope|quita(?:me)? el tope|saca(?:me)? presupuesto|quita(?:me)? presupuesto)\b/.test(message);
    }
    detectFocusedSearchReset(message) {
        return /\b(solo|solamente|unicamente)\b.{0,24}\b(busca|buscame|buscar|quiero buscar|mostra|mostrame)\b/.test(message) ||
            /\b(busca|buscame|buscar|mostra|mostrame)\b.{0,24}\b(solo|solamente|unicamente)\b/.test(message);
    }
    detectPriceAscPreference(message) {
        return /\b(si es menos|menos mejor|menor precio|mas barato|barato|lo mas economico|economico)\b/.test(message);
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
                case 'geoConstraints':
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
