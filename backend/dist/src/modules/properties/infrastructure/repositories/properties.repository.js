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
exports.PropertiesRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../infrastructure/prisma/prisma.service");
let PropertiesRepository = class PropertiesRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findById(id) {
        return this.prisma.propertyCache.findUnique({
            where: { id },
        });
    }
    async upsertBySourceUrl(input) {
        const canonicalHash = this.buildCanonicalHash(input);
        return this.prisma.propertyCache.upsert({
            where: {
                sourceUrl: input.sourceUrl,
            },
            create: {
                source: input.source,
                externalId: input.externalId ?? null,
                sourceUrl: input.sourceUrl,
                canonicalHash,
                rawPayloadJson: input.rawPayloadJson,
                normalizedPayloadJson: input.normalizedPayloadJson,
                title: input.title,
                description: input.description ?? null,
                publisher: input.publisher ?? null,
                contactPhone: input.contactPhone ?? null,
                contactWhatsApp: input.contactWhatsApp ?? null,
                country: input.country ?? 'Argentina',
                province: input.province ?? 'CABA',
                city: input.city ?? 'CABA',
                neighborhood: input.neighborhood ?? null,
                locationText: input.locationText ?? null,
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                geoPrecision: input.geoPrecision ?? null,
                geocodingProvider: input.geocodingProvider ?? null,
                geocodedAt: input.geocodedAt ?? null,
                operation: input.operation ?? null,
                propertyType: input.propertyType ?? null,
                priceAmount: input.priceAmount ?? null,
                priceCurrency: input.priceCurrency ?? null,
                expensesAmount: input.expensesAmount ?? null,
                rooms: input.rooms ?? null,
                bedrooms: input.bedrooms ?? null,
                bathrooms: input.bathrooms ?? null,
                areaTotal: input.areaTotal ?? null,
                areaCovered: input.areaCovered ?? null,
                featuresJson: input.features,
                imagesJson: input.images,
                listingStatus: client_1.ListingStatus.ACTIVE,
                scrapedAt: input.scrapedAt,
                publishedAt: input.publishedAt ?? null,
            },
            update: {
                externalId: input.externalId ?? null,
                canonicalHash,
                rawPayloadJson: input.rawPayloadJson,
                normalizedPayloadJson: input.normalizedPayloadJson,
                title: input.title,
                description: input.description ?? null,
                publisher: input.publisher ?? null,
                contactPhone: input.contactPhone ?? null,
                contactWhatsApp: input.contactWhatsApp ?? null,
                country: input.country ?? 'Argentina',
                province: input.province ?? 'CABA',
                city: input.city ?? 'CABA',
                neighborhood: input.neighborhood ?? null,
                locationText: input.locationText ?? null,
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                geoPrecision: input.geoPrecision ?? null,
                geocodingProvider: input.geocodingProvider ?? null,
                geocodedAt: input.geocodedAt ?? null,
                operation: input.operation ?? null,
                propertyType: input.propertyType ?? null,
                priceAmount: input.priceAmount ?? null,
                priceCurrency: input.priceCurrency ?? null,
                expensesAmount: input.expensesAmount ?? null,
                rooms: input.rooms ?? null,
                bedrooms: input.bedrooms ?? null,
                bathrooms: input.bathrooms ?? null,
                areaTotal: input.areaTotal ?? null,
                areaCovered: input.areaCovered ?? null,
                featuresJson: input.features,
                imagesJson: input.images,
                listingStatus: client_1.ListingStatus.ACTIVE,
                scrapedAt: input.scrapedAt,
                publishedAt: input.publishedAt ?? null,
            },
        });
    }
    buildCanonicalHash(input) {
        const source = input.source.toLowerCase();
        const title = input.title.trim().toLowerCase().replace(/\s+/g, ' ');
        const neighborhood = (input.neighborhood ?? '').trim().toLowerCase();
        const propertyType = input.propertyType ?? 'UNKNOWN';
        const price = input.priceAmount ?? 0;
        return `${source}::${propertyType}::${neighborhood}::${price}::${title}`;
    }
};
exports.PropertiesRepository = PropertiesRepository;
exports.PropertiesRepository = PropertiesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PropertiesRepository);
