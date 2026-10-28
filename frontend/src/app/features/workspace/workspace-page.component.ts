import { CommonModule, DatePipe, Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  LayoutGrid,
  List,
  LogOut,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Map as MapIcon,
  Menu,
  Mic,
  MessageSquare,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Settings,
  Sparkles,
  Star,
  X,
} from 'lucide-angular';
import { AuthStore } from '../../core/services/auth.store';
import { RealStateApiService, readApiErrorMessage } from '../../core/services/real-state-api.service';
import {
  ConversationMessage,
  ConversationDetail,
  ConversationListItem,
  CurrencyCode,
  FavoriteListItem,
  OperationType,
  PropertyResult,
  PropertyType,
  SearchFilters,
} from '../../core/types/api.types';

type FilterChip = {
  key: keyof SearchFilters;
  label: string;
  value: string;
};

type StarterPrompt = {
  label: string;
  message: string;
};

type QuickOption<T extends string> = {
  label: string;
  value: T;
};

type SidebarPanel = 'conversations' | 'filters';

type TurnSummary = {
  chips: string[];
};

type ConversationPreview = {
  summary: string;
  messagePreview: string;
  resumePrompt: string;
};

type WorkspacePreparedPrompt = {
  preparedPrompt: string;
  autoSend: boolean;
};

const PENDING_HOME_PROMPT_KEY = 'busca.ar.pendingHomePrompt';

type CarouselSlot = 'outer-prev' | 'far-prev' | 'prev' | 'active' | 'next' | 'far-next' | 'outer-next';

type CarouselCard = {
  result: PropertyResult;
  slot: CarouselSlot;
};

type PendingWorkspaceAction = 'message' | 'filters' | null;
type WorkspaceMobileView = 'history' | 'chat' | 'results';

const EMPTY_SEARCH_FILTERS: SearchFilters = {
  operation: null,
  propertyTypes: [],
  locations: [],
  geoConstraints: [],
  priceMin: null,
  priceMax: null,
  currency: null,
  rooms: null,
  roomsAnyOf: [],
  bedrooms: null,
  bathrooms: null,
  areaMin: null,
  areaMax: null,
  expensesMax: null,
  features: [],
  sortPreference: null,
};

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    label: 'Compra en Palermo',
    message: 'Quiero comprar un monoambiente en Palermo con balcon hasta 140000 USD.',
  },
  {
    label: 'Alquiler en Caballito',
    message: 'Busco alquiler de 2 ambientes en Caballito con balcon y expensas razonables.',
  },
  {
    label: 'Casa con patio',
    message: 'Quiero una casa en zona norte con patio, 3 dormitorios y 2 banos.',
  },
  {
    label: 'PH para invertir',
    message: 'Busco un PH para comprar en Almagro o Villa Crespo con buen potencial de renta.',
  },
];

const QUICK_OPERATION_OPTIONS: QuickOption<OperationType>[] = [
  { label: 'Compra', value: 'BUY' },
  { label: 'Alquiler', value: 'RENT' },
];

const QUICK_PROPERTY_TYPE_OPTIONS: QuickOption<PropertyType>[] = [
  { label: 'Departamento', value: 'APARTMENT' },
  { label: 'Casa', value: 'HOUSE' },
  { label: 'PH', value: 'PH' },
  { label: 'Terreno', value: 'LAND' },
  { label: 'Oficina', value: 'OFFICE' },
  { label: 'Local', value: 'LOCAL' },
  { label: 'Garage', value: 'GARAGE' },
];

const QUICK_CURRENCY_OPTIONS: QuickOption<CurrencyCode>[] = [
  { label: 'USD', value: 'USD' },
  { label: 'ARS', value: 'ARS' },
];

@Component({
  selector: 'app-workspace-page',
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    RouterLink,
    LucideAngularModule,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        BookOpen,
        Building2,
        ChevronLeft,
        ChevronRight,
        Heart,
        House,
        LayoutGrid,
        List,
        LogOut,
        Map: MapIcon,
        Menu,
        Mic,
        MessageSquare,
        MessagesSquare,
        PanelLeftClose,
        PanelLeftOpen,
        Plus,
        Send,
        Settings,
        Sparkles,
        Star,
        X,
      }),
    },
  ],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss',
})
export class WorkspacePageComponent {
  @ViewChild('chatThread')
  private chatThreadRef?: ElementRef<HTMLElement>;

  @ViewChild('composerInput')
  private composerInputRef?: ElementRef<HTMLTextAreaElement>;

