import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenResponse, UsuarioResponse } from '../api/api.models';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const API = 'http://localhost:8080/api/v1';

const usuario: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

class TokenStorageStub {
  private access: string | null = null;
  private refresh: string | null = null;
  private trust = false;
  private challenge: string | null = null;

  getToken = vi.fn(async () => this.access);
  setToken = vi.fn(async (token: string) => {
    this.access = token;
  });
  clearToken = vi.fn(async () => {
    this.access = null;
  });

  getRefreshToken = vi.fn(async () => this.refresh);
  setRefreshToken = vi.fn(async (token: string) => {
    this.refresh = token;
  });
  clearRefreshToken = vi.fn(async () => {
    this.refresh = null;
  });

  getTrustDevice = vi.fn(async () => this.trust);
  setTrustDevice = vi.fn(async (value: boolean) => {
    this.trust = value;
  });
  clearTrustDevice = vi.fn(async () => {
    this.trust = false;
  });

  getPendingMfaChallenge = vi.fn(async () => this.challenge);
  setPendingMfaChallenge = vi.fn(async (id: string) => {
    this.challenge = id;
  });
  clearPendingMfaChallenge = vi.fn(async () => {
    this.challenge = null;
  });

  clearAll = vi.fn(async () => {
    this.access = null;
    this.refresh = null;
    this.challenge = null;
  });
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let storage: TokenStorageStub;

  beforeEach(() => {
    TestBed.resetTestingModule();
    storage = new TokenStorageStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TokenStorageService, useValue: storage },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('login salva token e atualiza currentUser', async () => {
    const tokenResponse: TokenResponse = {
      accessToken: 'jwt-1',
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: 'refresh-1',
      usuario,
      mfaRequired: false,
      mfaChallengeId: null,
    };

    const promise = service.login({
      username: usuario.username,
      password: 'senha-passphrase-segura',
    });

    const req = httpMock.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(tokenResponse);

    await promise;

    expect(storage.setToken).toHaveBeenCalledWith('jwt-1');
    expect(storage.setRefreshToken).toHaveBeenCalledWith('refresh-1');
    expect(service.currentUser()).toEqual(usuario);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('login com MFA pendente persiste challengeId', async () => {
    const tokenResponse: TokenResponse = {
      accessToken: null,
      tokenType: 'Bearer',
      expiresIn: 0,
      refreshToken: null,
      usuario: null,
      mfaRequired: true,
      mfaChallengeId: '11111111-1111-1111-1111-111111111111',
    };

    const promise = service.login({ username: usuario.username, password: 'qualquer' });
    const req = httpMock.expectOne(`${API}/auth/login`);
    req.flush(tokenResponse);
    await promise;

    expect(storage.setPendingMfaChallenge).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(service.pendingMfaChallenge()).toBe('11111111-1111-1111-1111-111111111111');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('login invalido nao deixa usuario autenticado', async () => {
    const promise = service.login({ username: usuario.username, password: 'wrong1' });
    const req = httpMock.expectOne(`${API}/auth/login`);
    req.flush({ message: 'invalid' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toBeDefined();
    expect(storage.setToken).not.toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('register dispara POST /usuarios', async () => {
    const promise = service.register({
      username: 'novo@empresa.com',
      password: 'senha-passphrase-segura',
      role: 'CLIENTE',
    });
    const req = httpMock.expectOne(`${API}/usuarios`);
    expect(req.request.method).toBe('POST');
    req.flush(usuario);
    expect(await promise).toEqual(usuario);
  });

  it('clearSession remove tokens e currentUser', async () => {
    await storage.setToken('jwt-x');
    await service.clearSession();
    expect(storage.clearAll).toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });

  it('logout chama /auth/logout quando ha refresh + limpa sessao', async () => {
    await storage.setToken('jwt-2');
    await storage.setRefreshToken('refresh-2');
    const promise = service.logout();
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(`${API}/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'refresh-2' });
    req.flush(null);
    await promise;
    expect(storage.clearAll).toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });

  it('loadCurrentUser sem token nao chama API', async () => {
    const result = await service.loadCurrentUser();
    expect(result).toBeNull();
    httpMock.expectNone(`${API}/auth/me`);
  });

  it('loadCurrentUser com token valido popula currentUser', async () => {
    await storage.setToken('jwt-3');
    const promise = service.loadCurrentUser();
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(`${API}/auth/me`);
    req.flush(usuario);
    expect(await promise).toEqual(usuario);
    expect(service.currentUser()).toEqual(usuario);
  });

  it('loadCurrentUser com falha em /auth/me chama clearAll', async () => {
    await storage.setToken('jwt-bad');
    const promise = service.loadCurrentUser();
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(`${API}/auth/me`);
    req.flush({ message: 'unauth' }, { status: 401, statusText: 'Unauthorized' });
    expect(await promise).toBeNull();
    expect(storage.clearAll).toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });

  it('hasToken reflete estado do TokenStorage', async () => {
    expect(await service.hasToken()).toBe(false);
    await storage.setToken('jwt-y');
    expect(await service.hasToken()).toBe(true);
  });

  afterEach(() => httpMock.verify());
});
