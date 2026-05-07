import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  LoginRequest,
  TokenResponse,
  UsuarioCreateRequest,
  UsuarioResponse,
} from '../api/api.models';
import { TokenStorageService } from './token-storage.service';

const API_BASE_URL = 'http://localhost:8080/api/v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly currentUserState = signal<UsuarioResponse | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);

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
    const token = await this.tokenStorage.getToken();
    if (!token) {
      this.currentUserState.set(null);
      return null;
    }
    try {
      const usuario = await firstValueFrom(
        this.http.get<UsuarioResponse>(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.currentUserState.set(usuario);
      return usuario;
    } catch {
      await this.tokenStorage.clearToken();
      this.currentUserState.set(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    await this.tokenStorage.clearToken();
    this.currentUserState.set(null);
  }
}
