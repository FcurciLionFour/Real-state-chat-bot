import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/services/auth.store';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';
import { FavoriteListItem, OperationType, PropertyType } from '../../core/types/api.types';
import { AppSidebarComponent } from '../../shared/app-sidebar/app-sidebar.component';

type FavoritesCollection = 'ALL' | 'BUY' | 'RENT' | 'RECENT' | 'REVIEW';
type FavoritesSortOption = 'RECENT' | 'PRICE_ASC' | 'PRICE_DESC' | 'LOCATION';
type OperationFilter = 'ALL' | OperationType;
type PropertyTypeFilter = 'ALL' | PropertyType;

@Component({
  selector: 'app-favorites-page',
  imports: [CommonModule, AppSidebarComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
})
export class FavoritesPageComponent {
  protected readonly favorites = signal<FavoriteListItem[]>([]);
  protected readonly compareSelection = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyIds = signal<string[]>([]);
  protected readonly error = signal('');
  protected readonly activeCollection = signal<FavoritesCollection>('ALL');
  protected readonly searchTerm = signal('');
  protected readonly operationFilter = signal<OperationFilter>('ALL');
  protected readonly propertyTypeFilter = signal<PropertyTypeFilter>('ALL');
  protected readonly sortOption = signal<FavoritesSortOption>('RECENT');
  protected readonly selectedFavorites = computed(() => {
    const selectedIds = new Set(this.compareSelection());

    return this.favorites().filter((item) => selectedIds.has(item.property.propertyId));
  });
  protected readonly compareFavorites = computed(() => this.selectedFavorites().slice(0, 2));
  protected readonly filteredFavorites = computed(() => {
    const searchTerm = this.searchTerm().trim().toLowerCase();
    const operationFilter = this.operationFilter();
    const propertyTypeFilter = this.propertyTypeFilter();
    const activeCollection = this.activeCollection();
    const items = this.favorites()
      .filter((item) => this.matchesCollection(item, activeCollection))
      .filter((item) => (operationFilter === 'ALL' ? true : item.property.operation === operationFilter))
      .filter((item) => (propertyTypeFilter === 'ALL' ? true : item.property.propertyType === propertyTypeFilter))
      .filter((item) => {
        if (!searchTerm) {
          return true;
        }

        return [
          item.property.title,
          item.property.source,
          item.property.neighborhood,
          item.property.city,
          this.formatPropertyTypeLabel(item.property.propertyType),
          this.formatOperationLabel(item.property.operation),
        ]
          .filter((value): value is string => !!value)
          .some((value) => value.toLowerCase().includes(searchTerm));
      });

    return this.sortFavorites(items, this.sortOption());
  });
  protected readonly recentActivity = computed(() =>
    this.sortFavorites([...this.favorites()], 'RECENT').slice(0, 3),
  );
  protected readonly propertyTypeOptions = computed(() => {
    const presentTypes = new Set(
      this.favorites()
        .map((item) => item.property.propertyType)
        .filter((value): value is PropertyType => value !== null),
    );

    return [
      { value: 'APARTMENT', label: 'Departamento' },
      { value: 'HOUSE', label: 'Casa' },
      { value: 'PH', label: 'PH' },
      { value: 'LAND', label: 'Terreno' },
      { value: 'OFFICE', label: 'Oficina' },
      { value: 'LOCAL', label: 'Local' },
      { value: 'GARAGE', label: 'Garage' },
    ].filter((option) => presentTypes.has(option.value as PropertyType));
  });
  protected readonly allVisibleSelected = computed(() => {
    const visibleIds = this.filteredFavorites().map((item) => item.property.propertyId);

    if (visibleIds.length === 0) {
      return false;
    }

    const selected = new Set(this.compareSelection());
    return visibleIds.every((id) => selected.has(id));
  });

  private readonly api = inject(RealStateApiService);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);

  async ngOnInit() {
    await this.loadFavorites();
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected isCompareRoute() {
    return this.router.url.startsWith('/app/compare');
  }

  protected setCollection(value: FavoritesCollection) {
    this.activeCollection.set(value);
  }

  protected setOperationFilter(value: OperationFilter) {
    this.operationFilter.set(value);
  }

  protected setPropertyTypeFilter(event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'ALL';
    this.propertyTypeFilter.set(value as PropertyTypeFilter);
  }

  protected setSortOption(event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'RECENT';
    this.sortOption.set(value as FavoritesSortOption);
  }

  protected updateSearchTerm(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected collectionCount(collection: FavoritesCollection) {
    return this.favorites().filter((item) => this.matchesCollection(item, collection)).length;
  }

  protected toggleSelectAllVisible() {
    const visibleIds = this.filteredFavorites().map((item) => item.property.propertyId);

    this.compareSelection.update((current) => {
      const next = new Set(current);
      const everySelected = visibleIds.every((id) => next.has(id));

      if (everySelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return [...next];
    });
  }

  protected async removeFavorite(propertyId: string) {
    if (this.busyIds().includes(propertyId)) {
      return;
    }

    this.busyIds.update((items) => [...items, propertyId]);

    try {
      await firstValueFrom(this.api.removeFavorite(propertyId));
      this.favorites.update((items) => items.filter((item) => item.property.propertyId !== propertyId));
      this.compareSelection.update((items) => items.filter((item) => item !== propertyId));
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo quitar el favorito.'));
    } finally {
      this.busyIds.update((items) => items.filter((item) => item !== propertyId));
    }
  }

  protected isBusy(propertyId: string) {
    return this.busyIds().includes(propertyId);
  }

  protected toggleCompare(propertyId: string) {
    this.compareSelection.update((current) => {
      if (current.includes(propertyId)) {
        return current.filter((item) => item !== propertyId);
      }

      return [...current, propertyId];
    });
  }

  protected isCompareSelected(propertyId: string) {
    return this.compareSelection().includes(propertyId);
  }

  protected clearComparison() {
    this.compareSelection.set([]);
  }

  protected async prepareSimilarSearch(favorite: FavoriteListItem) {
    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: this.buildSearchPrompt(favorite),
        autoSend: false,
      },
    });
  }

  protected async searchSimilarNow(favorite: FavoriteListItem) {
    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: this.buildSearchPrompt(favorite),
        autoSend: true,
      },
    });
  }

  protected async prepareComparisonSearch() {
    if (this.compareFavorites().length !== 2) {
      return;
    }

    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: this.buildComparisonPrompt(this.compareFavorites()),
        autoSend: false,
      },
    });
  }

  protected async searchFromComparisonNow() {
    if (this.compareFavorites().length !== 2) {
      return;
    }

    await this.router.navigate(['/search'], {
      state: {
        preparedPrompt: this.buildComparisonPrompt(this.compareFavorites()),
        autoSend: true,
      },
    });
  }

  protected formatPrice(favorite: FavoriteListItem) {
    if (favorite.property.price === null || !favorite.property.currency) {
      return 'Precio no informado';
    }

    const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(favorite.property.price);
    const suffix = favorite.property.operation === 'RENT' && favorite.property.currency === 'ARS' ? ' / mes' : '';

    return `${favorite.property.currency} ${amount}${suffix}`;
  }

  protected formatLocation(favorite: FavoriteListItem) {
    return favorite.property.neighborhood || favorite.property.city || 'Ubicacion no informada';
  }

  protected formatSavedRelative(dateString: string) {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60000));

    if (minutes < 60) {
      return `hace ${minutes} min`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `hace ${hours} h`;
    }

    const days = Math.round(hours / 24);
    if (days === 1) {
      return 'ayer';
    }

    return `hace ${days} dias`;
  }

  protected highlightBadge(favorite: FavoriteListItem) {
    const diffMs = Date.now() - new Date(favorite.createdAt).getTime();
    const hours = diffMs / 3600000;

    if (hours < 12) {
      return { label: 'Guardado hoy', tone: 'default' as const };
    }

    if (hours < 36) {
      return { label: 'Nuevo', tone: 'default' as const };
    }

    if (favorite.property.operation === 'BUY' && favorite.property.price !== null) {
      return { label: 'Destacado', tone: 'warm' as const };
    }

    return null;
  }

  protected trimTitle(value: string) {
    return value.length > 28 ? `${value.slice(0, 28)}...` : value;
  }

  protected buildComparisonInsights(favorites: FavoriteListItem[]) {
    const [first, second] = favorites;

    if (!first || !second) {
      return ['Selecciona dos favoritos para ver una lectura comparativa.'];
    }

    const insights: string[] = [];
    const firstLocation = this.formatLocation(first);
    const secondLocation = this.formatLocation(second);

    if (firstLocation !== 'Ubicacion no informada' && secondLocation !== 'Ubicacion no informada') {
      if (firstLocation === secondLocation) {
        insights.push(`Los dos favoritos quedan en la misma zona: ${firstLocation}.`);
      } else {
        insights.push(`La comparacion cruza dos zonas distintas: ${firstLocation} vs ${secondLocation}.`);
      }
    }

    if (
      first.property.price !== null &&
      second.property.price !== null &&
      first.property.currency &&
      first.property.currency === second.property.currency
    ) {
      const cheaper = first.property.price <= second.property.price ? first : second;
      const expensive = cheaper.favoriteId === first.favoriteId ? second : first;
      const gap = Math.abs(first.property.price - second.property.price);

      if (gap === 0) {
        insights.push(`Los dos quedaron guardados con el mismo precio: ${this.formatPrice(first)}.`);
      } else {
        insights.push(
          `${cheaper.property.title} queda mas barato que ${expensive.property.title} por ${cheaper.property.currency} ${new Intl.NumberFormat('es-AR').format(gap)}.`,
        );
      }
    }

    if (
      first.property.propertyType &&
      second.property.propertyType &&
      first.property.propertyType === second.property.propertyType
    ) {
      insights.push(`Los dos son del mismo tipo de propiedad: ${this.formatPropertyTypeLabel(first.property.propertyType)}.`);
    }

    if (insights.length === 0) {
      insights.push('Los dos favoritos se ven bastante alineados y conviene abrirlos para revisar el detalle.');
    }

    return insights.slice(0, 4);
  }

  protected formatPropertyTypeLabel(value: PropertyType | null) {
    const labels: Record<PropertyType, string> = {
      APARTMENT: 'Departamento',
      HOUSE: 'Casa',
      PH: 'PH',
      LAND: 'Terreno',
      OFFICE: 'Oficina',
      LOCAL: 'Local',
      GARAGE: 'Garage',
    };

    if (!value) {
      return 'Tipo no informado';
    }

    return labels[value] ?? value.toLowerCase();
  }

  protected formatOperationLabel(value: OperationType | null) {
    if (value === 'BUY') {
      return 'compra';
    }

    if (value === 'RENT') {
      return 'alquiler';
    }

    return 'sin operacion';
  }

  protected trackFavorite(index: number, item: FavoriteListItem) {
    return item.favoriteId;
  }

  protected getUserInitial() {
    const email = this.authStore.user()?.email ?? 'U';
    return email.charAt(0).toUpperCase();
  }

  protected buildMetricsLine(favorite: FavoriteListItem) {
    const chunks: string[] = [];
    const property = favorite.property as FavoriteListItem['property'] & Partial<Record<'rooms' | 'areaTotal' | 'areaCovered' | 'bedrooms', number | null>>;
    const rooms = property.rooms ?? property.bedrooms ?? null;
    const area = property.areaTotal ?? property.areaCovered ?? null;

    if (rooms !== null) {
      chunks.push(`${rooms} ${rooms === 1 ? 'ambiente' : 'ambientes'}`);
    }

    if (area !== null) {
      chunks.push(`${area} m2`);
    }

    return chunks.length > 0 ? chunks.join(' · ') : 'Datos principales no informados';
  }

  private buildSearchPrompt(favorite: FavoriteListItem) {
    const chunks = ['Quiero buscar propiedades parecidas a un favorito que guarde'];
    const operation = this.formatOperationLabel(favorite.property.operation);
    const propertyType = this.formatPropertyTypeLabel(favorite.property.propertyType);
    const location = this.formatLocation(favorite);
    const price = this.formatPrice(favorite);

    if (operation !== 'sin operacion') {
      chunks.push(`para ${operation}`);
    }

    if (propertyType !== 'Tipo no informado') {
      chunks.push(`tipo ${propertyType.toLowerCase()}`);
    }

    if (location !== 'Ubicacion no informada') {
      chunks.push(`en ${location}`);
    }

    if (price !== 'Precio no informado') {
      chunks.push(`con un valor cercano a ${price}`);
    }

    return `${chunks.join(', ')}. Mostrame opciones similares y prioriza coincidencias cercanas.`;
  }

  private buildComparisonPrompt(favorites: FavoriteListItem[]) {
    const [first, second] = favorites;

    if (!first || !second) {
      return 'Quiero buscar propiedades parecidas a los favoritos que compare recien.';
    }

    return [
      'Quiero una nueva busqueda tomando como referencia estos dos favoritos comparados.',
      `Favorito 1: ${this.describeFavoriteForPrompt(first)}.`,
      `Favorito 2: ${this.describeFavoriteForPrompt(second)}.`,
      'Mostrame opciones intermedias o parecidas a los dos y manten una lectura operativa corta.',
    ].join(' ');
  }

  private describeFavoriteForPrompt(favorite: FavoriteListItem) {
    const chunks: string[] = [];
    const operation = this.formatOperationLabel(favorite.property.operation);
    const propertyType = this.formatPropertyTypeLabel(favorite.property.propertyType);
    const location = this.formatLocation(favorite);
    const price = this.formatPrice(favorite);

    if (operation !== 'sin operacion') {
      chunks.push(`operacion ${operation}`);
    }

    if (propertyType !== 'Tipo no informado') {
      chunks.push(`tipo ${propertyType.toLowerCase()}`);
    }

    if (location !== 'Ubicacion no informada') {
      chunks.push(`ubicacion ${location}`);
    }

    if (price !== 'Precio no informado') {
      chunks.push(`precio ${price}`);
    }

    return chunks.join(', ');
  }

  private matchesCollection(item: FavoriteListItem, collection: FavoritesCollection) {
    if (collection === 'ALL') {
      return true;
    }

    if (collection === 'BUY' || collection === 'RENT') {
      return item.property.operation === collection;
    }

    const hoursSinceSave = (Date.now() - new Date(item.createdAt).getTime()) / 3600000;

    if (collection === 'RECENT') {
      return hoursSinceSave <= 72;
    }

    return hoursSinceSave > 72 || item.property.price === null;
  }

  private sortFavorites(items: FavoriteListItem[], sort: FavoritesSortOption) {
    return [...items].sort((left, right) => {
      if (sort === 'PRICE_ASC') {
        if (left.property.price === null) {
          return 1;
        }
        if (right.property.price === null) {
          return -1;
        }

        return left.property.price - right.property.price;
      }

      if (sort === 'PRICE_DESC') {
        if (left.property.price === null) {
          return 1;
        }
        if (right.property.price === null) {
          return -1;
        }

        return right.property.price - left.property.price;
      }

      if (sort === 'LOCATION') {
        return this.formatLocation(left).localeCompare(this.formatLocation(right), 'es');
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  private async loadFavorites() {
    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.api.listFavorites());
      this.favorites.set(response.items);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudieron cargar los favoritos.'));
    } finally {
      this.loading.set(false);
    }
  }
}
