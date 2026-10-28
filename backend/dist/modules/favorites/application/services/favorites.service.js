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
var FavoritesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoritesService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../../../infrastructure/observability/logger.service");
const request_context_service_1 = require("../../../../infrastructure/observability/request-context.service");
const properties_service_1 = require("../../../properties/application/services/properties.service");
const favorites_repository_1 = require("../../infrastructure/repositories/favorites.repository");
let FavoritesService = FavoritesService_1 = class FavoritesService {
    favoritesRepository;
    propertiesService;
    logger;
    requestContextService;
    constructor(favoritesRepository, propertiesService, logger, requestContextService) {
        this.favoritesRepository = favoritesRepository;
        this.propertiesService = propertiesService;
        this.logger = logger;
        this.requestContextService = requestContextService;
    }
    async listByUserId(userId, page, limit) {
        const [items, total] = await Promise.all([
            this.favoritesRepository.findManyByUserId(userId, page, limit),
            this.favoritesRepository.countByUserId(userId),
        ]);
        this.requestContextService?.set({ userId });
        this.logger.logEvent('favorites listed', {
            module: 'FavoritesService',
            action: 'favorites_listed',
            userId,
            page,
            limit,
            total,
        }, FavoritesService_1.name);
        return {
            items: items.map((favorite) => this.serializeFavoriteListItem(favorite, favorite.propertyCache)),
            meta: {
                page,
                limit,
                total,
            },
        };
    }
    async create(userId, propertyId) {
        const property = await this.propertiesService.findById(propertyId);
        if (!property) {
            this.logger.warnEvent('favorite creation rejected because property was not found', {
                module: 'FavoritesService',
                action: 'favorite_create_rejected',
                userId,
                propertyId,
                reason: 'property_not_found',
            }, FavoritesService_1.name);
            throw new common_1.NotFoundException('Property not found');
        }
        const existingFavorite = await this.favoritesRepository.findByUserIdAndPropertyId(userId, propertyId);
        if (existingFavorite) {
            this.requestContextService?.set({ userId });
            this.logger.logEvent('favorite create returned existing favorite', {
                module: 'FavoritesService',
                action: 'favorite_create_idempotent',
                userId,
                propertyId,
                favoriteId: existingFavorite.id,
            }, FavoritesService_1.name);
            return {
                created: false,
                favorite: {
                    favoriteId: existingFavorite.id,
                    propertyId: existingFavorite.propertyCacheId,
                    createdAt: existingFavorite.createdAt,
                },
            };
        }
        const favorite = await this.favoritesRepository.create(userId, propertyId);
        this.requestContextService?.set({ userId });
        this.logger.logEvent('favorite created', {
            module: 'FavoritesService',
            action: 'favorite_created',
            userId,
            propertyId,
            favoriteId: favorite.id,
        }, FavoritesService_1.name);
        return {
            created: true,
            favorite: {
                favoriteId: favorite.id,
                propertyId: favorite.propertyCacheId,
                createdAt: favorite.createdAt,
            },
        };
    }
    async delete(userId, propertyId) {
        await this.favoritesRepository.deleteByUserIdAndPropertyId(userId, propertyId);
        this.requestContextService?.set({ userId });
        this.logger.logEvent('favorite deleted', {
            module: 'FavoritesService',
            action: 'favorite_deleted',
            userId,
            propertyId,
        }, FavoritesService_1.name);
        return {
            success: true,
        };
    }
    serializeFavoriteListItem(favorite, property) {
        return {
            favoriteId: favorite.id,
            createdAt: favorite.createdAt,
            property: {
                propertyId: property.id,
                source: property.source,
                sourceUrl: property.sourceUrl,
                publisher: property.publisher,
                contactPhone: property.contactPhone,
                contactWhatsApp: property.contactWhatsApp,
                title: property.title,
                operation: property.operation,
                propertyType: property.propertyType,
                price: property.priceAmount === null ? null : Number(property.priceAmount),
                currency: property.priceCurrency,
                city: property.city,
                neighborhood: property.neighborhood,
                listingStatus: property.listingStatus,
                scrapedAt: property.scrapedAt,
                images: Array.isArray(property.imagesJson) ? property.imagesJson : [],
            },
        };
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = FavoritesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [favorites_repository_1.FavoritesRepository,
        properties_service_1.PropertiesService,
        logger_service_1.LoggerService,
        request_context_service_1.RequestContextService])
], FavoritesService);
