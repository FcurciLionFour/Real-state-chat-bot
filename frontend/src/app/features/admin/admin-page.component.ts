import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Building2,
  House,
  LayoutGrid,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  Star,
} from 'lucide-angular';
import { AuthStore } from '../../core/services/auth.store';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';
import { BlogFormComponent } from '../../shared/blog/blog-form.component';
import {
  AdminCacheInvalidateResponse,
  AdminBlogArticlesResponse,
  AdminConversationsResponse,
  AdminConversationDetail,
  AdminLeadsResponse,
  AdminMetricsResponse,
  AdminOverview,
  AdminPropertiesResponse,
  AdminScrapingSourcesResponse,
  AdminSearchRunsResponse,
  AdminSearchRunDetail,
  AdminUsersResponse,
  OwnerPropertiesResponse,
  OwnerProperty,
  PropertyType,
  SearchRunStatus,
  UserRole,
} from '../../core/types/api.types';

type AdminSection = 'dashboard' | 'users' | 'properties' | 'pending' | 'blog' | 'scraping' | 'leads' | 'conversations' | 'searchRuns';
type AdminListMeta = {
  page: number;
  limit: number;
  total: number;
};
type UserRoleFilter = 'ALL' | UserRole;
type SearchRunStatusFilter = 'ALL' | SearchRunStatus;

const DEFAULT_META: AdminListMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

