import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../infrastructure/observability/logger.service';
import { GeoConstraint, SearchFilters } from '../../../search-state/domain/types/search-filters.type';
import { SearchResultItem } from '../../domain/types/search-result.type';

type SearchCandidate = Omit<SearchResultItem, 'rank'>;

type LocalPlace = {
  aliases: string[];
  label: string;
  province: string;
  city: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  confidence: number;
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  }>;
};

type GoogleAddressComponent = NonNullable<NonNullable<GoogleGeocodeResponse['results']>[number]['address_components']>[number];

const DEFAULT_PROXIMITY_RADIUS_METERS = 1000;

const LOCAL_PLACES: LocalPlace[] = [
  {
    aliases: ['alto palermo', 'alto palermo shopping'],
    label: 'Alto Palermo Shopping',
    province: 'CABA',
    city: 'CABA',
    neighborhood: 'Palermo',
    latitude: -34.5881,
    longitude: -58.4106,
    confidence: 0.95,
  },
  {
    aliases: ['bosques de palermo', 'bosque de palermo', 'parque tres de febrero'],
    label: 'Bosques de Palermo',
    province: 'CABA',
    city: 'CABA',
    neighborhood: 'Palermo',
    latitude: -34.5697,
    longitude: -58.4173,
    confidence: 0.9,
  },
  {
    aliases: ['palermo'],
    label: 'Palermo',
    province: 'CABA',
    city: 'CABA',
    neighborhood: 'Palermo',
    latitude: -34.5889,
    longitude: -58.4306,
    confidence: 0.82,
  },
];

const LOCAL_NEIGHBORHOODS: Record<string, { province: string; city: string; latitude: number; longitude: number }> = {
  palermo: { province: 'CABA', city: 'CABA', latitude: -34.5889, longitude: -58.4306 },
  recoleta: { province: 'CABA', city: 'CABA', latitude: -34.5883, longitude: -58.3974 },
  caballito: { province: 'CABA', city: 'CABA', latitude: -34.6187, longitude: -58.4431 },
  almagro: { province: 'CABA', city: 'CABA', latitude: -34.6094, longitude: -58.4217 },
  belgrano: { province: 'CABA', city: 'CABA', latitude: -34.5627, longitude: -58.4583 },
  'villa crespo': { province: 'CABA', city: 'CABA', latitude: -34.5985, longitude: -58.4427 },
};

@Injectable()
export class SearchGeoService {
  private readonly memoryCache = new Map<string, GeoConstraint | null>();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async enrichSearchState(searchState: SearchFilters): Promise<SearchFilters> {
    const nextState = structuredClone(searchState);
    const currentConstraints = nextState.geoConstraints ?? [];
    const constraints = currentConstraints.length > 0
      ? currentConstraints
      : this.buildAreaConstraintsFromLocations(nextState.locations);

    nextState.geoConstraints = await Promise.all(constraints.map((constraint) => this.resolveConstraint(constraint)));

    return nextState;
  }

  async enrichCandidates(candidates: SearchCandidate[]) {
    return candidates.map((candidate) => this.enrichCandidate(candidate));
  }

