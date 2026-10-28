import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { RequestContextService } from '../../../../infrastructure/observability/request-context.service';
import { Favorite, PropertyCache } from '@prisma/client';
import { PropertiesService } from '../../../properties/application/services/properties.service';
import { FavoritesRepository } from '../../infrastructure/repositories/favorites.repository';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly propertiesService: PropertiesService,
    private readonly logger: LoggerService,
    @Optional() private readonly requestContextService?: RequestContextService,
  ) {}

  async listByUserId(userId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.favoritesRepository.findManyByUserId(userId, page, limit),
      this.favoritesRepository.countByUserId(userId),
    ]);
    this.requestContextService?.set({ userId });
    this.logger.logEvent(
      'favorites listed',
      {
        module: 'FavoritesService',
        action: 'favorites_listed',
        userId,
        page,
        limit,
        total,
      },
      FavoritesService.name,
    );

    return {
      items: items.map((favorite) => this.serializeFavoriteListItem(favorite, favorite.propertyCache)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async create(userId: string, propertyId: string) {
    const property = await this.propertiesService.findById(propertyId);

    if (!property) {
      this.logger.warnEvent(
        'favorite creation rejected because property was not found',
        {
          module: 'FavoritesService',
          action: 'favorite_create_rejected',
          userId,
          propertyId,
          reason: 'property_not_found',
        },
        FavoritesService.name,
      );
      throw new NotFoundException('Property not found');
    }

    const existingFavorite = await this.favoritesRepository.findByUserIdAndPropertyId(userId, propertyId);

    if (existingFavorite) {
      this.requestContextService?.set({ userId });
      this.logger.logEvent(
        'favorite create returned existing favorite',
        {
          module: 'FavoritesService',
          action: 'favorite_create_idempotent',
          userId,
          propertyId,
          favoriteId: existingFavorite.id,
        },
        FavoritesService.name,
      );
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
    this.logger.logEvent(
      'favorite created',
      {
        module: 'FavoritesService',
        action: 'favorite_created',
        userId,
        propertyId,
        favoriteId: favorite.id,
      },
      FavoritesService.name,
    );

    return {
      created: true,
      favorite: {
        favoriteId: favorite.id,
        propertyId: favorite.propertyCacheId,
        createdAt: favorite.createdAt,
      },
    };
  }

  async delete(userId: string, propertyId: string) {
    await this.favoritesRepository.deleteByUserIdAndPropertyId(userId, propertyId);
    this.requestContextService?.set({ userId });
    this.logger.logEvent(
      'favorite deleted',
      {
        module: 'FavoritesService',
        action: 'favorite_deleted',
        userId,
        propertyId,
      },
      FavoritesService.name,
    );

    return {
      success: true,
    };
  }

  private serializeFavoriteListItem(
    favorite: Favorite,
    property: PropertyCache,
  ) {
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
        locationText: property.locationText,
        geo:
          property.latitude !== null && property.longitude !== null
            ? {
                latitude: Number(property.latitude),
                longitude: Number(property.longitude),
                precision: property.geoPrecision ?? 'unknown',
                provider: property.geocodingProvider ?? 'unknown',
                geocodedAt: property.geocodedAt,
              }
            : null,
        listingStatus: property.listingStatus,
        scrapedAt: property.scrapedAt,
        images: Array.isArray(property.imagesJson) ? property.imagesJson : [],
      },
    };
  }
}
