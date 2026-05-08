import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  LoginRequest,
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

  readonly currentUser = this.currentUserState.asReadonly();
  readonly loadingUser = this.loadingUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);

  async getAccessToken(): Promise<string | null> {
    return this.tokenStorage.getToken();
  }

  async hasToken(): Promise<boolean> {
    return (await this.getAccessToken()) !== null;
  }

  async login(request: LoginRequest): Promise<TokenResponse> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${API_BASE_URL}/auth/login`, request),
    );
    await this.tokenStorage.setToken(response.accessToken);
    this.currentUserState.set(response.usuario);
    return response;
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

  async clearSession(): Promise<void> {
    await this.tokenStorage.clearToken();
    this.currentUserState.set(null);
  }

  async logout(): Promise<void> {
    await this.clearSession();
  }
}