  protected readonly authStore = inject(AuthStore);
  protected readonly starterPrompts = STARTER_PROMPTS;
  protected readonly quickOperationOptions = QUICK_OPERATION_OPTIONS;
  protected readonly quickPropertyTypeOptions = QUICK_PROPERTY_TYPE_OPTIONS;
  protected readonly quickCurrencyOptions = QUICK_CURRENCY_OPTIONS;
  protected readonly conversations = signal<ConversationListItem[]>([]);
  protected readonly activeConversation = signal<ConversationDetail | null>(null);
  protected readonly visibleResults = signal<PropertyResult[]>([]);
  protected readonly favoriteIds = signal<string[]>([]);
  protected readonly loadingConversations = signal(false);
  protected readonly loadingConversation = signal(false);
  protected readonly sendingMessage = signal(false);
  protected readonly creatingConversation = signal(false);
  protected readonly favoritesBusy = signal<string[]>([]);
  protected readonly selectedResultId = signal<string | null>(null);
  protected readonly selectedImageIndex = signal(0);
  protected readonly resultModalOpen = signal(false);
  protected readonly resultViewMode = signal<'grid' | 'list'>('grid');
  protected readonly resultVisibleLimit = signal(3);
  protected readonly compareSelection = signal<string[]>([]);
  protected readonly turnSummaries = signal<Record<string, TurnSummary>>({});
  protected readonly conversationPreviews = signal<Record<string, ConversationPreview>>({});
  protected readonly error = signal('');
  protected readonly draftMessage = signal('');
  protected readonly quickLocationDraft = signal('');
  protected readonly quickPriceMaxDraft = signal('');
  protected readonly quickRoomsDraft = signal('');
  protected readonly quickBedroomsDraft = signal('');
  protected readonly quickBathroomsDraft = signal('');
  protected readonly quickOperationDraft = signal<OperationType | ''>('');
  protected readonly quickPropertyTypeDraft = signal<PropertyType | ''>('');
  protected readonly quickCurrencyDraft = signal<CurrencyCode | ''>('');
  protected readonly sidebarPanel = signal<SidebarPanel>('conversations');
  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileWorkspaceView = signal<WorkspaceMobileView>('chat');
  protected readonly quickFiltersPanelOpen = signal(false);
  protected readonly composerExpanded = signal(false);
  protected readonly clarificationQuestion = signal('');
  protected readonly pendingWorkspaceAction = signal<PendingWorkspaceAction>(null);
  protected readonly activeFilters = computed(() =>
    this.buildFilterChips(this.activeConversation()?.searchState ?? null),
  );
  protected readonly activeConversationId = computed(() => this.activeConversation()?.id ?? null);
  protected readonly messageCount = computed(() => this.activeConversation()?.messages.length ?? 0);
  protected readonly resultCount = computed(() => this.visibleResults().length);
  protected readonly displayedResults = computed(() =>
    this.visibleResults().slice(0, this.resultVisibleLimit()),
  );
  protected readonly hasMoreVisibleResults = computed(
    () => this.displayedResults().length < this.resultCount(),
  );
  protected readonly hasConversation = computed(() => Boolean(this.activeConversation()));
  protected readonly shouldShowStarterPrompts = computed(() => !this.activeConversation() || this.messageCount() === 0);
  protected readonly hasEmptySearchResults = computed(() => {
    const conversation = this.activeConversation();

    return Boolean(
      conversation?.lastSearchRun &&
        !this.loadingConversation() &&
        !this.sendingMessage() &&
        this.visibleResults().length === 0,
    );
  });
  protected readonly selectedResult = computed(() => {
    const selectedId = this.selectedResultId();
    const results = this.visibleResults();

    if (results.length === 0) {
      return null;
    }

    return results.find((item) => item.propertyId === selectedId) ?? results[0];
  });
  protected readonly selectedResultIndex = computed(() => {
    const selected = this.selectedResult();
    const results = this.visibleResults();

    if (!selected || results.length === 0) {
      return -1;
    }

    return results.findIndex((item) => item.propertyId === selected.propertyId);
  });
  protected readonly carouselCards = computed<CarouselCard[]>(() => {
    const results = this.visibleResults();
    const selectedIndex = this.selectedResultIndex();

    if (results.length === 0 || selectedIndex === -1) {
      return [];
    }

    if (results.length === 1) {
      return [{ result: results[0]!, slot: 'active' }];
    }

    if (results.length === 2) {
      const otherIndex = selectedIndex === 0 ? 1 : 0;
      return [
        { result: results[selectedIndex]!, slot: 'active' },
        { result: results[otherIndex]!, slot: 'next' },
      ];
    }

    if (results.length === 3) {
      const previousIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
      const nextIndex = selectedIndex === results.length - 1 ? 0 : selectedIndex + 1;

      return [
        { result: results[previousIndex]!, slot: 'prev' },
        { result: results[selectedIndex]!, slot: 'active' },
        { result: results[nextIndex]!, slot: 'next' },
      ];
    }

    if (results.length === 4) {
      const previousIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
      const nextIndex = selectedIndex === results.length - 1 ? 0 : selectedIndex + 1;
      const farNextIndex = nextIndex === results.length - 1 ? 0 : nextIndex + 1;

      return [
        { result: results[previousIndex]!, slot: 'prev' },
        { result: results[selectedIndex]!, slot: 'active' },
        { result: results[nextIndex]!, slot: 'next' },
        { result: results[farNextIndex]!, slot: 'far-next' },
      ];
    }

    if (results.length === 5) {
      const previousIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
      const farPreviousIndex = previousIndex === 0 ? results.length - 1 : previousIndex - 1;
      const nextIndex = selectedIndex === results.length - 1 ? 0 : selectedIndex + 1;
      const farNextIndex = nextIndex === results.length - 1 ? 0 : nextIndex + 1;

      return [
        { result: results[farPreviousIndex]!, slot: 'far-prev' },
        { result: results[previousIndex]!, slot: 'prev' },
        { result: results[selectedIndex]!, slot: 'active' },
        { result: results[nextIndex]!, slot: 'next' },
        { result: results[farNextIndex]!, slot: 'far-next' },
      ];
    }

    if (results.length === 6) {
      const previousIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
      const farPreviousIndex = previousIndex === 0 ? results.length - 1 : previousIndex - 1;
      const nextIndex = selectedIndex === results.length - 1 ? 0 : selectedIndex + 1;
      const farNextIndex = nextIndex === results.length - 1 ? 0 : nextIndex + 1;
      const outerNextIndex = farNextIndex === results.length - 1 ? 0 : farNextIndex + 1;

      return [
        { result: results[farPreviousIndex]!, slot: 'far-prev' },
        { result: results[previousIndex]!, slot: 'prev' },
        { result: results[selectedIndex]!, slot: 'active' },
        { result: results[nextIndex]!, slot: 'next' },
        { result: results[farNextIndex]!, slot: 'far-next' },
        { result: results[outerNextIndex]!, slot: 'outer-next' },
      ];
    }

    const previousIndex = selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;
    const farPreviousIndex = previousIndex === 0 ? results.length - 1 : previousIndex - 1;
    const outerPreviousIndex = farPreviousIndex === 0 ? results.length - 1 : farPreviousIndex - 1;
    const nextIndex = selectedIndex === results.length - 1 ? 0 : selectedIndex + 1;
    const farNextIndex = nextIndex === results.length - 1 ? 0 : nextIndex + 1;
    const outerNextIndex = farNextIndex === results.length - 1 ? 0 : farNextIndex + 1;

    return [
      { result: results[outerPreviousIndex]!, slot: 'outer-prev' },
      { result: results[farPreviousIndex]!, slot: 'far-prev' },
      { result: results[previousIndex]!, slot: 'prev' },
      { result: results[selectedIndex]!, slot: 'active' },
      { result: results[nextIndex]!, slot: 'next' },
      { result: results[farNextIndex]!, slot: 'far-next' },
      { result: results[outerNextIndex]!, slot: 'outer-next' },
    ];
  });
  protected readonly selectedResultImages = computed(() => {
    const result = this.selectedResult();

    if (!result) {
      return [];
    }

    return result.images.filter((image) => image.trim().length > 0);
  });
  protected readonly selectedResultImage = computed(() => {
    const images = this.selectedResultImages();

    if (images.length === 0) {
      return null;
    }

    const safeIndex = Math.min(this.selectedImageIndex(), images.length - 1);
    return images[safeIndex] ?? images[0];
  });
  protected readonly compareResults = computed(() => {
    const selectedIds = this.compareSelection();
    const results = this.visibleResults();

    return selectedIds
      .map((id) => results.find((item) => item.propertyId === id) ?? null)
      .filter((item): item is PropertyResult => item !== null);
  });

