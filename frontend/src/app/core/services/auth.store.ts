import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, AuthUser } from '../types/api.types';
import { API_BASE_URL, RealStateApiService, readApiErrorMessage } from './real-state-api.service';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  ready: boolean;
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(RealStateApiService);
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly router = inject(Router);
  private readonly state = signal<AuthState>(this.readInitialState());
  private refreshInFlight: Promise<boolean> | null = null;

  readonly user = computed(() => this.state().user);
  readonly accessToken = computed(() => this.state().accessToken);
  readonly ready = computed(() => this.state().ready);
  readonly isAuthenticated = computed(() => Boolean(this.state().accessToken && this.state().user));

  async bootstrap() {
    if (this.state().ready) {
      return;
    }

    if (this.state().accessToken) {
      try {
        const user = await firstValueFrom(this.api.getMe());
        this.patchState({ user, ready: true });
        this.persistState();
        return;
      } catch {
        await this.refreshAccessToken();
        return;
      }
    }

    await this.refreshAccessToken();
  }

  async register(email: string, password: string) {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(
        `${API_BASE_URL}/auth/register`,
        { email, password },
        { withCredentials: true },
      ),
    );

    this.applyAuthResponse(response);
  }

  async login(email: string, password: string) {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(
        `${API_BASE_URL}/auth/login`,
        { email, password },
        { withCredentials: true },
      ),
    );

    this.applyAuthResponse(response);
  }

  async logout() {
    try {
      await firstValueFrom(
        this.http.post<{ success: boolean }>(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true }),
      );
    } finally {
      this.clearSession();
      await this.router.navigateByUrl('/login');
    }
  }

  async refreshAccessToken() {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.performRefresh();

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  readError(error: unknown, fallback?: string) {
    return readApiErrorMessage(error, fallback);
  }

  private async performRefresh() {
    try {
      const refreshed = await firstValueFrom(
        this.http.post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true }),
      );
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${API_BASE_URL}/auth/me`, {
          withCredentials: true,
          headers: new HttpHeaders({
            Authorization: `Bearer ${refreshed.accessToken}`,
          }),
        }),
      );

      this.patchState({
        accessToken: refreshed.accessToken,
        user,
        ready: true,
      });
      this.persistState();

      return true;
    } catch {
      this.clearSession({ keepReady: true });
      return false;
    }
  }

  private applyAuthResponse(response: AuthResponse) {
    this.patchState({
      user: response.user,
      accessToken: response.accessToken,
      ready: true,
    });
    this.persistState();
  }

  private patchState(patch: Partial<AuthState>) {
    this.state.update((current) => ({
      ...current,
      ...patch,
    }));
  }

  private clearSession(options?: { keepReady?: boolean }) {
    this.state.set({
      user: null,
      accessToken: null,
      ready: options?.keepReady ?? true,
    });
  }

  private persistState() {
    // Session state stays in memory; refresh token remains in HttpOnly cookie.
  }

  private readInitialState(): AuthState {
    return {
      user: null,
      accessToken: null,
      ready: false,
    };
  }
}