@Component({
  selector: 'app-admin-page',
  imports: [CommonModule, DatePipe, RouterLink, LucideAngularModule, BlogFormComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Activity,
        ArrowLeft,
        ArrowUpRight,
        BookOpen,
        Building2,
        House,
        LayoutGrid,
        MessageSquare,
        MessagesSquare,
        Plus,
        Search,
        Settings,
        Star,
      }),
    },
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  protected readonly overview = signal<AdminOverview | null>(null);
  protected readonly metrics = signal<AdminMetricsResponse | null>(null);
  protected readonly users = signal<AdminUsersResponse['items']>([]);
  protected readonly usersMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly conversations = signal<AdminConversationsResponse['items']>([]);
  protected readonly conversationsMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly searchRuns = signal<AdminSearchRunsResponse['items']>([]);
  protected readonly searchRunsMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly properties = signal<AdminPropertiesResponse['items']>([]);
  protected readonly propertiesMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly ownerPendingProperties = signal<OwnerPropertiesResponse['items']>([]);
  protected readonly ownerPendingMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly blogArticles = signal<AdminBlogArticlesResponse['items']>([]);
  protected readonly blogArticlesMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly leads = signal<AdminLeadsResponse['items']>([]);
  protected readonly leadsMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly scrapingSources = signal<AdminScrapingSourcesResponse['items']>([]);
  protected readonly scrapingSourcesMeta = signal<AdminListMeta>(DEFAULT_META);
  protected readonly selectedConversationDetail = signal<AdminConversationDetail | null>(null);
  protected readonly selectedSearchRunDetail = signal<AdminSearchRunDetail | null>(null);
  protected readonly activeSection = signal<AdminSection>('dashboard');
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly sectionLoading = signal<AdminSection | null>(null);
  protected readonly roleUpdatingUserId = signal<string | null>(null);
  protected readonly reviewingOwnerPropertyId = signal<string | null>(null);
  protected readonly detailLoadingKey = signal<string | null>(null);
  protected readonly cacheInvalidating = signal(false);
  protected readonly cacheOperationSummary = signal('');
  protected readonly operationSummary = signal('');
  protected readonly searchQuery = signal('');
  protected readonly error = signal('');
  protected readonly userRoleFilter = signal<UserRoleFilter>('ALL');
  protected readonly searchRunStatusFilter = signal<SearchRunStatusFilter>('ALL');
  protected readonly propertySourceFilter = signal('ALL');
  protected readonly propertySourceOptions = computed(() =>
    [...new Set(this.properties().map((item) => item.source))].sort((left, right) => left.localeCompare(right, 'es')),
  );
  protected readonly filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const roleFilter = this.userRoleFilter();

    return this.users().filter((item) => {
      if (roleFilter !== 'ALL' && item.role !== roleFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return this.matchesQuery(query, [item.email, item.role, `${item.conversationsCount}`, `${item.favoritesCount}`]);
    });
  });
  protected readonly filteredConversations = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.conversations();
    }

    return this.conversations().filter((item) =>
      this.matchesQuery(query, [item.title, item.user.email, `${item.messagesCount}`, `${item.searchRunsCount}`]),
    );
  });
  protected readonly filteredSearchRuns = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const statusFilter = this.searchRunStatusFilter();

    return this.searchRuns().filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return this.matchesQuery(query, [
        item.queryText,
        item.status,
        item.conversation.title,
        item.conversation.user.email,
        `${item.resultCount}`,
      ]);
    });
  });
  protected readonly filteredProperties = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const sourceFilter = this.propertySourceFilter();

    return this.properties().filter((item) => {
      if (sourceFilter !== 'ALL' && item.source !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return this.matchesQuery(query, [
        item.title,
        item.source,
        item.neighborhood ?? '',
        item.city ?? '',
        `${item.favoritesCount}`,
      ]);
    });
  });
  protected readonly filteredBlogArticles = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.blogArticles();
    }

    return this.blogArticles().filter((item) =>
      this.matchesQuery(query, [item.title, item.slug, item.category, item.status, item.author?.email ?? '']),
    );
  });
  protected readonly filteredLeads = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.leads();
    }

    return this.leads().filter((item) =>
      this.matchesQuery(query, [item.name ?? '', item.email ?? '', item.phone ?? '', item.message, item.source ?? '', item.status]),
    );
  });
  protected readonly filteredScrapingSources = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.scrapingSources();
    }

    return this.scrapingSources().filter((item) =>
      this.matchesQuery(query, [item.source, item.status, item.errorSummary ?? '', `${item.resultsCount}`]),
    );
  });

  private readonly api = inject(RealStateApiService);
  private readonly router = inject(Router);
  protected readonly authStore = inject(AuthStore);
  protected readonly quickActions = [
    { section: 'users' as const, title: 'Usuarios', copy: 'Gestiona roles y permisos', action: 'Ir a usuarios' },
    { section: 'conversations' as const, title: 'Conversaciones', copy: 'Audita chats y estados de busqueda', action: 'Abrir historial' },
    { section: 'searchRuns' as const, title: 'Search runs', copy: 'Revisa corridas, fuentes y ranking', action: 'Abrir corridas' },
    { section: 'properties' as const, title: 'Propiedades', copy: 'Revisa propiedades indexadas', action: 'Ir a propiedades' },
    { section: 'pending' as const, title: 'Pendientes', copy: 'Propiedades listas para revisar', action: 'Ir a pendientes' },
    { section: 'blog' as const, title: 'Blog', copy: 'Articulos y contenido', action: 'Ir al blog' },
    { section: 'leads' as const, title: 'Leads', copy: 'Contactos y mensajes recibidos', action: 'Ir a leads' },
    { section: 'scraping' as const, title: 'Scraping', copy: 'Monitorea fuentes y corridas', action: 'Ir a scraping' },
  ];

  async ngOnInit() {
    await this.loadAdminData();
  }

  protected setSection(section: AdminSection) {
    this.activeSection.set(section);
    this.searchQuery.set('');
    this.userRoleFilter.set('ALL');
    this.searchRunStatusFilter.set('ALL');
    this.propertySourceFilter.set('ALL');

    if (section !== 'conversations') {
      this.selectedConversationDetail.set(null);
    }

    if (section !== 'searchRuns') {
      this.selectedSearchRunDetail.set(null);
    }
  }

  protected async openSearch() {
    await this.router.navigate(['/search']);
  }

  protected getUserInitial() {
    const email = this.authStore.user()?.email ?? 'A';
    return email.charAt(0).toUpperCase();
  }

  protected statusClass(status: string) {
    return status.toLowerCase();
  }

  protected overviewMetric(label: string, value: number | string, helper: string, tone = 'default') {
    return { label, value, helper, tone };
  }

  protected setUserRoleFilter(event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'ALL';
    this.userRoleFilter.set(value as UserRoleFilter);
  }

  protected setSearchRunStatusFilter(event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'ALL';
    this.searchRunStatusFilter.set(value as SearchRunStatusFilter);
  }

  protected setPropertySourceFilter(event: Event) {
    this.propertySourceFilter.set((event.target as HTMLSelectElement | null)?.value ?? 'ALL');
  }

  protected async refreshAdminData() {
    await this.loadAdminData(true);
  }

  protected async invalidateOperationalCache() {
    this.cacheInvalidating.set(true);
    this.cacheOperationSummary.set('');
    this.error.set('');

    try {
      const response = await firstValueFrom(this.api.invalidateAdminOperationalCache());
      this.cacheOperationSummary.set(this.buildCacheSummary(response));
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo invalidar el cache operativo.'));
    } finally {
      this.cacheInvalidating.set(false);
    }
  }

  protected async goToPreviousPage() {
    await this.changePage(-1);
  }

  protected async goToNextPage() {
    await this.changePage(1);
  }

  protected totalPages(meta: AdminListMeta) {
    return Math.max(1, Math.ceil(meta.total / meta.limit));
  }

  protected currentMeta() {
    return this.metaForSection(this.activeSection());
  }

  protected updateSearchQuery(value: string) {
    this.searchQuery.set(value);
  }

  protected sectionSearchPlaceholder() {
    switch (this.activeSection()) {
      case 'users':
        return 'Buscar en usuarios...';
      case 'conversations':
        return 'Buscar en conversaciones...';
      case 'searchRuns':
        return 'Buscar en search runs...';
      case 'properties':
        return 'Buscar en propiedades...';
      case 'pending':
        return 'Buscar pendientes...';
      case 'blog':
        return 'Buscar articulos...';
      case 'leads':
        return 'Buscar leads...';
      case 'scraping':
        return 'Buscar fuentes...';
      default:
        return 'Buscar en admin...';
    }
  }

  protected statusShare(count: number, total: number) {
    if (total <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((count / total) * 100));
  }

  protected formatSearchRunStatus(status: SearchRunStatus) {
    if (status === 'COMPLETED') {
      return 'Completado';
    }

    if (status === 'PARTIAL') {
      return 'Parcial';
    }

    return 'Error';
  }

  protected statusTone(status: SearchRunStatus) {
    if (status === 'COMPLETED') {
      return 'completed';
    }

    if (status === 'PARTIAL') {
      return 'partial';
    }

    return 'failed';
  }

  protected statusGlyph(status: SearchRunStatus) {
    if (status === 'COMPLETED') {
      return 'OK';
    }

    if (status === 'PARTIAL') {
      return 'PARCIAL';
    }

    return 'ERROR';
  }

  protected sourceTone(source: string) {
    const normalized = source.toLowerCase();

    if (normalized.includes('zonaprop')) {
      return 'zonaprop';
    }

    if (normalized.includes('argenprop')) {
      return 'argenprop';
    }

    if (normalized.includes('mercado')) {
      return 'mercadolibre';
    }

    return 'default';
  }

  protected initialsFromEmail(email: string) {
    return email.slice(0, 1).toUpperCase();
  }

  protected relativeDate(dateString: string) {
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

  protected formatPropertyType(value: PropertyType | null) {
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

  protected async toggleUserRole(userId: string, currentRole: UserRole) {
    this.roleUpdatingUserId.set(userId);
    this.error.set('');

    try {
      const nextRole: UserRole = currentRole === 'USER' ? 'OWNER' : currentRole === 'OWNER' ? 'ADMIN' : 'USER';
      const updated = await firstValueFrom(this.api.updateAdminUserRole(userId, nextRole));
      this.users.update((items) =>
        items.map((item) => (item.id === userId ? { ...item, role: updated.role, updatedAt: updated.updatedAt } : item)),
      );
      this.operationSummary.set(`Rol actualizado para ${updated.email}.`);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo actualizar el rol del usuario.'));
    } finally {
      this.roleUpdatingUserId.set(null);
    }
  }

  protected async openConversationDetail(conversationId: string) {
    this.detailLoadingKey.set(`conversation:${conversationId}`);
    this.error.set('');

    try {
      const detail = await firstValueFrom(this.api.getAdminConversationDetail(conversationId));
      this.selectedConversationDetail.set(detail);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar el detalle de la conversacion.'));
    } finally {
      this.detailLoadingKey.set(null);
    }
  }

  protected async openSearchRunDetail(searchRunId: string) {
    this.detailLoadingKey.set(`search-run:${searchRunId}`);
    this.error.set('');

    try {
      const detail = await firstValueFrom(this.api.getAdminSearchRunDetail(searchRunId));
      this.selectedSearchRunDetail.set(detail);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar el detalle del search run.'));
    } finally {
      this.detailLoadingKey.set(null);
    }
  }

  protected async openConversationFromSearchRun(conversationId: string) {
    this.activeSection.set('conversations');
    this.searchQuery.set('');
    await this.openConversationDetail(conversationId);
  }

  protected async openSearchRunFromConversation(searchRunId: string) {
    this.activeSection.set('searchRuns');
    this.searchQuery.set('');
    await this.openSearchRunDetail(searchRunId);
  }

  protected isDetailLoading(key: string) {
    return this.detailLoadingKey() === key;
  }

  protected isRoleUpdating(userId: string) {
    return this.roleUpdatingUserId() === userId;
  }

  protected async copyIdentifier(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.operationSummary.set(`${label} copiado.`);
    } catch {
      this.error.set(`No se pudo copiar ${label.toLowerCase()}.`);
    }
  }

  protected hasRenderableAdminData() {
    return Boolean(
      this.overview() ||
        this.metrics() ||
        this.users().length ||
        this.conversations().length ||
        this.searchRuns().length ||
        this.properties().length ||
        this.ownerPendingProperties().length ||
        this.blogArticles().length ||
        this.leads().length ||
        this.scrapingSources().length,
    );
  }

  protected formatFiltersSummary(filters: unknown) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return 'Sin filtros estructurados';
    }

    const candidate = filters as Record<string, unknown>;
    const chunks: string[] = [];

    if (typeof candidate['operation'] === 'string') {
      chunks.push(`Operacion: ${candidate['operation']}`);
    }

    if (Array.isArray(candidate['propertyTypes']) && candidate['propertyTypes'].length > 0) {
      chunks.push(`Tipo: ${candidate['propertyTypes'].join(', ')}`);
    }

    if (Array.isArray(candidate['locations']) && candidate['locations'].length > 0) {
      chunks.push(`Ubicacion: ${candidate['locations'].join(', ')}`);
    }

    if (typeof candidate['priceMax'] === 'number' && typeof candidate['currency'] === 'string') {
      chunks.push(`Tope: ${candidate['currency']} ${candidate['priceMax']}`);
    }

    if (typeof candidate['rooms'] === 'number') {
      chunks.push(`Ambientes: ${candidate['rooms']}`);
    }

    if (Array.isArray(candidate['features']) && candidate['features'].length > 0) {
      chunks.push(`Features: ${candidate['features'].join(', ')}`);
    }

    return chunks.length > 0 ? chunks.join(' / ') : 'Sin filtros estructurados';
  }

  protected trackById(_index: number, item: { id: string }) {
    return item.id;
  }

  protected currentFilteredCount() {
    switch (this.activeSection()) {
      case 'users':
        return this.filteredUsers().length;
      case 'conversations':
        return this.filteredConversations().length;
      case 'searchRuns':
        return this.filteredSearchRuns().length;
      case 'properties':
        return this.filteredProperties().length;
      case 'pending':
        return this.filteredOwnerPendingProperties().length;
      case 'blog':
        return this.filteredBlogArticles().length;
      case 'leads':
        return this.filteredLeads().length;
      case 'scraping':
        return this.filteredScrapingSources().length;
      default:
        return 0;
    }
  }

  protected async refreshBlogArticles() {
    const response = await firstValueFrom(this.api.listAdminBlogArticles(1, this.blogArticlesMeta().limit));
    this.blogArticles.set(response.items);
    this.blogArticlesMeta.set(response.meta);
  }

  protected readonly filteredOwnerPendingProperties = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.ownerPendingProperties();
    }

    return this.ownerPendingProperties().filter((item) =>
      this.matchesQuery(query, [item.title, item.owner?.email ?? '', item.neighborhood, item.city, item.contactEmail]),
    );
  });

  protected formatOwnerPropertyPrice(property: OwnerProperty) {
    return `${property.currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(property.price)}`;
  }

  protected formatOwnerPropertyLocation(property: OwnerProperty) {
    return [property.neighborhood, property.city].filter(Boolean).join(', ') || '-';
  }

  protected async approveOwnerProperty(propertyId: string) {
    await this.reviewOwnerProperty(propertyId, () => this.api.approveAdminOwnerSubmittedProperty(propertyId), 'Propiedad aprobada y publicada.');
  }

  protected async rejectOwnerProperty(propertyId: string) {
    const reason = window.prompt('Motivo de rechazo');
    if (!reason?.trim()) {
      return;
    }

    await this.reviewOwnerProperty(
      propertyId,
      () => this.api.rejectAdminOwnerSubmittedProperty(propertyId, { rejectionReason: reason.trim() }),
      'Propiedad rechazada.',
    );
  }

  protected isReviewingOwnerProperty(propertyId: string) {
    return this.reviewingOwnerPropertyId() === propertyId;
  }

  protected async publishBlogArticle(articleId: string) {
    await this.mutateBlogArticle(() => this.api.publishAdminBlogArticle(articleId), 'Articulo publicado.');
  }

  protected async unpublishBlogArticle(articleId: string) {
    await this.mutateBlogArticle(() => this.api.unpublishAdminBlogArticle(articleId), 'Articulo despublicado.');
  }

  protected async archiveBlogArticle(articleId: string) {
    await this.mutateBlogArticle(() => this.api.archiveAdminBlogArticle(articleId), 'Articulo archivado.');
  }

  protected async deleteBlogArticle(articleId: string) {
    await this.mutateBlogArticle(() => this.api.deleteAdminBlogArticle(articleId), 'Articulo eliminado.');
  }

  private buildCacheSummary(response: AdminCacheInvalidateResponse) {
    if (!response.redisAvailable) {
      return 'Redis no estaba disponible. No habia cache operativo para invalidar.';
    }

    return `Cache operativo invalidado. Matched ${response.matchedKeys} claves y borro ${response.deletedKeys}.`;
  }

  private async mutateBlogArticle(loader: () => unknown, successMessage: string) {
    this.sectionLoading.set('blog');
    this.error.set('');

    try {
      await firstValueFrom(loader() as any);
      await this.refreshBlogArticles();
      this.operationSummary.set(successMessage);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo actualizar el articulo.'));
    } finally {
      this.sectionLoading.set(null);
    }
  }

  private async loadAdminData(isRefresh = false) {
    if (isRefresh) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }

    this.error.set('');
    this.operationSummary.set('');

    try {
      const failures: string[] = [];

      await this.loadAdminResource(
        () => firstValueFrom(this.api.getAdminOverview()),
        (overview) => this.overview.set(overview),
        'No se pudo cargar el overview admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.getAdminMetrics()),
        (metrics) => this.metrics.set(metrics),
        'No se pudieron cargar las metricas admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminUsers(1, 10)),
        (users) => {
          this.users.set(users.items);
          this.usersMeta.set(users.meta);
        },
        'No se pudo cargar la lista de usuarios admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminConversations(1, 10)),
        (conversations) => {
          this.conversations.set(conversations.items);
          this.conversationsMeta.set(conversations.meta);
        },
        'No se pudo cargar la lista de conversaciones admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminSearchRuns(1, 10)),
        (searchRuns) => {
          this.searchRuns.set(searchRuns.items);
          this.searchRunsMeta.set(searchRuns.meta);
        },
        'No se pudo cargar la lista de search runs admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminProperties(1, 10)),
        (properties) => {
          this.properties.set(properties.items);
          this.propertiesMeta.set(properties.meta);
        },
        'No se pudo cargar la lista de propiedades admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminPendingOwnerSubmittedProperties(1, 10)),
        (properties) => {
          this.ownerPendingProperties.set(properties.items);
          this.ownerPendingMeta.set(properties.meta);
        },
        'No se pudieron cargar propiedades owner pendientes.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminBlogArticles(1, 10)),
        (blogArticles) => {
          this.blogArticles.set(blogArticles.items);
          this.blogArticlesMeta.set(blogArticles.meta);
        },
        'No se pudo cargar la lista de articulos admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminLeads(1, 10)),
        (leads) => {
          this.leads.set(leads.items);
          this.leadsMeta.set(leads.meta);
        },
        'No se pudo cargar la lista de leads admin.',
        failures,
      );
      await this.loadAdminResource(
        () => firstValueFrom(this.api.listAdminScrapingSources(1, 10)),
        (sources) => {
          this.scrapingSources.set(sources.items);
          this.scrapingSourcesMeta.set(sources.meta);
        },
        'No se pudo cargar el estado de fuentes admin.',
        failures,
      );

      if (failures.length > 0) {
        this.error.set(
          this.hasRenderableAdminData()
            ? 'Algunos bloques del panel no se pudieron actualizar. Puedes reintentar desde "Actualizar panel".'
            : failures[0],
        );
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  private async changePage(offset: number) {
    const section = this.activeSection();
    const meta = this.metaForSection(section);
    const nextPage = meta.page + offset;

    if (nextPage < 1 || nextPage > this.totalPages(meta)) {
      return;
    }

    await this.loadSection(section, nextPage);
  }

  private metaForSection(section: AdminSection) {
    switch (section) {
      case 'users':
        return this.usersMeta();
      case 'conversations':
        return this.conversationsMeta();
      case 'searchRuns':
        return this.searchRunsMeta();
      case 'properties':
        return this.propertiesMeta();
      case 'pending':
        return this.ownerPendingMeta();
      case 'blog':
        return this.blogArticlesMeta();
      case 'leads':
        return this.leadsMeta();
      case 'scraping':
        return this.scrapingSourcesMeta();
      default:
        return DEFAULT_META;
    }
  }

  private async loadSection(section: AdminSection, page: number) {
    this.sectionLoading.set(section);
    this.error.set('');

    try {
      switch (section) {
        case 'users': {
          const response = await firstValueFrom(this.api.listAdminUsers(page, this.usersMeta().limit));
          this.users.set(response.items);
          this.usersMeta.set(response.meta);
          break;
        }
        case 'conversations': {
          const response = await firstValueFrom(this.api.listAdminConversations(page, this.conversationsMeta().limit));
          this.conversations.set(response.items);
          this.conversationsMeta.set(response.meta);
          break;
        }
        case 'searchRuns': {
          const response = await firstValueFrom(this.api.listAdminSearchRuns(page, this.searchRunsMeta().limit));
          this.searchRuns.set(response.items);
          this.searchRunsMeta.set(response.meta);
          break;
        }
        case 'properties': {
          const response = await firstValueFrom(this.api.listAdminProperties(page, this.propertiesMeta().limit));
          this.properties.set(response.items);
          this.propertiesMeta.set(response.meta);
          break;
        }
        case 'pending': {
          const response = await firstValueFrom(this.api.listAdminPendingOwnerSubmittedProperties(page, this.ownerPendingMeta().limit));
          this.ownerPendingProperties.set(response.items);
          this.ownerPendingMeta.set(response.meta);
          break;
        }
        case 'blog': {
          const response = await firstValueFrom(this.api.listAdminBlogArticles(page, this.blogArticlesMeta().limit));
          this.blogArticles.set(response.items);
          this.blogArticlesMeta.set(response.meta);
          break;
        }
        case 'leads': {
          const response = await firstValueFrom(this.api.listAdminLeads(page, this.leadsMeta().limit));
          this.leads.set(response.items);
          this.leadsMeta.set(response.meta);
          break;
        }
        case 'scraping': {
          const response = await firstValueFrom(this.api.listAdminScrapingSources(page, this.scrapingSourcesMeta().limit));
          this.scrapingSources.set(response.items);
          this.scrapingSourcesMeta.set(response.meta);
          break;
        }
      }
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo actualizar la seccion elegida.'));
    } finally {
      this.sectionLoading.set(null);
    }
  }

  private async loadAdminResource<T>(
    loader: () => Promise<T>,
    applyValue: (value: T) => void,
    fallbackMessage: string,
    failures: string[],
  ) {
    try {
      const value = await this.runAdminRequestWithRetry(loader);
      applyValue(value);
    } catch (error) {
      failures.push(readApiErrorMessage(error, fallbackMessage));
    }
  }

  private async runAdminRequestWithRetry<T>(loader: () => Promise<T>, retries = 1) {
    let attempt = 0;

    while (true) {
      try {
        return await loader();
      } catch (error) {
        if (attempt >= retries || !this.shouldRetryAdminRequest(error)) {
          throw error;
        }

        attempt += 1;
        await this.delay(250 * attempt);
      }
    }
  }

  private shouldRetryAdminRequest(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      message?: string;
      status?: number;
    };
    const message = typeof candidate.message === 'string' ? candidate.message : '';

    return (
      candidate.status === 0 ||
      candidate.status === 502 ||
      candidate.status === 503 ||
      candidate.status === 504 ||
      message.includes('Unknown Error') ||
      message.includes('ERR_CONNECTION')
    );
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private matchesQuery(query: string, values: Array<string | null | undefined>) {
    return values.some((value) => value?.toLowerCase().includes(query));
  }

  private async reviewOwnerProperty(propertyId: string, action: () => ReturnType<RealStateApiService['approveAdminOwnerSubmittedProperty']>, successMessage: string) {
    this.reviewingOwnerPropertyId.set(propertyId);
    this.error.set('');

    try {
      await firstValueFrom(action());
      const response = await firstValueFrom(this.api.listAdminPendingOwnerSubmittedProperties(1, this.ownerPendingMeta().limit));
      this.ownerPendingProperties.set(response.items);
      this.ownerPendingMeta.set(response.meta);
      this.operationSummary.set(successMessage);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo moderar la propiedad.'));
    } finally {
      this.reviewingOwnerPropertyId.set(null);
    }
  }
}
