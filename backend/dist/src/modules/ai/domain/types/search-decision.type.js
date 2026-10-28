"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEARCH_FILTER_KEYS = exports.REQUESTED_ACTIONS = exports.SEARCH_INTENTS = void 0;
exports.SEARCH_INTENTS = [
    'NEW_SEARCH',
    'MODIFY_SEARCH',
    'CLARIFY',
    'SHOW_MORE',
    'COMPARE',
    'FAVORITE',
    'SMALLTALK',
];
exports.REQUESTED_ACTIONS = ['SEARCH', 'COMPARE', 'FAVORITE', 'NONE'];
exports.SEARCH_FILTER_KEYS = [
    'operation',
    'propertyTypes',
    'locations',
    'geoConstraints',
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
];
