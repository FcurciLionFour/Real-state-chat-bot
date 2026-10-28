import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApiErrorPayload,
  AdminConversationsResponse,
  AdminMetricsResponse,
  AdminOverview,
  AdminPropertiesResponse,
  AdminConversationDetail,
  AdminCacheInvalidateResponse,
  AdminBlogArticleResponse,
  AdminBlogArticlesResponse,
  AdminSearchRunsResponse,
  AdminSearchRunDetail,
  AdminLeadsResponse,
  AdminUserRoleUpdateResponse,
  AdminUsersResponse,
  AdminScrapingSourcesResponse,
  AuthResponse,
  AuthUser,
  BlogArticleResponse,
  BlogArticlesResponse,
  BlogCategory,
  BlogStatus,
  ConversationDetail,
  ConversationListResponse,
  CreateBlogArticlePayload,
  CreateOwnerPropertyPayload,
  FavoriteListResponse,
  FavoriteMutationResponse,
  OwnerPropertiesResponse,
  OwnerProperty,
  OwnerPropertyStatus,
  ReviewOwnerPropertyPayload,
  SendMessageResponse,
  UpdateOwnerPropertyPayload,
  UserRole,
} from '../types/api.types';

type CreateConversationResponse = {
  id: string;
  title: string;
  status: string;
  searchState: unknown;
  createdAt: string;
  updatedAt: string;
};

type RuntimeConfigWindow = Window & {
  __REAL_STATE_APP_CONFIG__?: {
    apiBaseUrl?: string;
  };
};

const browserWindow = globalThis as unknown as RuntimeConfigWindow;

