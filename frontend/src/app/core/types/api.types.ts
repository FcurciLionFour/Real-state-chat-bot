export type UserRole = 'USER' | 'OWNER' | 'ADMIN';
export type ConversationStatus = 'ACTIVE' | 'ARCHIVED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type OperationType = 'BUY' | 'RENT';
export type CurrencyCode = 'USD' | 'ARS';
export type PropertyType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'PH'
  | 'LAND'
  | 'OFFICE'
  | 'LOCAL'
  | 'GARAGE';
export type SearchRunStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type BlogCategory = 'COMPRA' | 'ALQUILER' | 'INVERSION' | 'TIPS';
export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'ARCHIVED';
export type ScrapingSourceHealthStatus = 'ACTIVE' | 'DEGRADED' | 'BLOCKED' | 'EXPERIMENTAL';
export type OwnerPropertyOperationType = 'SALE' | 'RENT';
export type OwnerPropertyType = 'APARTMENT' | 'HOUSE' | 'LAND' | 'OFFICE' | 'STORE';
export type OwnerPropertyStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'UNPUBLISHED';

export type SearchFilters = {
  operation: OperationType | null;
  propertyTypes: PropertyType[];
  locations: string[];
  geoConstraints?: Array<{
    kind: 'AREA' | 'PROXIMITY';
    sourceText: string;
    label: string;
    province: string | null;
    city: string | null;
    neighborhood: string | null;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
    confidence: number;
    provider: string;
  }>;
  priceMin: number | null;
  priceMax: number | null;
  currency: CurrencyCode | null;
  rooms: number | null;
  roomsAnyOf?: number[];
  bedrooms: number | null;
  bathrooms: number | null;
  areaMin: number | null;
  areaMax: number | null;
  expensesMax: number | null;
  features: string[];
  sortPreference: 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'NEWEST' | null;
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export type ConversationListItem = {
  id: string;
  title: string;
  status: ConversationStatus;
  lastSearchAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationListResponse = {
  items: ConversationListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type PropertyResult = {
  propertyId: string;
  source: string;
  sourceUrl: string;
  publisher?: string | null;
  contactPhone?: string | null;
  contactWhatsApp?: string | null;
  title: string;
  operation: OperationType | null;
  propertyType: PropertyType | null;
  price: number | null;
  currency: CurrencyCode | null;
  expenses: number | null;
  city: string | null;
  neighborhood: string | null;
  locationText: string | null;
  geo: {
    latitude: number;
    longitude: number;
    precision: 'exact' | 'street' | 'neighborhood' | 'unknown';
    provider: string;
    geocodedAt?: string | null;
  } | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  features: string[];
  images: string[];
  scrapedAt: string;
  publishedAt: string | null;
  rank: {
    position: number;
    score: number;
    reasons: string[];
  };
};

export type ConversationDetail = {
  id: string;
  title: string;
  status: ConversationStatus;
  searchState: SearchFilters;
  messages: ConversationMessage[];
  lastSearchRun: {
    id: string;
    status: SearchRunStatus;
    resultCount: number;
    createdAt: string;
  } | null;
  lastSearchResults: PropertyResult[];
  createdAt: string;
  updatedAt: string;
};

export type SendMessageResponse = {
  conversationId: string;
  assistantMessage: string;
  searchState: SearchFilters;
  didSearch: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  results: PropertyResult[];
  meta: {
    searchRunId: string | null;
    sourcesUsed: string[];
    resultCount: number;
  };
};

export type FavoriteListItem = {
  favoriteId: string;
  createdAt: string;
  property: {
    propertyId: string;
    source: string;
    sourceUrl: string;
    publisher?: string | null;
    contactPhone?: string | null;
    contactWhatsApp?: string | null;
    title: string;
    operation: OperationType | null;
    propertyType: PropertyType | null;
    price: number | null;
    currency: CurrencyCode | null;
    city: string | null;
    neighborhood: string | null;
    locationText?: string | null;
    geo?: {
      latitude: number;
      longitude: number;
      precision: 'exact' | 'street' | 'neighborhood' | 'unknown';
      provider: string;
      geocodedAt?: string | null;
    } | null;
    listingStatus: string;
    scrapedAt: string;
    images: string[];
  };
};

export type FavoriteListResponse = {
  items: FavoriteListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type FavoriteMutationResponse = {
  favoriteId: string;
  propertyId: string;
  createdAt: string;
};

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
};

export type AdminOverview = {
  usersCount: number;
  conversationsCount: number;
  searchRunsCount: number;
  propertiesCacheCount: number;
  favoritesCount: number;
  leadsCount?: number;
  blogArticlesCount?: number;
};

export type AdminMetricsResponse = {
  overview: AdminOverview;
  activityLast7d: {
    users: number;
    conversations: number;
    searchRuns: number;
    favorites: number;
  };
  searchRunsByStatus: Array<{
    status: SearchRunStatus;
    count: number;
  }>;
  propertiesByListingStatus: Array<{
    status: string;
    count: number;
  }>;
  topPropertySources: Array<{
    source: string;
    count: number;
  }>;
};

export type AdminUsersResponse = {
  items: Array<{
    id: string;
    email: string;
    role: UserRole;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
    conversationsCount: number;
    favoritesCount: number;
    refreshTokensCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type AdminConversationsResponse = {
  items: Array<{
    id: string;
    title: string;
    status: ConversationStatus;
    lastSearchAt: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      email: string;
      role: UserRole;
    };
    messagesCount: number;
    searchRunsCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type AdminSearchRunsResponse = {
  items: Array<{
    id: string;
    queryText: string;
    status: SearchRunStatus;
    resultCount: number;
    createdAt: string;
    conversation: {
      id: string;
      title: string;
      user: {
        id: string;
        email: string;
      };
    };
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type AdminPropertiesResponse = {
  items: Array<{
    id: string;
    source: string;
    sourceUrl: string;
    title: string;
    operation: OperationType | null;
    propertyType: PropertyType | null;
    listingStatus: string;
    city: string | null;
    neighborhood: string | null;
    price: number | null;
    currency: CurrencyCode | null;
    scrapedAt: string;
    createdAt: string;
    favoritesCount: number;
    appearancesCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export type OwnerProperty = {
  id: string;
  ownerId: string;
  sourceType: 'OWNER_SUBMITTED';
  operationType: OwnerPropertyOperationType;
  propertyType: OwnerPropertyType;
  title: string;
  description: string;
  province: string;
  city: string;
  neighborhood: string;
  address: string;
  showExactAddress: boolean;
  currency: CurrencyCode;
  price: number;
  expenses: number | null;
  acceptsCredit: boolean;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  coveredAreaM2: number | null;
  totalAreaM2: number | null;
  floor: number | null;
  age: number | null;
  features: string[];
  images: string[];
  mainImageUrl: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  status: OwnerPropertyStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  owner?: {
    id: string;
    email: string;
    role: UserRole;
  };
};

export type OwnerPropertiesResponse = {
  items: OwnerProperty[];
  meta: AdminListMeta;
};

export type CreateOwnerPropertyPayload = {
  operationType: OwnerPropertyOperationType;
  propertyType: OwnerPropertyType;
  title: string;
  description: string;
  province: string;
  city: string;
  neighborhood: string;
  address: string;
  showExactAddress?: boolean;
  currency: CurrencyCode;
  price: number;
  expenses?: number | null;
  acceptsCredit?: boolean;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  coveredAreaM2?: number | null;
  totalAreaM2?: number | null;
  floor?: number | null;
  age?: number | null;
  features?: string[];
  images?: string[];
  mainImageUrl?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
};

export type UpdateOwnerPropertyPayload = Partial<CreateOwnerPropertyPayload>;

export type ReviewOwnerPropertyPayload = {
  rejectionReason: string;
};

export type BlogArticleResponse = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  coverImageUrl: string | null;
  content: Array<{
    heading?: string;
    body: string;
  }>;
  readingMinutes: number;
  relatedSearchPrompt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  author: {
    id: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBlogArticleResponse = BlogArticleResponse & {
  status: BlogStatus;
};

export type BlogArticlesResponse = {
  items: BlogArticleResponse[];
  meta: AdminListMeta;
};

export type AdminBlogArticlesResponse = {
  items: AdminBlogArticleResponse[];
  meta: AdminListMeta;
};

export type CreateBlogArticlePayload = {
  title: string;
  slug?: string;
  excerpt: string;
  category: BlogCategory;
  coverImageUrl?: string;
  content: Array<{
    heading?: string;
    body: string;
  }>;
  status?: BlogStatus;
  readingMinutes?: number;
  relatedSearchPrompt?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type AdminLeadsResponse = {
  items: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    message: string;
    source: string | null;
    status: LeadStatus;
    createdAt: string;
    updatedAt: string;
  }>;
  meta: AdminListMeta;
};

export type AdminScrapingSourcesResponse = {
  items: Array<{
    id: string;
    source: string;
    status: ScrapingSourceHealthStatus;
    lastRunAt: string | null;
    resultsCount: number;
    errorSummary: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  meta: AdminListMeta;
};

export type AdminListMeta = {
  page: number;
  limit: number;
  total: number;
};

export type AdminUserRoleUpdateResponse = {
  id: string;
  email: string;
  role: UserRole;
  updatedAt: string;
};

export type AdminCacheInvalidateResponse = {
  prefixes: string[];
  redisAvailable: boolean;
  matchedKeys: number;
  deletedKeys: number;
};

export type AdminConversationDetail = {
  id: string;
  title: string;
  status: ConversationStatus;
  lastSearchAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  searchState: {
    filters: SearchFilters;
    version: number;
    updatedAt: string;
  } | null;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: string;
  }>;
  lastSearchRun: {
    id: string;
    queryText: string;
    status: SearchRunStatus;
    resultCount: number;
    createdAt: string;
    filtersSnapshot: SearchFilters;
    sourcesUsed: string[];
  } | null;
  lastSearchResults: Array<{
    position: number;
    rankScore: number;
    rankReasons: string[];
    property: {
      id: string;
      title: string;
      source: string;
      sourceUrl: string;
      city: string | null;
      neighborhood: string | null;
      locationText: string | null;
      price: number | null;
      currency: CurrencyCode | null;
      scrapedAt: string;
    };
  }>;
};

export type AdminSearchRunDetail = {
  id: string;
  queryText: string;
  status: SearchRunStatus;
  resultCount: number;
  errorSummary: string | null;
  createdAt: string;
  filtersSnapshot: SearchFilters;
  sourcesUsed: string[];
  conversation: {
    id: string;
    title: string;
    user: {
      id: string;
      email: string;
      role: UserRole;
    };
  };
  results: Array<{
    position: number;
    rankScore: number;
    rankReasons: string[];
    property: {
      id: string;
      title: string;
      source: string;
      sourceUrl: string;
      city: string | null;
      neighborhood: string | null;
      locationText: string | null;
      price: number | null;
      currency: CurrencyCode | null;
      listingStatus: string;
      scrapedAt: string;
    };
  }>;
};
