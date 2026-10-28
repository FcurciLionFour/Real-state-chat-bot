import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';
import { CurrencyCode, FavoriteListItem, OperationType, PropertyResult, PropertyType } from '../../core/types/api.types';
import { RealStateApiService } from '../../core/services/real-state-api.service';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';

type MapProperty = {
  id: string;
  title: string;
  operation: OperationType;
  propertyType: PropertyType;
  price: number;
  currency: CurrencyCode;
  location: string;
  neighborhood: string;
  lat: number;
  lng: number;
  locationPrecision: 'address' | 'area';
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  floor: string;
  expenses: number | null;
  features: string[];
  image: string;
  sourceUrl: string;
};

type MapNavigationState = {
  mapQuery?: string;
  properties?: PropertyResult[];
};

type MapSource = 'navigation' | 'latest-search' | 'favorites' | 'demo';
type MapFilterChipKey = 'query' | 'operation' | 'propertyType' | 'priceMax' | 'rooms';

type MapFilterChip = {
  key: MapFilterChipKey;
  label: string;
  removable: boolean;
};

const MAP_BASE_LAYER_DEFINITIONS = {
  cartoVoyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 20,
      subdomains: 'abcd',
    },
  },
  esriStreets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  },
  esriImagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  },
} satisfies Record<string, { url: string; options: L.TileLayerOptions }>;

const NEIGHBORHOOD_COORDS: Record<string, [number, number]> = {
  palermo: [-34.5889, -58.4306],
  'palermo chico': [-34.5795, -58.4076],
  'palermo soho': [-34.5895, -58.4297],
  'palermo hollywood': [-34.5799, -58.4368],
  recoleta: [-34.5883, -58.3974],
  caballito: [-34.6187, -58.4431],
  almagro: [-34.6094, -58.4217],
  belgrano: [-34.5627, -58.4583],
  'villa crespo': [-34.5985, -58.4427],
  'villa urquiza': [-34.5733, -58.4872],
  'puerto madero': [-34.6118, -58.3626],
  colegiales: [-34.5746, -58.4482],
  chacarita: [-34.5881, -58.4545],
};

const STREET_BLOCK_COORDS: Array<{ pattern: RegExp; blocks: Array<{ min: number; max: number; coords: [number, number] }> }> = [
  {
    pattern: /jer[oó]nimo\s+salguero|salguero/i,
    blocks: [
      { min: 2500, max: 2899, coords: [-34.5799, -58.4108] },
      { min: 2100, max: 2499, coords: [-34.5862, -58.4152] },
      { min: 1500, max: 2099, coords: [-34.5954, -58.4219] },
    ],
  },
  {
    pattern: /gurruchaga/i,
    blocks: [
      { min: 1900, max: 2299, coords: [-34.5864, -58.4268] },
      { min: 1400, max: 1899, coords: [-34.5948, -58.4344] },
    ],
  },
  {
    pattern: /araoz|ar[aá]oz/i,
    blocks: [
      { min: 1000, max: 1499, coords: [-34.5946, -58.4302] },
      { min: 1500, max: 1999, coords: [-34.5888, -58.4248] },
    ],
  },
  {
    pattern: /acu[nñ]a\s+de\s+figueroa/i,
    blocks: [
      { min: 1000, max: 1399, coords: [-34.5942, -58.4208] },
      { min: 1400, max: 1799, coords: [-34.5887, -58.4155] },
    ],
  },
];

const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
];