export const API_BASE_URL =
  browserWindow.__REAL_STATE_APP_CONFIG__?.apiBaseUrl?.trim() || 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class RealStateApiService {
  private readonly http = inject(HttpClient);

  register(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/register`, { email, password });
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/login`, { email, password });
  }

  refresh() {
    return this.http.post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, {});
  }

  logout() {
    return this.http.post<{ success: boolean }>(`${API_BASE_URL}/auth/logout`, {});
  }

  getMe() {
    return this.http.get<AuthUser>(`${API_BASE_URL}/auth/me`);
  }

  listConversations(page = 1, limit = 20) {
    return this.http.get<ConversationListResponse>(`${API_BASE_URL}/conversations`, {
      params: {
        page,
        limit,
      },
    });
  }

  createConversation(title?: string) {
    return this.http.post<CreateConversationResponse>(`${API_BASE_URL}/conversations`, title ? { title } : {});
  }

  getConversation(id: string) {
    return this.http.get<ConversationDetail>(`${API_BASE_URL}/conversations/${id}`);
  }

  sendMessage(conversationId: string, message: string) {
    return this.http.post<SendMessageResponse>(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      message,
    });
  }

  patchSearchState(
    conversationId: string,
    payload: {
      filterPatch?: Record<string, unknown>;
      filtersToUnset?: string[];
      shouldSearch?: boolean;
    },
  ) {
    return this.http.patch<SendMessageResponse>(`${API_BASE_URL}/conversations/${conversationId}/search-state`, payload);
  }

  listFavorites(page = 1, limit = 100) {
    return this.http.get<FavoriteListResponse>(`${API_BASE_URL}/favorites`, {
      params: {
        page,
        limit,
      },
    });
  }

  addFavorite(propertyId: string) {
    return this.http.post<FavoriteMutationResponse>(`${API_BASE_URL}/favorites`, { propertyId });
  }

  removeFavorite(propertyId: string) {
    return this.http.delete<{ success: boolean }>(`${API_BASE_URL}/favorites/${propertyId}`);
  }

  listBlogArticles(page = 1, limit = 20, category?: BlogCategory, query?: string) {
    return this.http.get<BlogArticlesResponse>(`${API_BASE_URL}/blog`, {
      params: this.cleanParams({ page, limit, category, query }),
    });
  }

  getBlogArticle(slug: string) {
    return this.http.get<BlogArticleResponse>(`${API_BASE_URL}/blog/${slug}`);
  }

  getAdminOverview() {
    return this.http.get<AdminOverview>(`${API_BASE_URL}/admin/overview`);
  }

  getAdminMetrics() {
    return this.http.get<AdminMetricsResponse>(`${API_BASE_URL}/admin/metrics`);
  }

  listAdminUsers(page = 1, limit = 20) {
    return this.http.get<AdminUsersResponse>(`${API_BASE_URL}/admin/users`, {
      params: { page, limit },
    });
  }

  updateAdminUserRole(userId: string, role: UserRole) {
    return this.http.patch<AdminUserRoleUpdateResponse>(`${API_BASE_URL}/admin/users/${userId}/role`, { role });
  }

  listAdminConversations(page = 1, limit = 20) {
    return this.http.get<AdminConversationsResponse>(`${API_BASE_URL}/admin/conversations`, {
      params: { page, limit },
    });
  }

  getAdminConversationDetail(conversationId: string) {
    return this.http.get<AdminConversationDetail>(`${API_BASE_URL}/admin/conversations/${conversationId}`);
  }

  listAdminSearchRuns(page = 1, limit = 20) {
    return this.http.get<AdminSearchRunsResponse>(`${API_BASE_URL}/admin/search-runs`, {
      params: { page, limit },
    });
  }

  getAdminSearchRunDetail(searchRunId: string) {
    return this.http.get<AdminSearchRunDetail>(`${API_BASE_URL}/admin/search-runs/${searchRunId}`);
  }

  listAdminProperties(page = 1, limit = 20) {
    return this.http.get<AdminPropertiesResponse>(`${API_BASE_URL}/admin/properties`, {
      params: { page, limit },
    });
  }

  listAdminLeads(page = 1, limit = 20) {
    return this.http.get<AdminLeadsResponse>(`${API_BASE_URL}/admin/leads`, {
      params: { page, limit },
    });
  }

  listAdminScrapingSources(page = 1, limit = 20) {
    return this.http.get<AdminScrapingSourcesResponse>(`${API_BASE_URL}/admin/scraping-sources`, {
      params: { page, limit },
    });
  }

  listAdminBlogArticles(page = 1, limit = 20, status?: BlogStatus, category?: BlogCategory, query?: string) {
    return this.http.get<AdminBlogArticlesResponse>(`${API_BASE_URL}/admin/blog`, {
      params: this.cleanParams({ page, limit, status, category, query }),
    });
  }

  createAdminBlogArticle(payload: CreateBlogArticlePayload) {
    return this.http.post<AdminBlogArticleResponse>(`${API_BASE_URL}/admin/blog`, payload);
  }

  updateAdminBlogArticle(articleId: string, payload: Partial<CreateBlogArticlePayload>) {
    return this.http.patch<AdminBlogArticleResponse>(`${API_BASE_URL}/admin/blog/${articleId}`, payload);
  }

  publishAdminBlogArticle(articleId: string) {
    return this.http.post<AdminBlogArticleResponse>(`${API_BASE_URL}/admin/blog/${articleId}/publish`, {});
  }

  unpublishAdminBlogArticle(articleId: string) {
    return this.http.post<AdminBlogArticleResponse>(`${API_BASE_URL}/admin/blog/${articleId}/unpublish`, {});
  }

  archiveAdminBlogArticle(articleId: string) {
    return this.http.post<AdminBlogArticleResponse>(`${API_BASE_URL}/admin/blog/${articleId}/archive`, {});
  }

  deleteAdminBlogArticle(articleId: string) {
    return this.http.delete<{ success: boolean }>(`${API_BASE_URL}/admin/blog/${articleId}`);
  }

  invalidateAdminOperationalCache() {
    return this.http.post<AdminCacheInvalidateResponse>(`${API_BASE_URL}/admin/cache/invalidate`, {});
  }

  createOwnerPropertyDraft(payload: CreateOwnerPropertyPayload) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/owner/properties`, payload);
  }

  listMyOwnerProperties(page = 1, limit = 20) {
    return this.http.get<OwnerPropertiesResponse>(`${API_BASE_URL}/owner/properties/my`, {
      params: { page, limit },
    });
  }

  getMyOwnerProperty(id: string) {
    return this.http.get<OwnerProperty>(`${API_BASE_URL}/owner/properties/my/${id}`);
  }

  updateMyOwnerProperty(id: string, payload: UpdateOwnerPropertyPayload) {
    return this.http.patch<OwnerProperty>(`${API_BASE_URL}/owner/properties/my/${id}`, payload);
  }

  submitMyOwnerProperty(id: string) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/owner/properties/my/${id}/submit`, {});
  }

  unpublishMyOwnerProperty(id: string) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/owner/properties/my/${id}/unpublish`, {});
  }

  deleteMyOwnerDraft(id: string) {
    return this.http.delete<{ success: boolean }>(`${API_BASE_URL}/owner/properties/my/${id}`);
  }

  listAdminOwnerSubmittedProperties(page = 1, limit = 20, status?: OwnerPropertyStatus) {
    return this.http.get<OwnerPropertiesResponse>(`${API_BASE_URL}/admin/properties/owner-submitted`, {
      params: this.cleanParams({ page, limit, status }),
    });
  }

  listAdminPendingOwnerSubmittedProperties(page = 1, limit = 20) {
    return this.http.get<OwnerPropertiesResponse>(`${API_BASE_URL}/admin/properties/owner-submitted/pending`, {
      params: { page, limit },
    });
  }

  getAdminOwnerSubmittedProperty(id: string) {
    return this.http.get<OwnerProperty>(`${API_BASE_URL}/admin/properties/owner-submitted/${id}`);
  }

  approveAdminOwnerSubmittedProperty(id: string) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/admin/properties/owner-submitted/${id}/approve`, {});
  }

  rejectAdminOwnerSubmittedProperty(id: string, payload: ReviewOwnerPropertyPayload) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/admin/properties/owner-submitted/${id}/reject`, payload);
  }

  updateAdminOwnerSubmittedProperty(id: string, payload: UpdateOwnerPropertyPayload) {
    return this.http.patch<OwnerProperty>(`${API_BASE_URL}/admin/properties/owner-submitted/${id}`, payload);
  }

  unpublishAdminOwnerSubmittedProperty(id: string) {
    return this.http.post<OwnerProperty>(`${API_BASE_URL}/admin/properties/owner-submitted/${id}/unpublish`, {});
  }

  private cleanParams(values: Record<string, string | number | null | undefined>) {
    return Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim().length > 0)
        .map(([key, value]) => [key, String(value)]),
    );
  }
}

export function readApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.') {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el backend. Revisa que el servidor este levantado e intenta de nuevo.';
    }

    if (error.status >= 500) {
      return 'El servidor tuvo un problema procesando la busqueda. Intenta de nuevo en unos segundos.';
    }

    const payload = error.error as ApiErrorPayload | null;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(', ');
    }

    if (typeof payload?.message === 'string') {
      return payload.message;
    }

    if (typeof error.message === 'string' && error.message.length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
