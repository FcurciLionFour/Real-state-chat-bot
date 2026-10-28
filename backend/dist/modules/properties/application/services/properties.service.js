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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const properties_repository_1 = require("../../infrastructure/repositories/properties.repository");
let PropertiesService = class PropertiesService {
    propertiesRepository;
    constructor(propertiesRepository) {
        this.propertiesRepository = propertiesRepository;
    }
    findById(id) {
        return this.propertiesRepository.findById(id);
    }
    async persistSearchResult(result) {
        const normalizedPayload = {
            externalId: result.externalId ?? null,
            source: result.source,
            sourceUrl: result.sourceUrl,
            publisher: result.publisher ?? null,
            contactPhone: result.contactPhone ?? null,
            contactWhatsApp: result.contactWhatsApp ?? null,
            title: result.title,
            description: result.description ?? null,
            operation: result.operation,
            propertyType: result.propertyType,
            price: result.price,
            currency: result.currency,
            expenses: result.expenses,
            country: result.country ?? 'Argentina',
            province: result.province ?? 'CABA',
            city: result.city,
            neighborhood: result.neighborhood,
            locationText: result.locationText,
            rooms: result.rooms,
            bedrooms: result.bedrooms,
            bathrooms: result.bathrooms,
            areaTotal: result.areaTotal,
            areaCovered: result.areaCovered,
            features: result.features,
            images: result.images,
            scrapedAt: result.scrapedAt,
            publishedAt: result.publishedAt,
        };
        return this.propertiesRepository.upsertBySourceUrl({
            externalId: result.externalId ?? null,
            source: result.source,
            sourceUrl: result.sourceUrl,
            publisher: result.publisher ?? null,
            contactPhone: result.contactPhone ?? null,
            contactWhatsApp: result.contactWhatsApp ?? null,
            title: result.title,
            description: result.description ?? null,
            country: result.country ?? 'Argentina',
            province: result.province ?? 'CABA',
            city: result.city,
            neighborhood: result.neighborhood,
            locationText: result.locationText,
            operation: result.operation,
            propertyType: result.propertyType,
            priceAmount: result.price,
            priceCurrency: result.currency,
            expensesAmount: result.expenses,
            rooms: result.rooms,
            bedrooms: result.bedrooms,
            bathrooms: result.bathrooms,
            areaTotal: result.areaTotal,
            areaCovered: result.areaCovered,
            features: result.features,
            images: result.images,
            rawPayloadJson: normalizedPayload,
            normalizedPayloadJson: normalizedPayload,
            scrapedAt: new Date(result.scrapedAt),
            publishedAt: result.publishedAt ? new Date(result.publishedAt) : null,
        });
    }
    persistMockResult(result) {
        return this.persistSearchResult(result);
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [properties_repository_1.PropertiesRepository])
], PropertiesService);