const DEMO_PROPERTIES: MapProperty[] = [
  {
    id: 'demo-palermo-chico-1',
    title: 'Departamento 4 ambientes',
    operation: 'BUY',
    propertyType: 'APARTMENT',
    price: 800000,
    currency: 'USD',
    location: 'Palermo Chico, CABA',
    neighborhood: 'Palermo Chico',
    lat: -34.5795,
    lng: -58.4076,
    locationPrecision: 'area',
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    area: 160,
    floor: 'Piso 7',
    expenses: 250,
    features: ['Apto credito', 'Cochera', 'Balcon'],
    image: DEMO_IMAGES[0]!,
    sourceUrl: 'https://www.google.com/maps/search/Palermo+Chico+CABA',
  },
  {
    id: 'demo-palermo-soho-1',
    title: 'Departamento 3 ambientes',
    operation: 'BUY',
    propertyType: 'APARTMENT',
    price: 570000,
    currency: 'USD',
    location: 'Palermo Soho, CABA',
    neighborhood: 'Palermo Soho',
    lat: -34.5895,
    lng: -58.4297,
    locationPrecision: 'area',
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    area: 120,
    floor: 'Piso 4',
    expenses: 180,
    features: ['Balcon', 'Amenities'],
    image: DEMO_IMAGES[1]!,
    sourceUrl: 'https://www.google.com/maps/search/Palermo+Soho+CABA',
  },
  {
    id: 'demo-palermo-1',
    title: 'Departamento 2 ambientes',
    operation: 'RENT',
    propertyType: 'APARTMENT',
    price: 450000,
    currency: 'ARS',
    location: 'Palermo, CABA',
    neighborhood: 'Palermo',
    lat: -34.5889,
    lng: -58.4306,
    locationPrecision: 'area',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    area: 55,
    floor: 'Piso 9',
    expenses: 90000,
    features: ['Luminoso', 'Balcon'],
    image: DEMO_IMAGES[2]!,
    sourceUrl: 'https://www.google.com/maps/search/Palermo+CABA',
  },
  {
    id: 'demo-hollywood-1',
    title: 'Departamento 3 ambientes',
    operation: 'BUY',
    propertyType: 'APARTMENT',
    price: 270000,
    currency: 'USD',
    location: 'Palermo Hollywood, CABA',
    neighborhood: 'Palermo Hollywood',
    lat: -34.5799,
    lng: -58.4368,
    locationPrecision: 'area',
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    area: 75,
    floor: 'Piso 2',
    expenses: 120,
    features: ['Cochera', 'Terraza'],
    image: DEMO_IMAGES[3]!,
    sourceUrl: 'https://www.google.com/maps/search/Palermo+Hollywood+CABA',
  },
];

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppSidebarComponent],
  templateUrl: './map-page.component.html',
  styleUrl: './map-page.component.scss',
})
export class MapPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLDivElement>;

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly query = signal('Palermo, CABA');
  protected readonly source = signal<MapSource>('demo');
  protected readonly operationFilter = signal<'ALL' | OperationType>('ALL');
  protected readonly propertyTypeFilter = signal<'ALL' | PropertyType>('ALL');
  protected readonly priceMax = signal<number | null>(null);
  protected readonly roomsFilter = signal<number | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly previewId = signal<string | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly searchAreaDirty = signal(false);
  protected readonly drawingMode = signal(false);
  protected readonly compareIds = signal<string[]>([]);
  protected readonly favoriteIds = signal<string[]>([]);
  protected readonly allProperties = signal<MapProperty[]>(DEMO_PROPERTIES);
  protected readonly visibleProperties = signal<MapProperty[]>(DEMO_PROPERTIES);
  protected readonly filteredProperties = computed(() => {
    const query = this.query().trim().toLowerCase().replace(', caba', '');
    const operation = this.operationFilter();
    const propertyType = this.propertyTypeFilter();
    const priceMax = this.priceMax();
    const rooms = this.roomsFilter();

    return this.visibleProperties()
      .filter((item) => (query ? `${item.title} ${item.location} ${item.neighborhood}`.toLowerCase().includes(query) : true))
      .filter((item) => (operation === 'ALL' ? true : item.operation === operation))
      .filter((item) => (propertyType === 'ALL' ? true : item.propertyType === propertyType))
      .filter((item) => (priceMax === null ? true : item.price <= priceMax))
      .filter((item) => (rooms === null ? true : item.rooms >= rooms));
  });
  protected readonly activeFilterChips = computed<MapFilterChip[]>(() => {
    const chips: MapFilterChip[] = [];
    const query = this.query().replace(/,\s*caba$/i, '').trim();
    const operation = this.operationFilter();
    const propertyType = this.propertyTypeFilter();
    const priceMax = this.priceMax();
    const rooms = this.roomsFilter();

    if (query) {
      chips.push({ key: 'query', label: this.toTitleCase(query), removable: true });
    }

    if (operation !== 'ALL') {
      chips.push({ key: 'operation', label: operation === 'BUY' ? 'Venta' : 'Alquiler', removable: true });
    }

    if (propertyType !== 'ALL') {
      chips.push({ key: 'propertyType', label: this.formatPropertyTypeLabel(propertyType), removable: true });
    }

    if (priceMax !== null) {
      chips.push({ key: 'priceMax', label: `Hasta ${this.formatShortMoney(priceMax, 'USD')}`, removable: true });
    }

    if (rooms !== null) {
      chips.push({ key: 'rooms', label: `${rooms} ambiente${rooms === 1 ? '' : 's'}`, removable: true });
    }

    return chips;
  });
  protected readonly previewProperty = computed(() => {
    const previewId = this.previewId();
    return this.filteredProperties().find((item) => item.id === previewId) ?? null;
  });
  protected readonly selectedProperty = computed(() => {
    const selectedId = this.selectedId();
    return this.allProperties().find((item) => item.id === selectedId) ?? this.previewProperty();
  });

  private readonly api = inject(RealStateApiService);
  private readonly router = inject(Router);
  private readonly navigationState = this.readNavigationState();
  private map?: L.Map;
  private markers = new Map<string, L.Marker>();
  private moveDebounce?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private suppressNextMove = false;

  async ngAfterViewInit() {
    await this.loadInitialProperties();
    this.initMap();
    this.syncMapAfterLayout();
  }

  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.moveDebounce);

    if (this.map) {
      this.map.off('moveend zoomend', this.handleMapMoved);
      this.markers.forEach((marker) => marker.off());
      this.markers.clear();
      this.map.remove();
      this.map = undefined;
    }
  }

  protected updateQuery(value: string) {
    this.query.set(value);
    this.applyFiltersAndRender(true);
  }

  protected setOperation(value: 'ALL' | OperationType) {
    this.operationFilter.set(value);
    this.applyFiltersAndRender(false);
  }

  protected setPropertyType(value: 'ALL' | PropertyType) {
    this.propertyTypeFilter.set(value);
    this.applyFiltersAndRender(false);
  }

  protected setPriceMax(value: string) {
    const numeric = Number(value);
    this.priceMax.set(Number.isFinite(numeric) && numeric > 0 ? numeric : null);
    this.applyFiltersAndRender(false);
  }

  protected setRooms(value: string) {
    const numeric = Number(value);
    this.roomsFilter.set(Number.isFinite(numeric) && numeric > 0 ? numeric : null);
    this.applyFiltersAndRender(false);
  }

  protected removeFilterChip(key: MapFilterChipKey) {
    if (key === 'query') {
      this.updateQuery('');
      return;
    }

    if (key === 'operation') {
      this.setOperation('ALL');
      return;
    }

    if (key === 'propertyType') {
      this.setPropertyType('ALL');
      return;
    }

    if (key === 'priceMax') {
      this.setPriceMax('');
      return;
    }

    this.setRooms('');
  }

  protected searchCurrentArea() {
    this.applyCurrentMapBounds(true);
    this.searchAreaDirty.set(false);
    this.renderMarkers();
  }

  protected toggleDrawingMode() {
    this.drawingMode.update((current) => !current);
  }

  protected selectFromList(property: MapProperty) {
    this.previewPropertyOnMap(property, true);
  }

  protected openDetail(property: MapProperty) {
    this.selectedId.set(property.id);
    this.previewId.set(property.id);
    this.detailOpen.set(true);
    this.centerMap(property, false);
  }

  protected closeDetail() {
    this.detailOpen.set(false);
  }

  protected closePreview() {
    this.previewId.set(null);
  }

  protected toggleCompare(property: MapProperty) {
    this.compareIds.update((current) => {
      if (current.includes(property.id)) {
        return current.filter((id) => id !== property.id);
      }

      return current.length >= 2 ? [current[1]!, property.id] : [...current, property.id];
    });
  }

  protected isComparing(property: MapProperty) {
    return this.compareIds().includes(property.id);
  }

  protected async toggleFavorite(property: MapProperty) {
    if (this.favoriteIds().includes(property.id)) {
      this.favoriteIds.update((current) => current.filter((id) => id !== property.id));
      try {
        await firstValueFrom(this.api.removeFavorite(property.id));
      } catch {
        this.favoriteIds.update((current) => [...current, property.id]);
      }
      return;
    }

    this.favoriteIds.update((current) => [...current, property.id]);
    try {
      await firstValueFrom(this.api.addFavorite(property.id));
    } catch {
      this.favoriteIds.update((current) => current.filter((id) => id !== property.id));
    }
  }

  protected isFavorite(property: MapProperty) {
    return this.favoriteIds().includes(property.id);
  }

  protected async openInChat(property: MapProperty) {
    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: `Quiero buscar propiedades similares a ${property.title} en ${property.location}, cerca de ${this.formatPrice(property)}.`,
        autoSend: false,
      },
    });
  }

  protected formatPrice(property: MapProperty) {
    const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(property.price);
    return `${property.currency} ${amount}`;
  }

  protected formatShortPrice(property: MapProperty) {
    if (property.currency === 'ARS') {
      return property.price >= 1000000 ? `ARS ${(property.price / 1000000).toFixed(1)}M` : `ARS ${Math.round(property.price / 1000)}K`;
    }

    return property.price >= 1000000 ? `USD ${(property.price / 1000000).toFixed(1)}M` : `USD ${Math.round(property.price / 1000)}K`;
  }

  protected formatPropertyTypeLabel(value: PropertyType) {
    const labels: Record<PropertyType, string> = {
      APARTMENT: 'Departamento',
      HOUSE: 'Casa',
      PH: 'PH',
      LAND: 'Terreno',
      OFFICE: 'Oficina',
      LOCAL: 'Local',
      GARAGE: 'Garage',
    };

    return labels[value] ?? value;
  }

  private formatShortMoney(amount: number, currency: CurrencyCode) {
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      return `${currency} ${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
    }

    if (amount >= 1000) {
      return `${currency} ${Math.round(amount / 1000)}k`;
    }

    return `${currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)}`;
  }

  private toTitleCase(value: string) {
    return value
      .toLowerCase()
      .replace(/(^|[\s-])([a-záéíóúñ])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }

  protected formatSourceLabel() {
    const labels: Record<MapSource, string> = {
      navigation: 'Resultados enviados al mapa',
      'latest-search': 'Ultima busqueda',
      favorites: 'Favoritos',
      demo: 'Zona default',
    };

    return labels[this.source()];
  }

  protected trackProperty(index: number, property: MapProperty) {
    return property.id;
  }

  private async loadInitialProperties() {
    this.loading.set(true);
    this.error.set('');

    try {
      const navigationProperties = this.navigationState.properties ?? [];
      if (navigationProperties.length > 0) {
        this.useProperties(
          navigationProperties.map((item, index) => this.fromPropertyResult(item, index)),
          'navigation',
          this.navigationState.mapQuery,
        );
        return;
      }

      const conversations = await firstValueFrom(this.api.listConversations(1, 1));
      const latestConversation = conversations.items[0];
      if (latestConversation) {
        const detail = await firstValueFrom(this.api.getConversation(latestConversation.id));
        if (detail.lastSearchResults.length > 0) {
          this.useProperties(
            detail.lastSearchResults.map((item, index) => this.fromPropertyResult(item, index)),
            'latest-search',
            detail.searchState.locations[0],
          );
          return;
        }
      }

      const favorites = await firstValueFrom(this.api.listFavorites(1, 30));
      const mappedFavorites = favorites.items.map((item, index) => this.fromFavorite(item, index));
      if (mappedFavorites.length > 0) {
        this.useProperties(mappedFavorites, 'favorites');
        return;
      }

      this.useProperties(DEMO_PROPERTIES, 'demo');
    } catch {
      this.error.set('No se pudo actualizar el mapa. Mostramos una zona de referencia.');
      this.useProperties(DEMO_PROPERTIES, 'demo');
    } finally {
      this.loading.set(false);
    }
  }

  private useProperties(properties: MapProperty[], source: MapSource, query?: string) {
    const next = properties.length > 0 ? properties : DEMO_PROPERTIES;
    this.source.set(source);
    this.allProperties.set(next);
    this.visibleProperties.set(next);
    this.selectedId.set(next[0]?.id ?? null);
    this.previewId.set(next[0]?.id ?? null);
    this.query.set(query || next[0]?.neighborhood || 'Palermo, CABA');
  }

  private readNavigationState(): MapNavigationState {
    const state = history.state as MapNavigationState | null;

    if (!state || typeof state !== 'object') {
      return {};
    }

    return {
      mapQuery: typeof state.mapQuery === 'string' ? state.mapQuery : undefined,
      properties: Array.isArray(state.properties) ? state.properties : undefined,
    };
  }

  private fromPropertyResult(property: PropertyResult, index: number): MapProperty {
    const neighborhood = property.neighborhood || property.city || property.locationText || 'Palermo';
    const location = property.locationText || [property.neighborhood, property.city].filter(Boolean).join(', ') || 'CABA';
    const resolved = property.geo
      ? {
          coords: [property.geo.latitude, property.geo.longitude] as [number, number],
          precision: property.geo.precision === 'exact' || property.geo.precision === 'street' ? 'address' as const : 'area' as const,
        }
      : this.resolveCoords(location, neighborhood);

    return {
      id: property.propertyId,
      title: property.title,
      operation: property.operation ?? 'BUY',
      propertyType: property.propertyType ?? 'APARTMENT',
      price: property.price ?? 0,
      currency: property.currency ?? 'USD',
      location,
      neighborhood,
      lat: resolved.coords[0],
      lng: resolved.coords[1],
      locationPrecision: resolved.precision,
      rooms: property.rooms ?? property.bedrooms ?? 1,
      bedrooms: property.bedrooms ?? Math.max((property.rooms ?? 2) - 1, 1),
      bathrooms: property.bathrooms ?? 1,
      area: property.areaTotal ?? property.areaCovered ?? 50,
      floor: property.features.find((feature) => /piso/i.test(feature)) ?? 'Datos a confirmar',
      expenses: property.expenses,
      features: property.features,
      image: property.images[0] || DEMO_IMAGES[index % DEMO_IMAGES.length]!,
      sourceUrl: property.sourceUrl,
    };
  }

  private fromFavorite(favorite: FavoriteListItem, index: number): MapProperty {
    const property = favorite.property;
    const neighborhood = property.neighborhood || property.city || 'Palermo';
    const location = property.locationText || [property.neighborhood, property.city].filter(Boolean).join(', ') || 'CABA';
    const resolved = property.geo
      ? {
          coords: [property.geo.latitude, property.geo.longitude] as [number, number],
          precision: property.geo.precision === 'exact' || property.geo.precision === 'street' ? 'address' as const : 'area' as const,
        }
      : this.resolveCoords(location, neighborhood);

    return {
      id: property.propertyId,
      title: property.title,
      operation: property.operation ?? 'BUY',
      propertyType: property.propertyType ?? 'APARTMENT',
      price: property.price ?? 0,
      currency: property.currency ?? 'USD',
      location,
      neighborhood,
      lat: resolved.coords[0],
      lng: resolved.coords[1],
      locationPrecision: resolved.precision,
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      area: 50,
      floor: 'Datos a confirmar',
      expenses: null,
      features: [],
      image: property.images[0] || DEMO_IMAGES[index % DEMO_IMAGES.length]!,
      sourceUrl: property.sourceUrl,
    };
  }

  private resolveCoords(location: string, neighborhood: string): { coords: [number, number]; precision: 'address' | 'area' } {
    const streetCoords = this.resolveStreetBlockCoords(location);

    if (streetCoords) {
      return {
        coords: streetCoords,
        precision: 'address',
      };
    }

    const normalized = `${location} ${neighborhood}`.trim().toLowerCase();
    const key = Object.keys(NEIGHBORHOOD_COORDS).find((item) => normalized.includes(item)) ?? 'palermo';

    return {
      coords: NEIGHBORHOOD_COORDS[key]!,
      precision: 'area',
    };
  }

  private resolveStreetBlockCoords(location: string): [number, number] | null {
    const numberMatch = location.match(/\b(\d{3,5})\b/);
    const streetNumber = numberMatch ? Number(numberMatch[1]) : null;

    if (streetNumber === null) {
      return null;
    }

    for (const street of STREET_BLOCK_COORDS) {
      if (!street.pattern.test(location)) {
        continue;
      }

      const block = street.blocks.find((item) => streetNumber >= item.min && streetNumber <= item.max);
      if (block) {
        return block.coords;
      }
    }

    return null;
  }

  private initMap() {
    const canvas = this.mapCanvas?.nativeElement;
    if (this.destroyed || !canvas || this.map) {
      return;
    }

    this.map = L.map(canvas, {
      zoomControl: false,
      scrollWheelZoom: true,
    }).setView([-34.5889, -58.4306], 13);

    const baseLayers = this.createBaseLayers();
    baseLayers.cartoVoyager.addTo(this.map);

    L.control
      .layers(
        {
          Claro: baseLayers.cartoVoyager,
          Calles: baseLayers.esriStreets,
          Satelite: baseLayers.esriImagery,
        },
        undefined,
        { position: 'topright' },
      )
      .addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.map.on('moveend zoomend', this.handleMapMoved);
  }

  private createBaseLayers() {
    return {
      cartoVoyager: L.tileLayer(MAP_BASE_LAYER_DEFINITIONS.cartoVoyager.url, MAP_BASE_LAYER_DEFINITIONS.cartoVoyager.options),
      esriStreets: L.tileLayer(MAP_BASE_LAYER_DEFINITIONS.esriStreets.url, MAP_BASE_LAYER_DEFINITIONS.esriStreets.options),
      esriImagery: L.tileLayer(MAP_BASE_LAYER_DEFINITIONS.esriImagery.url, MAP_BASE_LAYER_DEFINITIONS.esriImagery.options),
    };
  }

  private syncMapAfterLayout() {
    requestAnimationFrame(() => {
      if (this.destroyed || !this.map) {
        return;
      }

      this.map.invalidateSize();
      this.fitToProperties(this.filteredProperties(), false);
      this.applyCurrentMapBounds(false);
      this.renderMarkers();
      this.searchAreaDirty.set(false);
    });
  }

  private applyFiltersAndRender(fit: boolean) {
    this.visibleProperties.set(this.allProperties());
    this.renderMarkers();

    if (fit) {
      this.fitToProperties(this.filteredProperties(), true);
    }
  }

  private applyCurrentMapBounds(keepPreview: boolean) {
    const bounds = this.map?.getBounds();
    if (!bounds) {
      this.visibleProperties.set(this.allProperties());
      return;
    }

    const visible = this.allProperties().filter((property) => bounds.contains([property.lat, property.lng]));
    this.visibleProperties.set(visible.length > 0 ? visible : []);

    if (!keepPreview && this.filteredProperties()[0]) {
      this.previewId.set(this.filteredProperties()[0]!.id);
    }
  }

  private renderMarkers() {
    if (this.destroyed || !this.map) {
      return;
    }

    this.markers.forEach((marker) => {
      marker.off();
      marker.remove();
    });
    this.markers.clear();

    const zoom = this.map.getZoom();
    const clusters = this.buildClusters(this.filteredProperties(), zoom);

    for (const cluster of clusters) {
      if (cluster.items.length > 1) {
        const marker = L.marker([cluster.lat, cluster.lng], {
          icon: L.divIcon({
            className: '',
            html: `<button class="map-cluster-pin">${cluster.items.length}</button>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        });
        marker.on('click', () => {
          this.suppressNextMove = true;
          this.map?.setView([cluster.lat, cluster.lng], Math.min((this.map?.getZoom() ?? 13) + 2, 17), { animate: true });
        });
        marker.addTo(this.map);
        this.markers.set(`cluster-${cluster.lat}-${cluster.lng}`, marker);
        continue;
      }

      const property = cluster.items[0]!;
      const marker = L.marker([property.lat, property.lng], {
        icon: L.divIcon({
          className: '',
          html: `<button class="map-price-pin ${property.operation === 'RENT' ? 'map-price-pin--rent' : ''} ${property.locationPrecision === 'area' ? 'map-price-pin--area' : ''}">${this.formatShortPrice(property)}</button>`,
          iconSize: [92, 32],
          iconAnchor: [46, 32],
        }),
      });
      marker.on('click', () => this.previewPropertyOnMap(property, false));
      marker.addTo(this.map);
      this.markers.set(property.id, marker);
    }
  }

  private buildClusters(properties: MapProperty[], zoom: number) {
    const precision = zoom < 12 ? 0.035 : zoom < 14 ? 0.018 : 0;

    if (precision === 0) {
      return properties.map((property) => ({ lat: property.lat, lng: property.lng, items: [property] }));
    }

    const buckets = new Map<string, MapProperty[]>();
    for (const property of properties) {
      const lat = Math.round(property.lat / precision) * precision;
      const lng = Math.round(property.lng / precision) * precision;
      const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), property]);
    }

    return [...buckets.entries()].map(([key, items]) => {
      const [lat, lng] = key.split(':').map(Number);
      return { lat: lat!, lng: lng!, items };
    });
  }

  private previewPropertyOnMap(property: MapProperty, center: boolean) {
    this.selectedId.set(property.id);
    this.previewId.set(property.id);

    if (center) {
      this.centerMap(property, true);
    }
  }

  private centerMap(property: MapProperty, animate: boolean) {
    this.suppressNextMove = true;
    this.map?.setView([property.lat, property.lng], Math.max(this.map.getZoom(), 14), { animate });
  }

  private fitToProperties(properties: MapProperty[], animate: boolean) {
    if (!this.map || properties.length === 0) {
      return;
    }

    if (properties.length === 1) {
      this.suppressNextMove = true;
      this.map.setView([properties[0]!.lat, properties[0]!.lng], 14, { animate });
      return;
    }

    this.suppressNextMove = true;
    this.map.fitBounds(L.latLngBounds(properties.map((item) => [item.lat, item.lng])), {
      animate,
      padding: [42, 42],
      maxZoom: 14,
    });
  }

  private handleMapMoved = () => {
    if (this.destroyed) {
      return;
    }

    if (this.suppressNextMove) {
      this.suppressNextMove = false;
      return;
    }

    clearTimeout(this.moveDebounce);
    this.moveDebounce = setTimeout(() => {
      if (!this.destroyed) {
        this.searchAreaDirty.set(true);
        this.closePreview();
      }
    }, 350);
  };
}
