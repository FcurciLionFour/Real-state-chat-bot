"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SearchQueryBuilderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchQueryBuilderService = void 0;
const common_1 = require("@nestjs/common");
let SearchQueryBuilderService = class SearchQueryBuilderService {
    static { SearchQueryBuilderService_1 = this; }
    static MAX_DISCOVERY_QUERIES = 4;
    operationTerms = {
        BUY: 'venta',
        RENT: 'alquiler',
    };
    propertyTypeTerms = {
        APARTMENT: 'departamento',
        HOUSE: 'casa',
        PH: 'ph',
        LAND: 'terreno',
        OFFICE: 'oficina',
        LOCAL: 'local comercial',
        GARAGE: 'cochera',
    };
    featureTerms = {
        BALCONY: 'balcon',
        TERRACE: 'terraza',
        PATIO: 'patio',
        GARAGE: 'cochera',
        POOL: 'pileta',
        BARBECUE: 'parrilla',
        GYM: 'gimnasio',
        PROFESSIONAL_USE: 'apto profesional',
        MORTGAGE_ELIGIBLE: 'apto credito',
        FURNISHED: 'amoblado',
        PETS_ALLOWED: 'acepta mascotas',
    };
    buildPrimaryQuery(filters) {
        return this.buildDiscoveryQueries(filters)[0] ?? 'propiedades argentina';
    }
    buildDiscoveryQueries(filters) {
        const baseTerms = this.buildBaseTerms(filters);
        const priceTerm = this.buildPriceTerm(filters);
        const queries = [
            this.buildQuery(baseTerms),
            this.buildQuery(baseTerms, ['publicacion']),
            this.buildQuery(baseTerms, ['ficha']),
            this.buildQuery(baseTerms, priceTerm ? [priceTerm, 'detalle'] : ['detalle']),
        ];
        return Array.from(new Set(queries.filter((query) => query.length > 0))).slice(0, SearchQueryBuilderService_1.MAX_DISCOVERY_QUERIES);
    }
    buildBaseTerms(filters) {
        const terms = [];
        if (filters.propertyTypes.length > 0) {
            terms.push(filters.propertyTypes.map((propertyType) => this.propertyTypeTerms[propertyType]).join(' '));
        }
        else {
            terms.push('propiedad');
        }
        if (filters.operation) {
            terms.push(this.operationTerms[filters.operation]);
        }
        if (filters.locations.length > 0) {
            terms.push(filters.locations.slice(0, 2).join(' '));
        }
        else {
            terms.push('Argentina');
        }
        if (filters.rooms) {
            terms.push(`${filters.rooms} ambientes`);
        }
        if (filters.bedrooms) {
            terms.push(`${filters.bedrooms} dormitorio`);
        }
        if (filters.features.length > 0) {
            terms.push(filters.features.slice(0, 2).map((feature) => this.featureTerms[feature]).join(' '));
        }
        return terms;
    }
    buildPriceTerm(filters) {
        if (!filters.currency) {
            return null;
        }
        if (filters.priceMax !== null) {
            return `hasta ${filters.currency} ${filters.priceMax}`;
        }
        if (filters.priceMin !== null) {
            return `desde ${filters.currency} ${filters.priceMin}`;
        }
        return null;
    }
    buildQuery(baseTerms, extraTerms = []) {
        return this.compactTerms([...baseTerms, ...extraTerms]).join(' ');
    }
    compactTerms(terms) {
        return terms
            .filter((term) => Boolean(term))
            .map((term) => term.trim())
            .filter((term) => term.length > 0);
    }
};
exports.SearchQueryBuilderService = SearchQueryBuilderService;
exports.SearchQueryBuilderService = SearchQueryBuilderService = SearchQueryBuilderService_1 = __decorate([
    (0, common_1.Injectable)()
], SearchQueryBuilderService);
