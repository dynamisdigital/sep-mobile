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
};

class TokenStorageStub {
  private value: string | null = null;
  getToken = vi.fn(async () => this.value);
  setToken = vi.fn(async (token: string) => {
    this.value = token;
  });
  clearToken = vi.fn(async () => {
    this.value = null;
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
      expiresIn: 3600,
      usuario,
    };

    const promise = service.login({ username: usuario.username, password: '123456' });

    const req = httpMock.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(tokenResponse);

    await promise;

    expect(storage.setToken).toHaveBeenCalledWith('jwt-1');
    expect(service.currentUser()).toEqual(usuario);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('register dispara POST /usuarios', async () => {
    const promise = service.register({
      username: 'novo@empresa.com',
      password: '123456',
      role: 'CLIENTE',
    });
    const req = httpMock.expectOne(`${API}/usuarios`);
    expect(req.request.method).toBe('POST');
    req.flush(usuario);
    expect(await promise).toEqual(usuario);
  });

  it('logout limpa token e currentUser', async () => {
    await storage.setToken('jwt-2');
    await service.logout();
    expect(storage.clearToken).toHaveBeenCalled();
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
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-3');
    req.flush(usuario);
    expect(await promise).toEqual(usuario);
    expect(service.currentUser()).toEqual(usuario);
  });

  it('loadCurrentUser com falha limpa sessao', async () => {
    await storage.setToken('jwt-bad');
    const promise = service.loadCurrentUser();
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne(`${API}/auth/me`);
    req.flush({ message: 'unauth' }, { status: 401, statusText: 'Unauthorized' });
    expect(await promise).toBeNull();
    expect(storage.clearToken).toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });

  afterEach(() => httpMock.verify());
});
