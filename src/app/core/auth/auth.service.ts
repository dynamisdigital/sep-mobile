import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LogoutRequest,
  RefreshTokenRequest,
  TokenResponse,
  UsuarioCreateRequest,
  UsuarioResponse,
} from '../api/api.models';
import { TokenStorageService } from './token-storage.service';

const API_BASE_URL = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly currentUserState = signal<UsuarioResponse | null>(null);
  private readonly loadingUserState = signal(false);
  private readonly pendingMfaChallengeState = signal<string | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly loadingUser = this.loadingUserState.asReadonly();
  readonly pendingMfaChallenge = this.pendingMfaChallengeState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);

  async getAccessToken(): Promise<string | null> {
    return this.tokenStorage.getToken();
  }

  async getRefreshToken(): Promise<string | null> {
    return this.tokenStorage.getRefreshToken();
  }

  async hasToken(): Promise<boolean> {
    return (await this.getAccessToken()) !== null;
  }

  async hydratePendingMfa(): Promise<void> {
    const challenge = await this.tokenStorage.getPendingMfaChallenge();
    this.pendingMfaChallengeState.set(challenge);
  }

  async login(request: LoginRequest): Promise<TokenResponse> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${API_BASE_URL}/auth/login`, request),
    );
    await this.handleTokenResponse(response);
    return response;
  }

  async applyMfaVerifyResponse(response: TokenResponse): Promise<void> {
    await this.handleTokenResponse(response);
  }

  async register(request: UsuarioCreateRequest): Promise<UsuarioResponse> {
    return firstValueFrom(this.http.post<UsuarioResponse>(`${API_BASE_URL}/usuarios`, request));
  }

  async loadCurrentUser(): Promise<UsuarioResponse | null> {
    if (!(await this.hasToken())) {
      this.currentUserState.set(null);
      return null;
    }

    this.loadingUserState.set(true);
    try {
      const usuario = await firstValueFrom(
        this.http.get<UsuarioResponse>(`${API_BASE_URL}/auth/me`),
      );
      this.currentUserState.set(usuario);
      return usuario;
    } catch {
      await this.clearSession();
      return null;
    } finally {
      this.loadingUserState.set(false);
    }
  }

  async refresh(): Promise<TokenResponse | null> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    const payload: RefreshTokenRequest = { refreshToken };
    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, payload),
      );
      await this.handleTokenResponse(response);
      return response;
    } catch {
      await this.clearSession();
      return null;
    }
  }

  async clearSession(): Promise<void> {
    await this.tokenStorage.clearAll();
    this.currentUserState.set(null);
    this.pendingMfaChallengeState.set(null);
  }

  async logout(): Promise<void> {
    const refreshToken = await this.getRefreshToken();
    if (refreshToken) {
      const payload: LogoutRequest = { refreshToken };
      try {
        await firstValueFrom(this.http.post(`${API_BASE_URL}/auth/logout`, payload));
      } catch {
        // logout idempotente: limpar sessao mesmo se chamada falhar.
      }
    }
    await this.clearSession();
  }

  private async handleTokenResponse(response: TokenResponse): Promise<void> {
    if (response.mfaRequired && response.mfaChallengeId) {
      await this.tokenStorage.setPendingMfaChallenge(response.mfaChallengeId);
      this.pendingMfaChallengeState.set(response.mfaChallengeId);
      return;
    }
    await this.tokenStorage.clearPendingMfaChallenge();
    this.pendingMfaChallengeState.set(null);
    if (response.accessToken) {
      await this.tokenStorage.setToken(response.accessToken);
    }
    if (response.refreshToken) {
      await this.tokenStorage.setRefreshToken(response.refreshToken);
    }
    if (response.usuario) {
      this.currentUserState.set(response.usuario);
    }
  }
}
