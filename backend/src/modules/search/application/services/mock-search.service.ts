import { Injectable } from '@nestjs/common';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';

@Injectable()
export class MockSearchService {
  search(searchState: SearchFilters): SearchResultItem[] {
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

  buildQueryText(searchState: SearchFilters) {
    const parts: string[] = [];

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
}