  private async resolveConstraint(constraint: GeoConstraint): Promise<GeoConstraint> {
    if (this.isResolved(constraint)) {
      return this.normalizeConstraintDefaults(constraint);
    }

    const cacheKey = `${constraint.kind}:${constraint.sourceText}:${constraint.city ?? ''}:${constraint.province ?? ''}`.toLowerCase();
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey) ?? this.normalizeConstraintDefaults(constraint);
    }

    const local = this.resolveLocalPlace(constraint);
    if (local) {
      this.memoryCache.set(cacheKey, local);
      return local;
    }

    const google = await this.resolveWithGoogle(constraint);
    const resolved = google ?? this.normalizeConstraintDefaults(constraint);
    this.memoryCache.set(cacheKey, resolved);

    return resolved;
  }

  private buildAreaConstraintsFromLocations(locations: string[]): GeoConstraint[] {
    return locations
      .map((location) => this.resolveLocalNeighborhood(location))
      .filter((constraint): constraint is GeoConstraint => constraint !== null);
  }

  private resolveLocalPlace(constraint: GeoConstraint): GeoConstraint | null {
    const normalizedSource = this.normalizeText(`${constraint.sourceText} ${constraint.label}`);
    const place = LOCAL_PLACES.find((item) => item.aliases.some((alias) => normalizedSource.includes(alias)));

    if (!place) {
      return this.resolveLocalNeighborhood(constraint.sourceText) ?? this.resolveLocalNeighborhood(constraint.label);
    }

    return {
      ...constraint,
      label: place.label,
      province: place.province,
      city: place.city,
      neighborhood: place.neighborhood,
      latitude: place.latitude,
      longitude: place.longitude,
      radiusMeters: constraint.kind === 'PROXIMITY'
        ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
        : constraint.radiusMeters,
      confidence: Math.max(constraint.confidence, place.confidence),
      provider: 'local-poi',
    };
  }

  private resolveLocalNeighborhood(value: string): GeoConstraint | null {
    const normalized = this.normalizeText(value);
    const key = Object.keys(LOCAL_NEIGHBORHOODS).find((item) => normalized.includes(item));

    if (!key) {
      return null;
    }

    const neighborhood = LOCAL_NEIGHBORHOODS[key]!;
    return {
      kind: 'AREA',
      sourceText: value,
      label: this.titleCase(key),
      province: neighborhood.province,
      city: neighborhood.city,
      neighborhood: this.titleCase(key),
      latitude: neighborhood.latitude,
      longitude: neighborhood.longitude,
      radiusMeters: null,
      confidence: 0.8,
      provider: 'local-neighborhood',
    };
  }

  private async resolveWithGoogle(constraint: GeoConstraint): Promise<GeoConstraint | null> {
    if (this.configService.get<string>('geocoding.provider', 'local') !== 'google') {
      return null;
    }

    const apiKey = this.configService.get<string>('geocoding.googleApiKey', '').trim();
    if (!apiKey) {
      return null;
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', this.buildGoogleQuery(constraint));
      url.searchParams.set('region', 'ar');
      url.searchParams.set('language', 'es');
      url.searchParams.set('components', 'country:AR');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.configService.get<number>('geocoding.timeoutMs', 3500)),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as GoogleGeocodeResponse;
      const first = payload.results?.[0];
      const latitude = first?.geometry?.location?.lat;
      const longitude = first?.geometry?.location?.lng;

      if (!first || payload.status !== 'OK' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        ...constraint,
        label: first.formatted_address ?? constraint.label,
        province: this.readGoogleComponent(first.address_components, ['administrative_area_level_1']) ?? constraint.province,
        city:
          this.readGoogleComponent(first.address_components, ['locality', 'administrative_area_level_2']) ??
          constraint.city,
        neighborhood:
          this.readGoogleComponent(first.address_components, ['neighborhood', 'sublocality', 'sublocality_level_1']) ??
          constraint.neighborhood,
        latitude: latitude!,
        longitude: longitude!,
        radiusMeters: constraint.kind === 'PROXIMITY'
          ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
          : constraint.radiusMeters,
        confidence: Math.max(constraint.confidence, 0.85),
        provider: 'google-geocoding',
      };
    } catch (error) {
      this.logger.warn('google geocoding failed for search geo constraint', {
        module: 'SearchGeoService',
        action: 'search_geo_google_failed',
        sourceText: constraint.sourceText,
        error: error instanceof Error ? error.message : 'unknown',
      });

      return null;
    }
  }

  private enrichCandidate(candidate: SearchCandidate): SearchCandidate {
    if (candidate.geo) {
      return candidate;
    }

    const location = this.normalizeText(
      `${candidate.locationText ?? ''} ${candidate.neighborhood ?? ''} ${candidate.city ?? ''} ${candidate.province ?? ''}`,
    );
    const place = LOCAL_PLACES.find((item) => item.aliases.some((alias) => location.includes(alias)));
    if (place) {
      return {
        ...candidate,
        province: candidate.province ?? place.province,
        city: candidate.city ?? place.city,
        neighborhood: candidate.neighborhood ?? place.neighborhood,
        geo: {
          latitude: place.latitude,
          longitude: place.longitude,
          precision: 'neighborhood',
          provider: 'local-poi',
        },
      };
    }

    const neighborhoodKey = Object.keys(LOCAL_NEIGHBORHOODS).find((item) => location.includes(item));
    if (!neighborhoodKey) {
      return candidate;
    }

    const neighborhood = LOCAL_NEIGHBORHOODS[neighborhoodKey]!;
    return {
      ...candidate,
      province: candidate.province ?? neighborhood.province,
      city: candidate.city ?? neighborhood.city,
      neighborhood: candidate.neighborhood ?? this.titleCase(neighborhoodKey),
      geo: {
        latitude: neighborhood.latitude,
        longitude: neighborhood.longitude,
        precision: 'neighborhood',
        provider: 'local-neighborhood',
      },
    };
  }

  private normalizeConstraintDefaults(constraint: GeoConstraint): GeoConstraint {
    return {
      ...constraint,
      radiusMeters: constraint.kind === 'PROXIMITY'
        ? constraint.radiusMeters ?? DEFAULT_PROXIMITY_RADIUS_METERS
        : constraint.radiusMeters,
      confidence: Number(Math.max(0, Math.min(1, constraint.confidence)).toFixed(2)),
    };
  }

  private isResolved(constraint: GeoConstraint) {
    return Number.isFinite(constraint.latitude) && Number.isFinite(constraint.longitude);
  }

  private buildGoogleQuery(constraint: GeoConstraint) {
    return [
      constraint.sourceText,
      constraint.neighborhood,
      constraint.city,
      constraint.province,
      'Argentina',
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(', ');
  }

  private readGoogleComponent(
    components: GoogleAddressComponent[] | undefined,
    types: string[],
  ) {
    if (!Array.isArray(components)) {
      return null;
    }

    const component = components.find((item) => item.types?.some((type) => types.includes(type)));
    return component?.long_name ?? component?.short_name ?? null;
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private titleCase(value: string) {
    return value
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
