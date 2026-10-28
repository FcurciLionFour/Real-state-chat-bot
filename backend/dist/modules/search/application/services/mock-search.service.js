"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSearchService = void 0;
const common_1 = require("@nestjs/common");
let MockSearchService = class MockSearchService {
    search(searchState) {
        const neighborhood = searchState.locations[0] ?? 'CABA';
        const propertyType = searchState.propertyTypes[0] ?? 'APARTMENT';
        const operation = searchState.operation ?? 'BUY';
        const currency = searchState.currency ?? 'USD';
        const price = searchState.priceMax ?? (currency === 'ARS' ? 850000 : 125000);
        const rooms = searchState.rooms ?? 2;
        const bedrooms = searchState.bedrooms ?? 1;
        const bathrooms = searchState.bathrooms ?? 1;
        return [
            {
                source: 'mock-source',
                sourceUrl: 'https://example.com/mock-property-1',
                title: `${propertyType} mock en ${neighborhood}`,
                operation,
                propertyType,
                price,
                currency,
                expenses: currency === 'ARS' ? 120000 : 100,
                city: 'CABA',
                neighborhood,
                locationText: `${neighborhood}, Capital Federal`,
                rooms,
                bedrooms,
                bathrooms,
                areaTotal: 48,
                areaCovered: 44,
                features: searchState.features,
                images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85'],
                scrapedAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
                rank: {
                    position: 1,
                    score: 0.9,
                    reasons: ['Coincide con tu zona', 'Está dentro del presupuesto mock'],
                },
            },
            {
                source: 'mock-source',
                sourceUrl: 'https://example.com/mock-property-2',
                title: `${propertyType} mock alternativa en ${neighborhood}`,
                operation,
                propertyType,
                price: Math.round(price * 0.95),
                currency,
                expenses: currency === 'ARS' ? 95000 : 80,
                city: 'CABA',
                neighborhood,
                locationText: `${neighborhood}, Capital Federal`,
                rooms,
                bedrooms,
                bathrooms,
                areaTotal: 52,
                areaCovered: 46,
                features: searchState.features,
                images: ['https://images.unsplash.com/photo-1494526585095-c41746248156'],
                scrapedAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
                rank: {
                    position: 2,
                    score: 0.83,
                    reasons: ['Alternativa mock cercana', 'Mantiene los filtros principales'],
                },
            },
        ];
    }
    buildQueryText(searchState) {
        const parts = [];
        if (searchState.operation) {
            parts.push(searchState.operation === 'BUY' ? 'compra' : 'alquiler');
        }
        if (searchState.propertyTypes.length > 0) {
            parts.push(searchState.propertyTypes.join(' '));
        }
        if (searchState.locations.length > 0) {
            parts.push(searchState.locations.join(' '));
        }
        if (searchState.rooms) {
            parts.push(`${searchState.rooms} ambientes`);
        }
        if (searchState.features.length > 0) {
            parts.push(searchState.features.join(' '));
        }
        return parts.join(' ').trim() || 'busqueda mock';
    }
};
exports.MockSearchService = MockSearchService;
exports.MockSearchService = MockSearchService = __decorate([
    (0, common_1.Injectable)()
], MockSearchService);
