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
exports.OwnerSubmittedSearchService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let OwnerSubmittedSearchService = class OwnerSubmittedSearchService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findCandidates(searchState) {
        const where = {
            source: 'OWNER_SUBMITTED',
            listingStatus: client_1.ListingStatus.ACTIVE,
            ...(searchState.operation ? { operation: searchState.operation } : {}),
            ...(searchState.propertyTypes.length > 0 ? { propertyType: { in: searchState.propertyTypes } } : {}),
            ...(searchState.currency ? { priceCurrency: searchState.currency } : {}),
            ...(searchState.priceMin !== null || searchState.priceMax !== null
                ? {
                    priceAmount: {
                        ...(searchState.priceMin !== null ? { gte: searchState.priceMin } : {}),
                        ...(searchState.priceMax !== null ? { lte: searchState.priceMax } : {}),
                    },
                }
                : {}),
        };
        const items = await this.prisma.propertyCache.findMany({
            where,
            orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
            take: 24,
        });
        return items.map((property) => ({
            externalId: property.externalId,
            source: property.source,
            sourceUrl: property.sourceUrl,
            publisher: property.publisher,
            contactPhone: property.contactPhone,
            contactWhatsApp: property.contactWhatsApp,
            title: property.title,
            description: property.description,
            operation: property.operation,
            propertyType: property.propertyType,
            price: property.priceAmount === null ? null : Number(property.priceAmount),
            currency: property.priceCurrency,
            expenses: property.expensesAmount === null ? null : Number(property.expensesAmount),
            country: property.country,
            province: property.province,
            city: property.city,
            neighborhood: property.neighborhood,
            locationText: property.locationText,
            geo: property.latitude !== null && property.longitude !== null
                ? {
                    latitude: Number(property.latitude),
                    longitude: Number(property.longitude),
                    precision: this.readGeoPrecision(property.geoPrecision),
                    provider: property.geocodingProvider ?? 'unknown',
                }
                : null,
            rooms: property.rooms === null ? null : Number(property.rooms),
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            areaTotal: property.areaTotal === null ? null : Number(property.areaTotal),
            areaCovered: property.areaCovered === null ? null : Number(property.areaCovered),
            features: this.readFeatures(property.featuresJson),
            images: Array.isArray(property.imagesJson)
                ? property.imagesJson.filter((item) => typeof item === 'string')
                : [],
            scrapedAt: property.scrapedAt.toISOString(),
            publishedAt: property.publishedAt?.toISOString() ?? null,
        }));
    }
    readFeatures(value) {
        const allowed = new Set([
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
        return Array.isArray(value)
            ? value.filter((item) => typeof item === 'string' && allowed.has(item))
            : [];
    }
    readGeoPrecision(value) {
        return value === 'exact' || value === 'street' || value === 'neighborhood' || value === 'unknown'
            ? value
            : 'unknown';
    }
};
exports.OwnerSubmittedSearchService = OwnerSubmittedSearchService;
exports.OwnerSubmittedSearchService = OwnerSubmittedSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OwnerSubmittedSearchService);