  private readonly api = inject(RealStateApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private sheetTouchStartY = 0;
  private readonly destroyRef = inject(DestroyRef);
  private pendingPreparedPrompt: WorkspacePreparedPrompt | null = null;

  constructor() {
    this.pendingPreparedPrompt = this.readPreparedPromptState(
      this.router.getCurrentNavigation()?.extras.state,
    ) ?? this.readStoredHomePrompt();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const conversationId = params.get('id');

      if (conversationId) {
        if (this.activeConversation()?.id === conversationId) {
          return;
        }

        void this.loadConversation(conversationId);
        return;
      }

      void this.syncWorkspaceRootRoute();
    });
  }

  async ngOnInit() {
    await Promise.all([this.loadConversations(), this.loadFavorites()]);
    await this.syncWorkspaceRootRoute();
    await this.applyPendingPreparedPrompt();
  }

  protected updateDraft(value: string) {
    this.draftMessage.set(value);
  }

  protected formatMessageContent(content: string, role: ConversationMessage['role']) {
    const escaped = this.escapeHtml(content.trim()).replace(/\n/g, '<br />');

    if (role !== 'ASSISTANT') {
      return escaped;
    }

    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\b(USD|ARS)\s?([\d.,]+)/g, '<strong>$1 $2</strong>')
      .replace(
        /\b(\d+)\s+(departamentos?|propiedades?|casas?|deptos?|depto|ambientes?|dormitorios?|banos?|baños?|resultados?)\b/gi,
        '<strong>$1 $2</strong>',
      );
  }

  protected expandComposer() {
    this.composerExpanded.set(true);
  }

  protected collapseComposer() {
    this.composerExpanded.set(false);
  }

  protected updateQuickLocationDraft(value: string) {
    this.quickLocationDraft.set(value);
  }

  protected updateQuickPriceMaxDraft(value: string) {
    this.quickPriceMaxDraft.set(value);
  }

  protected updateQuickRoomsDraft(value: string) {
    this.quickRoomsDraft.set(value);
  }

  protected updateQuickBedroomsDraft(value: string) {
    this.quickBedroomsDraft.set(value);
  }

  protected updateQuickBathroomsDraft(value: string) {
    this.quickBathroomsDraft.set(value);
  }

  protected updateQuickOperationDraft(value: OperationType | '') {
    this.quickOperationDraft.set(value);
  }

  protected updateQuickPropertyTypeDraft(value: PropertyType | '') {
    this.quickPropertyTypeDraft.set(value);
  }

  protected updateQuickCurrencyDraft(value: CurrencyCode | '') {
    this.quickCurrencyDraft.set(value);
  }

  protected async applyStarterPrompt(message: string) {
    if (this.sendingMessage()) {
      return;
    }

    await this.sendPreparedMessage(message);
  }

  protected applyFilterAction(message: string) {
    this.closeQuickFiltersPanel();
    this.draftMessage.set(message);
    this.focusComposer();
  }

  protected async clearFilter(key: keyof SearchFilters) {
    const filtersToUnset =
      key === 'priceMax' ? ['priceMax', 'currency'] : key === 'roomsAnyOf' ? ['roomsAnyOf', 'rooms'] : [key];

    await this.patchSearchState({
      filtersToUnset,
      shouldSearch: true,
    });
  }

  protected async applyQuickLocation() {
    const location = this.quickLocationDraft().trim();

    if (!location) {
      return;
    }

    await this.patchSearchState({
      filterPatch: {
        locations: [location],
      },
      shouldSearch: true,
    });
  }

  protected async applyQuickPriceMax() {
    const priceMax = this.quickPriceMaxDraft().trim();

    if (!priceMax) {
      return;
    }

    const currency = this.quickCurrencyDraft() || this.activeConversation()?.searchState.currency || 'USD';
    const numericPriceMax = Number(priceMax);

    if (!Number.isFinite(numericPriceMax) || numericPriceMax < 0) {
      this.error.set('El tope debe ser un numero valido.');
      return;
    }

    await this.patchSearchState({
      filterPatch: {
        priceMax: numericPriceMax,
        currency,
      },
      shouldSearch: true,
    });
  }

  protected async applyQuickLayout() {
    const rooms = this.quickRoomsDraft().trim();
    const bedrooms = this.quickBedroomsDraft().trim();
    const bathrooms = this.quickBathroomsDraft().trim();
    const filterPatch: Record<string, unknown> = {};

    if (rooms) {
      const roomValues = this.parseRoomDraft(rooms);
      if (roomValues.length === 0) {
        this.error.set('Ambientes debe ser un numero valido.');
        return;
      }

      if (roomValues.length === 1) {
        filterPatch['rooms'] = roomValues[0];
      } else {
        filterPatch['roomsAnyOf'] = roomValues;
      }
    }

    if (bedrooms) {
      const numericBedrooms = Number(bedrooms);
      if (!Number.isFinite(numericBedrooms) || numericBedrooms < 0) {
        this.error.set('Dormitorios debe ser un numero valido.');
        return;
      }
      filterPatch['bedrooms'] = numericBedrooms;
    }

    if (bathrooms) {
      const numericBathrooms = Number(bathrooms);
      if (!Number.isFinite(numericBathrooms) || numericBathrooms < 0) {
        this.error.set('Banos debe ser un numero valido.');
        return;
      }
      filterPatch['bathrooms'] = numericBathrooms;
    }

    if (Object.keys(filterPatch).length === 0) {
      return;
    }

    await this.patchSearchState({
      filterPatch,
      shouldSearch: true,
    });
  }

  protected async applyQuickBasics() {
    const operation = this.quickOperationDraft();
    const propertyType = this.quickPropertyTypeDraft();
    const currency = this.quickCurrencyDraft();
    const filterPatch: Record<string, unknown> = {};

    if (operation) {
      filterPatch['operation'] = operation;
    }

    if (propertyType) {
      filterPatch['propertyTypes'] = [propertyType];
    }

    if (currency) {
      filterPatch['currency'] = currency;
    }

    if (Object.keys(filterPatch).length === 0) {
      return;
    }

    await this.patchSearchState({
      filterPatch,
      shouldSearch: true,
    });
  }

  protected toggleQuickFiltersPanel() {
    if (!this.hasConversation()) {
      return;
    }

    this.composerExpanded.set(true);
    this.quickFiltersPanelOpen.update((current) => !current);
  }

  protected closeQuickFiltersPanel() {
    this.quickFiltersPanelOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey() {
    if (this.quickFiltersPanelOpen()) {
      this.closeQuickFiltersPanel();
      return;
    }

    if (this.resultModalOpen()) {
      this.closeResultModal();
    }
  }

  protected setSidebarPanel(panel: SidebarPanel) {
    this.sidebarPanel.set(panel);
    this.sidebarOpen.set(true);
  }

  protected setMobileWorkspaceView(view: WorkspaceMobileView) {
    this.mobileWorkspaceView.set(view);
  }

  protected toggleSidebar() {
    this.sidebarOpen.update((current) => !current);
  }

  protected handleComposerKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void this.sendMessage();
  }

  protected async createConversation() {
    if (this.creatingConversation()) {
      return;
    }

    this.creatingConversation.set(true);
    this.error.set('');

    try {
      const created = await firstValueFrom(this.api.createConversation());
      const createdAt = created.createdAt ?? new Date().toISOString();

      this.activeConversation.set({
        id: created.id,
        title: created.title,
        status: 'ACTIVE',
        searchState: EMPTY_SEARCH_FILTERS,
        messages: [],
        lastSearchRun: null,
        lastSearchResults: [],
        createdAt,
        updatedAt: created.updatedAt ?? createdAt,
      });
      this.visibleResults.set([]);
      this.selectedImageIndex.set(0);
      this.compareSelection.set([]);
      this.turnSummaries.set({});
      this.clarificationQuestion.set('');
      this.updateConversationPreviewCache({
        id: created.id,
        title: created.title,
        status: 'ACTIVE',
        searchState: EMPTY_SEARCH_FILTERS,
        messages: [],
        lastSearchRun: null,
        lastSearchResults: [],
        createdAt,
        updatedAt: created.updatedAt ?? createdAt,
      });
      this.syncQuickFilters(EMPTY_SEARCH_FILTERS);
      await this.loadConversations();
      await this.router.navigate(['/app/chats', created.id], {
        replaceUrl: true,
      });
      this.sidebarPanel.set('conversations');
      this.mobileWorkspaceView.set('chat');
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo crear la conversación.'));
    } finally {
      this.creatingConversation.set(false);
    }
  }

  protected async sendMessage() {
    const message = this.draftMessage().trim();

    if (!message || this.sendingMessage()) {
      return;
    }

    this.closeQuickFiltersPanel();
    await this.sendPreparedMessage(message);
  }

  protected async toggleFavorite(propertyId: string) {
    if (this.favoritesBusy().includes(propertyId)) {
      return;
    }

    this.favoritesBusy.update((items) => [...items, propertyId]);

    try {
      if (this.isFavorite(propertyId)) {
        await firstValueFrom(this.api.removeFavorite(propertyId));
        this.favoriteIds.update((items) => items.filter((item) => item !== propertyId));
      } else {
        await firstValueFrom(this.api.addFavorite(propertyId));
        this.favoriteIds.update((items) => [...items, propertyId]);
      }
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo actualizar el favorito.'));
    } finally {
      this.favoritesBusy.update((items) => items.filter((item) => item !== propertyId));
    }
  }

  protected async openConversation(conversationId: string) {
    this.sidebarOpen.set(false);
    this.mobileWorkspaceView.set('chat');
    await this.router.navigate(['/app/chats', conversationId]);
  }

  protected selectResult(propertyId: string) {
    this.selectedResultId.set(propertyId);
    this.selectedImageIndex.set(0);
  }

  protected openResultModal(propertyId: string) {
    this.selectResult(propertyId);
    this.mobileWorkspaceView.set('results');
    this.resultModalOpen.set(true);
  }

  protected closeResultModal() {
    this.resultModalOpen.set(false);
  }

  protected beginResultSheetGesture(event: TouchEvent) {
    this.sheetTouchStartY = event.touches[0]?.clientY ?? 0;
  }

  protected endResultSheetGesture(event: TouchEvent) {
    const endY = event.changedTouches[0]?.clientY ?? this.sheetTouchStartY;

    if (endY - this.sheetTouchStartY > 64) {
      this.closeResultModal();
    }
  }

  protected closeWorkspaceOverlays() {
    this.sidebarOpen.set(false);
    this.closeQuickFiltersPanel();
    this.closeResultModal();
  }

  protected toggleSidebarCollapsed() {
    this.sidebarCollapsed.update((current) => !current);
  }

  protected isRouteActive(path: string) {
    const currentUrl = this.router.url.split('?')[0] ?? '';

    if (path === '/app/chats') {
      return currentUrl === '/search' || currentUrl.startsWith('/app/chats');
    }

    return currentUrl === path || currentUrl.startsWith(`${path}/`);
  }

  protected setResultViewMode(mode: 'grid' | 'list') {
    this.resultViewMode.set(mode);
  }

  protected loadMoreResults() {
    const currentVisible = this.displayedResults().length;
    const totalResults = this.resultCount();

    if (currentVisible < totalResults) {
      this.resultVisibleLimit.update((current) => Math.min(current + 3, totalResults));
      return;
    }

    this.askForMoreResults();
  }

  protected scrollResultsCarousel(direction: 'prev' | 'next') {
    const results = this.visibleResults();
    const selectedIndex = this.selectedResultIndex();

    if (results.length === 0 || selectedIndex === -1) {
      return;
    }

    const nextIndex =
      direction === 'next'
        ? selectedIndex >= results.length - 1
          ? 0
          : selectedIndex + 1
        : selectedIndex === 0
          ? results.length - 1
          : selectedIndex - 1;

    this.selectResult(results[nextIndex]!.propertyId);
  }

  protected toggleCompareResult(propertyId: string) {
    this.compareSelection.update((current) => {
      if (current.includes(propertyId)) {
        return current.filter((item) => item !== propertyId);
      }

      if (current.length >= 2) {
        return [current[1], propertyId];
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

  protected isFavorite(propertyId: string) {
    return this.favoriteIds().includes(propertyId);
  }

  protected isFavoriteBusy(propertyId: string) {
    return this.favoritesBusy().includes(propertyId);
  }

  protected getUserInitial() {
    const email = this.authStore.user()?.email ?? 'U';
    return email.charAt(0).toUpperCase();
  }

  protected async logout() {
    await this.authStore.logout();
    await this.router.navigate(['/login']);
  }

  protected formatPrice(result: PropertyResult) {
    if (result.price === null || !result.currency) {
      return 'Precio no informado';
    }

    return `${result.currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(result.price)}`;
  }

  protected formatMoneyValue(amount: number | null, currency: CurrencyCode | null, fallback: string) {
    if (amount === null || !currency) {
      return fallback;
    }

    return `${currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)}`;
  }

  private parseRoomDraft(value: string) {
    const numbers = value
      .split(/[,\s]+|(?:\s+o\s+)/i)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item >= 0);

    return Array.from(new Set(numbers)).sort((left, right) => left - right);
  }

  protected formatOperationType(result: PropertyResult) {
    const chunks: string[] = [];

    if (result.operation) {
      chunks.push(this.formatOperationLabel(result.operation));
    }

    if (result.propertyType) {
      chunks.push(this.formatPropertyTypeLabel(result.propertyType));
    }

    return chunks.length > 0 ? chunks.join(' / ') : 'Operacion no informada';
  }

  protected selectResultImage(index: number) {
    const images = this.selectedResultImages();

    if (images.length === 0) {
      this.selectedImageIndex.set(0);
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, images.length - 1));
    this.selectedImageIndex.set(safeIndex);
  }

  protected showPreviousResultImage() {
    const images = this.selectedResultImages();

    if (images.length <= 1) {
      return;
    }

    const nextIndex = this.selectedImageIndex() === 0 ? images.length - 1 : this.selectedImageIndex() - 1;
    this.selectedImageIndex.set(nextIndex);
  }

  protected showNextResultImage() {
    const images = this.selectedResultImages();

    if (images.length <= 1) {
      return;
    }

    const nextIndex = this.selectedImageIndex() >= images.length - 1 ? 0 : this.selectedImageIndex() + 1;
    this.selectedImageIndex.set(nextIndex);
  }

  protected formatExpenses(result: PropertyResult) {
    return this.formatMoneyValue(result.expenses, result.currency, 'Sin expensas informadas');
  }

  protected formatPublishedAt(result: PropertyResult) {
    if (!result.publishedAt) {
      return 'Fecha no informada';
    }

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(result.publishedAt));
  }

  protected formatRankScore(result: PropertyResult) {
    return result.rank.score.toFixed(2);
  }

  protected buildOperationalBadges(result: PropertyResult) {
    const badges: string[] = [];

    if (result.publisher) {
      badges.push('Anunciante visible');
    }

    if (result.contactWhatsApp) {
      badges.push('WhatsApp directo');
    } else if (result.contactPhone) {
      badges.push('Telefono directo');
    } else {
      badges.push('Contacto via fuente');
    }

    if (result.images.length >= 5) {
      badges.push('Galeria amplia');
    }

    return badges.slice(0, 3);
  }

  protected describeContactChannel(result: PropertyResult) {
    if (result.contactWhatsApp) {
      return 'Tiene salida directa por WhatsApp desde el workspace.';
    }

    if (result.contactPhone) {
      return 'Tiene telefono utilizable sin salir de la app.';
    }

    return 'El contacto confiable queda delegado a la fuente original.';
  }

  protected buildContactPhoneHref(result: PropertyResult) {
    if (!result.contactPhone) {
      return null;
    }

    const sanitized = result.contactPhone.replace(/[^\d+]/g, '');
    return sanitized.length > 0 ? `tel:${sanitized}` : null;
  }

  protected buildComparisonInsights(results: PropertyResult[]) {
    const [first, second] = results;

    if (!first || !second) {
      return ['Selecciona dos avisos para ver una lectura comparativa.'];
    }

    const insights: string[] = [];
    const firstLocation = first.locationText || first.neighborhood || first.city;
    const secondLocation = second.locationText || second.neighborhood || second.city;

    if (firstLocation && secondLocation) {
      if (firstLocation === secondLocation) {
        insights.push(`Los dos avisos apuntan a la misma ubicacion: ${firstLocation}.`);
      } else {
        insights.push(`Cambian de zona: ${firstLocation} vs ${secondLocation}.`);
      }
    }

    if (first.price !== null && second.price !== null && first.currency && first.currency === second.currency) {
      const cheaper = first.price <= second.price ? first : second;
      const expensive = cheaper.propertyId === first.propertyId ? second : first;
      const gap = Math.abs(first.price - second.price);

      if (gap === 0) {
        insights.push(`Tienen el mismo precio publicado: ${first.currency} ${first.price}.`);
      } else {
        insights.push(
          `${cheaper.title} queda mas barato que ${expensive.title} por ${cheaper.currency} ${gap}.`,
        );
      }
    }

    if (first.rooms !== null && second.rooms !== null && first.rooms !== second.rooms) {
      const roomLeader = first.rooms > second.rooms ? first : second;
      insights.push(`${roomLeader.title} ofrece mas ambientes: ${first.rooms} vs ${second.rooms}.`);
    }

    if (first.rank.score !== second.rank.score) {
      const stronger = first.rank.score >= second.rank.score ? first : second;
      insights.push(`${stronger.title} llega mejor rankeado en esta corrida (${stronger.rank.score.toFixed(2)}).`);
    }

    if (Boolean(first.contactWhatsApp) !== Boolean(second.contactWhatsApp)) {
      const withWhatsapp = first.contactWhatsApp ? first : second;
      insights.push(`${withWhatsapp.title} suma contacto directo por WhatsApp para una salida mas rapida.`);
    }

    if (first.publisher && second.publisher && first.publisher !== second.publisher) {
      insights.push(`Cambian de anunciante: ${first.publisher} vs ${second.publisher}.`);
    }

    if (insights.length === 0) {
      insights.push('Los dos avisos se ven bastante alineados en precio, zona y estructura base.');
    }

    return insights.slice(0, 4);
  }

  protected getSourceHostLabel(result: PropertyResult) {
    try {
      return new URL(result.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return result.source;
    }
  }

  protected getSourceBadgeLabel(result: PropertyResult) {
    return this.getSourceHostLabel(result).replace(/\.com\.ar$|\.com$|\.ar$/i, '');
  }

  protected summarizeResultsSubtitle() {
    const lastSearchRun = this.activeConversation()?.lastSearchRun;

    if (!lastSearchRun) {
      return 'Todavia no hay una corrida ejecutada.';
    }

    return `${lastSearchRun.resultCount} resultados en la ultima corrida.`;
  }

  protected buildResultFacts(result: PropertyResult) {
    const facts: string[] = [];

    if (result.rooms !== null) {
      facts.push(`${result.rooms} amb.`);
    }

    if (result.bedrooms !== null) {
      facts.push(`${result.bedrooms} dorm.`);
    }

    if (result.bathrooms !== null) {
      facts.push(`${result.bathrooms} banos`);
    }

    if (result.areaTotal !== null) {
      facts.push(`${result.areaTotal} m2`);
    } else if (result.areaCovered !== null) {
      facts.push(`${result.areaCovered} m2 cub.`);
    }

    return facts;
  }

  protected buildResultLocation(result: PropertyResult) {
    return result.locationText || result.neighborhood || result.city || 'Ubicacion no informada';
  }

  protected buildResultCardLocation(result: PropertyResult) {
    const address = this.buildCleanAddress(result, { includeFloor: false });
    const neighborhood = this.cleanLocationPart(result.neighborhood);

    if (address && neighborhood) {
      return `${address} - ${neighborhood}`;
    }

    return address || neighborhood || result.city || 'Ubicacion no informada';
  }

  protected buildDrawerAddressLine(result: PropertyResult) {
    return this.buildCleanAddress(result, { includeFloor: true }) || result.title;
  }

  protected buildDrawerNeighborhoodLine(result: PropertyResult) {
    return this.cleanLocationPart(result.neighborhood) || this.extractNeighborhoodFromLocation(result) || result.city || 'Ubicacion no informada';
  }

  protected buildResultMetricsLine(result: PropertyResult) {
    const metrics: string[] = [];

    if (result.rooms !== null) {
      metrics.push(`${result.rooms} amb`);
    }

    const area = result.areaTotal ?? result.areaCovered;
    if (area !== null) {
      metrics.push(`${area} m2`);
    }

    if (result.bathrooms !== null) {
      metrics.push(`${result.bathrooms} ba\u00f1o${result.bathrooms === 1 ? '' : 's'}`);
    }

    if (metrics.length === 0) {
      metrics.push(this.formatOperationType(result));
    }

    return metrics.join(' · ');
  }

  protected buildResultHighlight(result: PropertyResult) {
    const topReason = result.rank.reasons[0]?.trim();

    if (topReason) {
      return topReason;
    }

    if (result.features.length > 0) {
      const topFeatures = result.features.slice(0, 2).map((feature) => this.formatFeatureLabel(feature));
      return `Destaca por ${topFeatures.join(' y ')} dentro de la busqueda actual.`;
    }

    return 'Opcion alineada con los filtros activos de esta conversacion.';
  }

  protected buildDrawerFacts(result: PropertyResult) {
    return [
      { label: 'Ambientes', value: result.rooms !== null ? `${result.rooms}` : 'N/D' },
      { label: 'Dormitorios', value: result.bedrooms !== null ? `${result.bedrooms}` : 'N/D' },
      { label: 'Baños', value: result.bathrooms !== null ? `${result.bathrooms}` : 'N/D' },
      { label: 'Totales', value: result.areaTotal !== null ? `${result.areaTotal} m²` : result.areaCovered !== null ? `${result.areaCovered} m²` : 'N/D' },
      { label: 'Balcón', value: this.hasResultFeature(result, 'balcon') ? 'Sí' : 'No info' },
      { label: 'Cochera', value: this.hasResultFeature(result, 'cochera') ? 'Sí' : 'No info' },
    ];
  }

  protected buildDrawerFeatureList(result: PropertyResult) {
    const features = result.features.map((feature) => this.formatFeatureLabel(feature));

    if (result.expenses !== null && result.currency) {
      features.push(`Expensas: ${this.formatMoneyValue(result.expenses, result.currency, 'N/D')}`);
    }

    if (result.publisher) {
      features.push(`Publica: ${result.publisher}`);
    }

    if (result.publishedAt) {
      features.push(`Publicado: ${this.formatPublishedAt(result)}`);
    }

    return features.length > 0 ? features.slice(0, 8) : ['Sin caracteristicas ampliadas visibles'];
  }

  protected buildResultDescription(result: PropertyResult) {
    const description = ((result as PropertyResult & { description?: string | null }).description ?? '').trim();

    return this.cleanUserFacingDescription(description);
  }

  private buildCleanAddress(result: PropertyResult, options: { includeFloor: boolean }) {
    const locationText = this.getResultRawLocation(result);
    const locationBeforeCity = this.cutLocationBeforeCity(locationText);
    const parts = locationBeforeCity
      .split(',')
      .map((part) => this.cleanLocationPart(part))
      .filter((part) => part.length > 0);

    const street = parts.find((part) => /\d/.test(part) && !/^piso\b/i.test(part)) ?? parts[0] ?? '';
    const floor = options.includeFloor ? parts.find((part) => /^piso\b/i.test(part)) ?? '' : '';

    return [street, floor]
      .filter((part) => part.length > 0)
      .map((part) => this.toTitleCase(part))
      .join(', ');
  }

  private getResultRawLocation(result: PropertyResult) {
    const address = (result as PropertyResult & { address?: string | null }).address?.trim();
    return address || result.locationText || '';
  }

  private cutLocationBeforeCity(value: string) {
    return value
      .split(/,\s*(?:capital federal|argentina|ciudad autonoma|caba)\b/i)[0]
      ?.trim() ?? value.trim();
  }

  private cleanLocationPart(value: string | null | undefined) {
    return (value ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s+\|.*$/g, '')
      .trim();
  }

  private extractNeighborhoodFromLocation(result: PropertyResult) {
    const locationText = this.getResultRawLocation(result);
    const parts = locationText
      .split(',')
      .map((part) => this.cleanLocationPart(part))
      .filter((part) => part.length > 0);
    const ignored = /^(piso\b|capital federal\b|argentina\b|ciudad autonoma\b|caba\b)/i;

    return parts
      .slice()
      .reverse()
      .find((part) => !ignored.test(part) && !/\d/.test(part)) ?? '';
  }

  private cleanUserFacingDescription(value: string) {
    return value
      .replace(/resultado real extra[ií]do desde una fuente permitida\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toTitleCase(value: string) {
    return value
      .toLowerCase()
      .replace(/(^|[\s-])([a-záéíóúñ])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }

  protected buildContactHref(result: PropertyResult) {
    if (result.contactWhatsApp) {
      const sanitized = result.contactWhatsApp.replace(/[^\d]/g, '');
      if (sanitized.length > 0) {
        return `https://wa.me/${sanitized}`;
      }
    }

    return this.buildContactPhoneHref(result) ?? result.sourceUrl;
  }

  protected buildContactLabel(result: PropertyResult) {
    if (result.contactWhatsApp) {
      return 'Contactar anunciante';
    }

    if (result.contactPhone) {
      return 'Llamar anunciante';
    }

    return 'Abrir aviso original';
  }

  protected buildResultBadges(result: PropertyResult) {
    const badges: string[] = [];

    if (result.rank.position === 1) {
      badges.push('Top match');
    } else if (result.rank.position <= 3) {
      badges.push('Top 3');
    }

    if (result.rank.score >= 0.85) {
      badges.push('Score alto');
    }

    if (result.publishedAt) {
      const publishedAtTime = new Date(result.publishedAt).getTime();

      if (!Number.isNaN(publishedAtTime)) {
        const daysSincePublished = (Date.now() - publishedAtTime) / (1000 * 60 * 60 * 24);

        if (daysSincePublished <= 14) {
          badges.push('Reciente');
        }
      }
    }

    if (result.features.length >= 4 || this.buildResultFacts(result).length >= 3) {
      badges.push('Ficha completa');
    }

    return badges.slice(0, 3);
  }

  protected formatOperationLabel(value: OperationType) {
    return value === 'BUY' ? 'compra' : 'alquiler';
  }

  protected formatPropertyTypeLabel(value: PropertyType) {
    const option = this.quickPropertyTypeOptions.find((item) => item.value === value);
    return option?.label.toLowerCase() ?? value.toLowerCase();
  }

  protected formatFeatureLabel(value: string) {
    return value
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter((chunk) => chunk.length > 0)
      .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
      .join(' ');
  }

  protected hasResultFeature(result: PropertyResult, keyword: string) {
    const normalizedKeyword = keyword.toLowerCase();
    return result.features.some((feature) => feature.toLowerCase().includes(normalizedKeyword));
  }

  protected resetSearchState() {
    void this.patchSearchState({
      filtersToUnset: [
        'operation',
        'propertyTypes',
        'locations',
        'priceMin',
        'priceMax',
        'currency',
        'rooms',
        'roomsAnyOf',
        'bedrooms',
        'bathrooms',
        'areaMin',
        'areaMax',
        'expensesMax',
        'features',
        'sortPreference',
      ],
      shouldSearch: false,
    });
  }

  protected askForMoreResults() {
    this.applyFilterAction('Mostrame mas resultados manteniendo los filtros actuales.');
  }

  protected trackConversation(index: number, item: ConversationListItem) {
    return item.id;
  }

  protected trackMessage(index: number, item: ConversationDetail['messages'][number]) {
    return item.id;
  }

  protected trackResult(index: number, item: PropertyResult) {
    return item.propertyId;
  }

  protected getTurnSummary(messageId: string) {
    return this.turnSummaries()[messageId] ?? null;
  }

  protected getConversationPreviewSummary(conversationId: string) {
    if (this.activeConversation()?.id === conversationId) {
      return this.buildConversationPreview(this.activeConversation()!).summary;
    }

    return this.conversationPreviews()[conversationId]?.summary ?? 'Sin lectura operativa todavia';
  }

  protected getConversationPreviewMessage(conversationId: string) {
    if (this.activeConversation()?.id === conversationId) {
      return this.buildConversationPreview(this.activeConversation()!).messagePreview;
    }

    return this.conversationPreviews()[conversationId]?.messagePreview ?? 'Todavia no hay mensajes cargados';
  }

  protected applyConversationPreview(conversationId: string) {
    const preview = this.resolveConversationPreview(conversationId);

    if (!preview) {
      return;
    }

    this.draftMessage.set(preview.resumePrompt);
    this.focusComposer();
  }

  protected async rerunConversationPreview(conversationId: string) {
    const preview = this.resolveConversationPreview(conversationId);

    if (!preview || this.sendingMessage()) {
      return;
    }

    await this.sendPreparedMessage(preview.resumePrompt);
  }

  protected reuseResultAsPrompt(result: PropertyResult) {
    this.draftMessage.set(this.buildSimilarResultPrompt(result));
    this.focusComposer();
  }

  protected async searchSimilarToResult(result: PropertyResult) {
    if (this.sendingMessage()) {
      return;
    }

    await this.sendPreparedMessage(this.buildSimilarResultPrompt(result));
  }

  protected reuseComparisonAsPrompt() {
    if (this.compareResults().length !== 2) {
      return;
    }

    this.draftMessage.set(this.buildComparisonPrompt(this.compareResults()));
    this.focusComposer();
  }

  protected async searchFromComparison() {
    if (this.compareResults().length !== 2 || this.sendingMessage()) {
      return;
    }

    await this.sendPreparedMessage(this.buildComparisonPrompt(this.compareResults()));
  }

  protected async openMapView(properties: PropertyResult[] = this.visibleResults()) {
    const searchState = this.activeConversation()?.searchState ?? null;
    const reference = properties[0] ?? this.selectedResult();
    const query = searchState?.locations[0] ?? (reference ? this.buildResultLocation(reference) : 'CABA');

    await this.router.navigate(['/app/map'], {
      state: {
        mapQuery: query,
        properties,
      },
    });
  }

  protected async openComparisonMap() {
    const properties = this.compareResults().length > 0 ? this.compareResults() : this.visibleResults();
    await this.openMapView(properties);
  }

  protected buildMapHref(result: PropertyResult) {
    const query = [
      result.locationText,
      result.neighborhood,
      result.city,
      result.title,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(', ');

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'CABA')}`;
  }

  private async ensureConversationForMessage() {
    const existingConversationId = this.activeConversationId();

    if (existingConversationId) {
      return {
        conversationId: existingConversationId,
        createdNow: false,
      };
    }

    const created = await firstValueFrom(this.api.createConversation());
    const createdAt = created.createdAt ?? new Date().toISOString();

    this.activeConversation.set({
      id: created.id,
      title: created.title,
      status: 'ACTIVE',
      searchState: EMPTY_SEARCH_FILTERS,
      messages: [],
      lastSearchRun: null,
      lastSearchResults: [],
      createdAt,
      updatedAt: created.updatedAt ?? createdAt,
    });
    this.visibleResults.set([]);
    this.resultVisibleLimit.set(3);
    this.selectedResultId.set(null);
    this.selectedImageIndex.set(0);
    this.compareSelection.set([]);
    this.turnSummaries.set({});
    this.updateConversationPreviewCache({
      id: created.id,
      title: created.title,
      status: 'ACTIVE',
      searchState: EMPTY_SEARCH_FILTERS,
      messages: [],
      lastSearchRun: null,
      lastSearchResults: [],
      createdAt,
      updatedAt: created.updatedAt ?? createdAt,
    });
    this.syncQuickFilters(EMPTY_SEARCH_FILTERS);
    await this.loadConversations();

    return {
      conversationId: created.id,
      createdNow: true,
    };
  }

  private async loadConversations() {
    this.loadingConversations.set(true);

    try {
      const response = await firstValueFrom(this.api.listConversations());
      this.conversations.set(response.items);
      await this.syncWorkspaceRootRoute(response.items);
      void this.prefetchConversationPreviews(response.items);
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar el historial de conversaciones.'));
    } finally {
      this.loadingConversations.set(false);
    }
  }

  private async loadConversation(conversationId: string) {
    this.loadingConversation.set(true);
    this.error.set('');

    try {
      const detail = await firstValueFrom(this.api.getConversation(conversationId));
      this.activeConversation.set(detail);
      this.visibleResults.set(detail.lastSearchResults ?? []);
      this.resultVisibleLimit.set(3);
      this.mobileWorkspaceView.set('chat');
      this.turnSummaries.set(this.rebuildTurnSummaries(detail));
      this.updateConversationPreviewCache(detail);
      this.syncCompareSelection(detail.lastSearchResults ?? []);
      this.syncSelectedResult(detail.lastSearchResults ?? []);
      this.syncQuickFilters(detail.searchState);
      this.clarificationQuestion.set('');
      this.queueScrollToBottom('near-bottom');
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudo cargar la conversación.'));
    } finally {
      this.loadingConversation.set(false);
    }
  }

  private async loadFavorites() {
    try {
      const response = await firstValueFrom(this.api.listFavorites());
      this.favoriteIds.set(response.items.map((item: FavoriteListItem) => item.property.propertyId));
    } catch {
      this.favoriteIds.set([]);
    }
  }

  private async syncWorkspaceRootRoute(conversations = this.conversations()) {
    const routePath = this.route.snapshot.routeConfig?.path;
    const routeConversationId = this.route.snapshot.paramMap.get('id');

    if (routeConversationId) {
      return;
    }

    if (routePath === 'chat' && this.pendingPreparedPrompt) {
      this.activeConversation.set(null);
      this.visibleResults.set([]);
      this.resultVisibleLimit.set(3);
      return;
    }

    if (routePath === 'app/chats' || routePath === 'chat') {
      const latestConversation = conversations[0];

      if (latestConversation) {
        if (this.activeConversation()?.id !== latestConversation.id) {
          await this.router.navigate(['/app/chats', latestConversation.id], {
            replaceUrl: true,
          });
        }

        return;
      }
    }

    if (routePath === 'search' && this.activeConversation()) {
      return;
    }

    this.activeConversation.set(null);
    this.visibleResults.set([]);
    this.resultVisibleLimit.set(3);
    this.selectedResultId.set(null);
    this.selectedImageIndex.set(0);
    this.compareSelection.set([]);
    this.turnSummaries.set({});
    this.clarificationQuestion.set('');
    this.syncQuickFilters(null);
    this.sidebarPanel.set('conversations');
    this.mobileWorkspaceView.set('chat');
    this.queueScrollToBottom();
  }

  private buildFilterChips(filters: SearchFilters | null): FilterChip[] {
    if (!filters) {
      return [];
    }

    const chips: FilterChip[] = [];

    if (filters.operation) {
      chips.push({
        key: 'operation',
        label: 'Operacion',
        value: filters.operation === 'BUY' ? 'Compra' : 'Alquiler',
      });
    }

    if (filters.propertyTypes.length > 0) {
      chips.push({
        key: 'propertyTypes',
        label: 'Tipo',
        value: filters.propertyTypes.map((item) => this.formatPropertyTypeLabel(item)).join(', '),
      });
    }

    if (filters.locations.length > 0) {
      chips.push({
        key: 'locations',
        label: 'Ubicacion',
        value: filters.locations.join(', '),
      });
    }

    const geoConstraints = filters.geoConstraints ?? [];
    if (geoConstraints.length > 0) {
      const primaryGeo = geoConstraints[0]!;
      chips.push({
        key: 'geoConstraints',
        label: primaryGeo.kind === 'PROXIMITY' ? 'Cerca de' : 'Zona',
        value:
          primaryGeo.kind === 'PROXIMITY' && primaryGeo.radiusMeters
            ? `${primaryGeo.label} (${Math.round(primaryGeo.radiusMeters / 1000)} km)`
            : primaryGeo.label,
      });
    }

    if (filters.priceMax !== null && filters.currency) {
      chips.push({
        key: 'priceMax',
        label: 'Tope',
        value: `${filters.currency} ${filters.priceMax}`,
      });
    }

    if ((filters.roomsAnyOf ?? []).length > 0) {
      chips.push({
        key: 'roomsAnyOf',
        label: 'Ambientes',
        value: (filters.roomsAnyOf ?? []).join(' o '),
      });
    } else if (filters.rooms !== null) {
      chips.push({
        key: 'rooms',
        label: 'Ambientes',
        value: `${filters.rooms}`,
      });
    }

    if (filters.bedrooms !== null) {
      chips.push({
        key: 'bedrooms',
        label: 'Dormitorios',
        value: `${filters.bedrooms}`,
      });
    }

    if (filters.bathrooms !== null) {
      chips.push({
        key: 'bathrooms',
        label: 'Banos',
        value: `${filters.bathrooms}`,
      });
    }

    if (filters.features.length > 0) {
      chips.push({
        key: 'features',
        label: 'Features',
        value: filters.features.map((item) => this.formatFeatureLabel(item)).join(', '),
      });
    }

    return chips;
  }

  private queueScrollToBottom(mode: 'force' | 'near-bottom' = 'near-bottom') {
    queueMicrotask(() => {
      setTimeout(() => {
        const chatThread = this.chatThreadRef?.nativeElement;

        if (!chatThread) {
          return;
        }

        const distanceToBottom = chatThread.scrollHeight - chatThread.scrollTop - chatThread.clientHeight;
        const shouldAutoScroll = mode === 'force' || distanceToBottom < 180;

        if (!shouldAutoScroll) {
          return;
        }

        chatThread.scrollTo({
          top: chatThread.scrollHeight,
          behavior: 'smooth',
        });
      }, 0);
    });
  }

  private focusComposer() {
    queueMicrotask(() => {
      this.composerInputRef?.nativeElement.focus();
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async sendPreparedMessage(message: string) {
    if (!message || this.sendingMessage()) {
      return;
    }

    this.sendingMessage.set(true);
    this.pendingWorkspaceAction.set('message');
    this.error.set('');
    this.draftMessage.set('');
    this.clarificationQuestion.set('');
    let conversationId: string | null = null;

    try {
      const ensuredConversation = await this.ensureConversationForMessage();
      conversationId = ensuredConversation.conversationId;
      const createdNow = ensuredConversation.createdNow;
      if (createdNow) {
        this.location.replaceState(`/app/chats/${conversationId}`);
      }
      this.appendUserMessage(message);
      this.queueScrollToBottom('force');
      const response = await firstValueFrom(this.api.sendMessage(conversationId, message));
      this.applyChatResponse(response);
      await this.loadConversation(conversationId);
      await Promise.all([this.loadConversations(), this.loadFavorites()]);
      this.queueScrollToBottom('force');
    } catch (error) {
      const wasRecovered = conversationId ? await this.tryRecoverConversationAfterSendFailure(conversationId) : false;
      if (!wasRecovered) {
        this.rollbackLastUserMessage(message);
        this.draftMessage.set(message);
      }
      this.error.set(readApiErrorMessage(error, 'No se pudo enviar el mensaje.'));
    } finally {
      this.pendingWorkspaceAction.set(null);
      this.sendingMessage.set(false);
    }
  }

  private async patchSearchState(input: {
    filterPatch?: Record<string, unknown>;
    filtersToUnset?: string[];
    shouldSearch?: boolean;
  }) {
    const conversationId = this.activeConversationId();

    if (!conversationId || this.sendingMessage()) {
      return;
    }

    this.sendingMessage.set(true);
    this.pendingWorkspaceAction.set('filters');
    this.error.set('');
    this.closeQuickFiltersPanel();
    this.clarificationQuestion.set('');

    try {
      const response = await firstValueFrom(this.api.patchSearchState(conversationId, input));
      this.applyChatResponse(response);
      await Promise.all([this.loadConversations(), this.loadFavorites()]);
      this.queueScrollToBottom('force');
    } catch (error) {
      this.error.set(readApiErrorMessage(error, 'No se pudieron actualizar los filtros.'));
    } finally {
      this.pendingWorkspaceAction.set(null);
      this.sendingMessage.set(false);
    }
  }

  private buildSimilarResultPrompt(result: PropertyResult) {
    const chunks = ['Quiero buscar propiedades parecidas a este aviso'];
    const operation = result.operation ? this.formatOperationLabel(result.operation) : null;
    const propertyType = result.propertyType ? this.formatPropertyTypeLabel(result.propertyType) : null;
    const location = result.locationText || result.neighborhood || result.city || null;

    if (operation) {
      chunks.push(`para ${operation}`);
    }

    if (propertyType) {
      chunks.push(`tipo ${propertyType}`);
    }

    if (location) {
      chunks.push(`en ${location}`);
    }

    if (result.price !== null && result.currency) {
      chunks.push(`con un presupuesto cercano a ${result.currency} ${result.price}`);
    }

    if (result.rooms !== null) {
      chunks.push(`alrededor de ${result.rooms} ambientes`);
    }

    if (result.bedrooms !== null) {
      chunks.push(`con ${result.bedrooms} dormitorios`);
    }

    const highlightedFeatures = result.features.slice(0, 3);

    if (highlightedFeatures.length > 0) {
      chunks.push(`y si es posible ${highlightedFeatures.join(', ')}`);
    }

    return `${chunks.join(', ')}. Mostrame alternativas similares y mantene una lectura operativa corta.`;
  }

  private buildComparisonPrompt(results: PropertyResult[]) {
    const [first, second] = results;

    if (!first || !second) {
      return 'Quiero buscar propiedades similares a los avisos que compare recien.';
    }

    return [
      'Quiero una nueva busqueda tomando como referencia estos dos avisos comparados.',
      `Opcion 1: ${this.describeResultForPrompt(first)}.`,
      `Opcion 2: ${this.describeResultForPrompt(second)}.`,
      'Prioriza alternativas intermedias o parecidas a las dos, manteniendo una respuesta operativa corta.',
    ].join(' ');
  }

  private describeResultForPrompt(result: PropertyResult) {
    const chunks: string[] = [];

    if (result.operation) {
      chunks.push(`operacion ${this.formatOperationLabel(result.operation)}`);
    }

    if (result.propertyType) {
      chunks.push(`tipo ${this.formatPropertyTypeLabel(result.propertyType)}`);
    }

    const location = result.locationText || result.neighborhood || result.city;

    if (location) {
      chunks.push(`ubicacion ${location}`);
    }

    if (result.price !== null && result.currency) {
      chunks.push(`precio ${result.currency} ${result.price}`);
    }

    if (result.rooms !== null) {
      chunks.push(`${result.rooms} ambientes`);
    }

    if (result.bedrooms !== null) {
      chunks.push(`${result.bedrooms} dormitorios`);
    }

    const highlightedFeatures = result.features.slice(0, 3);

    if (highlightedFeatures.length > 0) {
      chunks.push(`features ${highlightedFeatures.join(', ')}`);
    }

    return chunks.join(', ');
  }

  private readPreparedPromptState(state: unknown): WorkspacePreparedPrompt | null {
    if (!state || typeof state !== 'object') {
      return null;
    }

    const candidate = state as Partial<WorkspacePreparedPrompt>;

    if (typeof candidate.preparedPrompt !== 'string' || candidate.preparedPrompt.trim().length === 0) {
      return null;
    }

    return {
      preparedPrompt: candidate.preparedPrompt.trim(),
      autoSend: candidate.autoSend === true,
    };
  }

  private readStoredHomePrompt(): WorkspacePreparedPrompt | null {
    const preparedPrompt = sessionStorage.getItem(PENDING_HOME_PROMPT_KEY)?.trim() ?? '';
    sessionStorage.removeItem(PENDING_HOME_PROMPT_KEY);

    if (!preparedPrompt) {
      return null;
    }

    return {
      preparedPrompt,
      autoSend: true,
    };
  }

  private async applyPendingPreparedPrompt() {
    if (!this.pendingPreparedPrompt) {
      return;
    }

    const prepared = this.pendingPreparedPrompt;
    this.pendingPreparedPrompt = null;

    if (prepared.autoSend) {
      await this.sendPreparedMessage(prepared.preparedPrompt);
      return;
    }

    this.draftMessage.set(prepared.preparedPrompt);
    this.focusComposer();
  }

  private appendUserMessage(content: string) {
    this.activeConversation.update((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        messages: [
          ...current.messages,
          {
            id: `local-user-${Date.now()}`,
            role: 'USER',
            content,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  private rollbackLastUserMessage(content: string) {
    this.activeConversation.update((current) => {
      if (!current || current.messages.length === 0) {
        return current;
      }

      const lastMessage = current.messages[current.messages.length - 1];

      if (lastMessage.role !== 'USER' || lastMessage.content !== content || !lastMessage.id.startsWith('local-user-')) {
        return current;
      }

      return {
        ...current,
        messages: current.messages.slice(0, -1),
      };
    });
  }

  private async tryRecoverConversationAfterSendFailure(conversationId: string) {
    try {
      await this.loadConversation(conversationId);
      await this.loadConversations();
      return true;
    } catch {
      return false;
    }
  }

  private applyChatResponse(response: {
    assistantMessage: string;
    searchState: SearchFilters;
    didSearch?: boolean;
    requiresClarification?: boolean;
    clarificationQuestion?: string | null;
    results: PropertyResult[];
    meta: {
      searchRunId: string | null;
      resultCount: number;
    };
  }) {
    const now = new Date().toISOString();
    const previousFilters = this.activeConversation()?.searchState ?? EMPTY_SEARCH_FILTERS;
    const assistantMessageId = `local-assistant-${Date.now()}`;

    this.activeConversation.update((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        searchState: response.searchState,
        updatedAt: now,
        lastSearchRun: response.meta.searchRunId
          ? {
              id: response.meta.searchRunId,
              status: 'COMPLETED',
              resultCount: response.meta.resultCount,
              createdAt: now,
            }
          : current.lastSearchRun,
        lastSearchResults: response.results,
        messages: [
          ...current.messages,
          {
            id: assistantMessageId,
            role: 'ASSISTANT',
            content: response.assistantMessage,
            createdAt: now,
          },
        ],
      };
    });

    this.turnSummaries.update((current) => ({
      ...current,
      [assistantMessageId]: {
        chips: this.buildTurnSummaryChips(previousFilters, response.searchState, response),
      },
    }));
    this.visibleResults.set(response.results);
    this.resultVisibleLimit.set(3);
    this.syncCompareSelection(response.results);
    this.syncSelectedResult(response.results);
    this.syncQuickFilters(response.searchState);
    this.clarificationQuestion.set(response.requiresClarification ? response.clarificationQuestion?.trim() ?? '' : '');
  }

  private syncQuickFilters(filters: SearchFilters | null) {
    this.quickLocationDraft.set(filters?.locations[0] ?? '');
    this.quickPriceMaxDraft.set(filters?.priceMax !== null && filters?.priceMax !== undefined ? `${filters.priceMax}` : '');
    this.quickRoomsDraft.set(
      (filters?.roomsAnyOf ?? []).length > 0
        ? (filters?.roomsAnyOf ?? []).join(' o ')
        : filters?.rooms !== null && filters?.rooms !== undefined
          ? `${filters.rooms}`
          : '',
    );
    this.quickBedroomsDraft.set(filters?.bedrooms !== null && filters?.bedrooms !== undefined ? `${filters.bedrooms}` : '');
    this.quickBathroomsDraft.set(filters?.bathrooms !== null && filters?.bathrooms !== undefined ? `${filters.bathrooms}` : '');
    this.quickOperationDraft.set(filters?.operation ?? '');
    this.quickPropertyTypeDraft.set(filters?.propertyTypes[0] ?? '');
    this.quickCurrencyDraft.set(filters?.currency ?? '');
  }

  private buildTurnSummaryChips(
    previousFilters: SearchFilters,
    nextFilters: SearchFilters,
    response: {
      didSearch?: boolean;
      requiresClarification?: boolean;
      meta: {
        resultCount: number;
      };
    },
  ) {
    const chips: string[] = [];

    if (response.requiresClarification) {
      chips.push('Pide aclaracion');
    } else if (response.didSearch) {
      chips.push(`Busqueda: ${response.meta.resultCount} resultados`);
    } else {
      chips.push('Sin nueva busqueda');
    }

    this.pushFilterChangeChip(chips, 'Operacion', previousFilters.operation, nextFilters.operation);
    this.pushFilterChangeChip(chips, 'Tipo', previousFilters.propertyTypes[0] ?? null, nextFilters.propertyTypes[0] ?? null);
    this.pushFilterChangeChip(chips, 'Ubicacion', previousFilters.locations[0] ?? null, nextFilters.locations[0] ?? null);
    this.pushFilterChangeChip(chips, 'Tope', this.buildBudgetValue(previousFilters), this.buildBudgetValue(nextFilters));
    this.pushFilterChangeChip(chips, 'Ambientes', this.buildRoomsValue(previousFilters), this.buildRoomsValue(nextFilters));
    this.pushFilterChangeChip(chips, 'Dormitorios', previousFilters.bedrooms, nextFilters.bedrooms);
    this.pushFilterChangeChip(chips, 'Banos', previousFilters.bathrooms, nextFilters.bathrooms);

    return chips.slice(0, 5);
  }

  private rebuildTurnSummaries(detail: ConversationDetail) {
    const assistantMessages = detail.messages.filter((message) => message.role === 'ASSISTANT');

    if (assistantMessages.length === 0) {
      return {};
    }

    const lastAssistantId = assistantMessages.at(-1)?.id ?? null;

    return assistantMessages.reduce<Record<string, TurnSummary>>((summaries, message) => {
      const summary = this.buildRehydratedTurnSummary(detail, message.id === lastAssistantId);

      if (summary) {
        summaries[message.id] = summary;
      }

      return summaries;
    }, {});
  }

  private buildRehydratedTurnSummary(detail: ConversationDetail, isLatestAssistant: boolean): TurnSummary | null {
    const chips: string[] = [];
    const filters = detail.searchState;

    if (isLatestAssistant && detail.lastSearchRun) {
      chips.push(`Busqueda: ${detail.lastSearchRun.resultCount} resultados`);
    } else {
      chips.push('Respuesta operativa');
    }

    if (filters.operation) {
      chips.push(`Operacion: ${this.formatOperationLabel(filters.operation)}`);
    }

    if (filters.propertyTypes[0]) {
      chips.push(`Tipo: ${this.formatPropertyTypeLabel(filters.propertyTypes[0])}`);
    }

    if (filters.locations[0]) {
      chips.push(`Ubicacion: ${filters.locations[0]}`);
    }

    const budgetValue = this.buildBudgetValue(filters);

    if (budgetValue) {
      chips.push(`Tope: ${budgetValue}`);
    }

    const roomsValue = this.buildRoomsValue(filters);

    if (roomsValue) {
      chips.push(`Ambientes: ${roomsValue}`);
    }

    return chips.length > 0 ? { chips: chips.slice(0, 5) } : null;
  }

  private pushFilterChangeChip(
    chips: string[],
    label: string,
    previousValue: string | number | null,
    nextValue: string | number | null,
  ) {
    if (previousValue === nextValue) {
      return;
    }

    if (nextValue === null || nextValue === '') {
      chips.push(`${label}: limpio`);
      return;
    }

    chips.push(`${label}: ${nextValue}`);
  }

  private buildBudgetValue(filters: SearchFilters) {
    if (filters.priceMax === null || !filters.currency) {
      return null;
    }

    return `${filters.currency} ${filters.priceMax}`;
  }

  private buildRoomsValue(filters: SearchFilters) {
    if ((filters.roomsAnyOf ?? []).length > 0) {
      return (filters.roomsAnyOf ?? []).join(' o ');
    }

    return filters.rooms !== null ? `${filters.rooms}` : null;
  }

  private async prefetchConversationPreviews(conversations: ConversationListItem[]) {
    const ids = conversations
      .slice(0, 6)
      .map((item) => item.id)
      .filter((id) => !this.conversationPreviews()[id] && this.activeConversation()?.id !== id);

    await Promise.allSettled(
      ids.map(async (id) => {
        const detail = await firstValueFrom(this.api.getConversation(id));
        this.updateConversationPreviewCache(detail);
      }),
    );
  }

  private updateConversationPreviewCache(detail: ConversationDetail) {
    const preview = this.buildConversationPreview(detail);

    this.conversationPreviews.update((current) => ({
      ...current,
      [detail.id]: preview,
    }));
  }

  private buildConversationPreview(detail: ConversationDetail): ConversationPreview {
    const summaryParts: string[] = [];
    const filters = detail.searchState;

    if (filters.operation) {
      summaryParts.push(filters.operation === 'BUY' ? 'Compra' : 'Alquiler');
    }

    if (filters.propertyTypes[0]) {
      summaryParts.push(this.formatPropertyTypeLabel(filters.propertyTypes[0]));
    }

    if (filters.locations[0]) {
      summaryParts.push(filters.locations[0]);
    }

    if (filters.priceMax !== null && filters.currency) {
      summaryParts.push(`${filters.currency} ${filters.priceMax}`);
    }

    const latestMessage = [...detail.messages].reverse().find((message) => message.content.trim().length > 0);

    return {
      summary: summaryParts.length > 0 ? summaryParts.slice(0, 3).join(' / ') : 'Sin filtros activos',
      messagePreview: latestMessage ? this.truncateMessagePreview(latestMessage) : 'Todavia no hay mensajes cargados',
      resumePrompt: this.buildResumePrompt(filters),
    };
  }

  private truncateMessagePreview(message: ConversationMessage) {
    const prefix = message.role === 'USER' ? 'Vos: ' : 'Asistente: ';
    const compactContent = message.content.replace(/\s+/g, ' ').trim();
    const preview = `${prefix}${compactContent}`;

    return preview.length > 92 ? `${preview.slice(0, 89)}...` : preview;
  }

  private resolveConversationPreview(conversationId: string) {
    const activeConversation = this.activeConversation();

    if (activeConversation?.id === conversationId) {
      return this.buildConversationPreview(activeConversation);
    }

    return this.conversationPreviews()[conversationId] ?? null;
  }

  private buildResumePrompt(filters: SearchFilters) {
    const parts: string[] = [];

    if (filters.operation) {
      parts.push(filters.operation === 'BUY' ? 'compra' : 'alquiler');
    }

    if (filters.propertyTypes[0]) {
      parts.push(this.formatPropertyTypeLabel(filters.propertyTypes[0]));
    }

    if (filters.locations[0]) {
      parts.push(`en ${filters.locations[0]}`);
    }

    if (filters.priceMax !== null && filters.currency) {
      parts.push(`hasta ${filters.currency} ${filters.priceMax}`);
    }

    const roomsValue = this.buildRoomsValue(filters);

    if (roomsValue) {
      parts.push(`${roomsValue} ambientes`);
    }

    if (filters.bedrooms !== null) {
      parts.push(`${filters.bedrooms} dormitorios`);
    }

    if (filters.bathrooms !== null) {
      parts.push(`${filters.bathrooms} banos`);
    }

    if (filters.features.length > 0) {
      parts.push(`con ${filters.features.slice(0, 3).join(', ')}`);
    }

    if (parts.length === 0) {
      return 'Quiero retomar una busqueda parecida y ver nuevas opciones.';
    }

    return `Quiero retomar una busqueda de ${parts.join(' ')}. Mantene esos filtros y mostrame nuevas opciones.`;
  }

  private syncSelectedResult(results: PropertyResult[]) {
    const selectedId = this.selectedResultId();

    if (results.length === 0) {
      this.selectedResultId.set(null);
      this.selectedImageIndex.set(0);
      return;
    }

    if (selectedId && results.some((item) => item.propertyId === selectedId)) {
      return;
    }

    this.selectedResultId.set(results[0].propertyId);
    this.selectedImageIndex.set(0);
  }

  private syncCompareSelection(results: PropertyResult[]) {
    const validIds = new Set(results.map((item) => item.propertyId));

    this.compareSelection.update((current) => current.filter((id) => validIds.has(id)).slice(0, 2));
  }
}
