import { Injectable } from '@nestjs/common';
import { SearchFilters } from '../../../search-state/domain/types/search-filters.type';

@Injectable()
export class SearchQueryBuilderService {
  private static readonly MAX_DISCOVERY_QUERIES = 4;

  private readonly operationTerms = {
    BUY: 'venta',
    RENT: 'alquiler',
  } as const;

  private readonly propertyTypeTerms = {
    APARTMENT: 'departamento',
    HOUSE: 'casa',
    PH: 'ph',
    LAND: 'terreno',
    OFFICE: 'oficina',
    LOCAL: 'local comercial',
    GARAGE: 'cochera',
  } as const;

  private readonly featureTerms = {
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
  } as const;

  buildPrimaryQuery(filters: SearchFilters) {
    return this.buildDiscoveryQueries(filters)[0] ?? 'propiedades argentina';
  }

  buildDiscoveryQueries(filters: SearchFilters) {
    const baseTerms = this.buildBaseTerms(filters);
    const priceTerm = this.buildPriceTerm(filters);
    const queries = [
      this.buildQuery(baseTerms),
      this.buildQuery(baseTerms, ['publicacion']),
      this.buildQuery(baseTerms, ['ficha']),
      this.buildQuery(baseTerms, priceTerm ? [priceTerm, 'detalle'] : ['detalle']),
    ];

    return Array.from(new Set(queries.filter((query) => query.length > 0))).slice(
      0,
      SearchQueryBuilderService.MAX_DISCOVERY_QUERIES,
    );
  }

  private buildBaseTerms(filters: SearchFilters) {
    const terms: Array<string | null> = [];

    if (filters.propertyTypes.length > 0) {
      terms.push(filters.propertyTypes.map((propertyType) => this.propertyTypeTerms[propertyType]).join(' '));
    } else {
      terms.push('propiedad');
    }

    if (filters.operation) {
      terms.push(this.operationTerms[filters.operation]);
    }

    const geoTerms = this.buildGeoTerms(filters);
    if (geoTerms.length > 0) {
      terms.push(geoTerms.join(' '));
    } else if (filters.locations.length > 0) {
      terms.push(filters.locations.slice(0, 2).join(' '));
    } else {
      terms.push('Argentina');
    }

    if ((filters.roomsAnyOf ?? []).length > 0) {
      terms.push(`${(filters.roomsAnyOf ?? []).join(' o ')} ambientes`);
    } else if (filters.rooms) {
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

  private buildPriceTerm(filters: SearchFilters) {
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

  private buildGeoTerms(filters: SearchFilters) {
    const geoConstraints = filters.geoConstraints ?? [];
    if (geoConstraints.length === 0) {
      return [];
    }

    const primary = geoConstraints[0]!;
    const terms = [
      primary.neighborhood,
      primary.city === 'CABA' || primary.province === 'CABA' ? 'Capital Federal' : primary.city,
      primary.kind === 'PROXIMITY' ? primary.label : null,
    ];

    return this.compactTerms(terms);
  }

  private buildQuery(baseTerms: Array<string | null>, extraTerms: Array<string | null> = []) {
    return this.compactTerms([...baseTerms, ...extraTerms]).join(' ');
  }

  private compactTerms(terms: Array<string | null>) {
    return terms
      .filter((term): term is string => Boolean(term))
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
  }
}
