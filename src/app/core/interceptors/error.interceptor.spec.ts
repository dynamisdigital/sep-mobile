import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStub: { clearSession: ReturnType<typeof vi.fn> };
  let routerStub: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authStub = { clearSession: vi.fn().mockResolvedValue(undefined) };
    routerStub = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('401 em rota protegida limpa sessao e redireciona', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.get('/api/v1/auth/me').subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({ message: 'unauth' }, { status: 401, statusText: 'Unauthorized' });
    await errorPromise;
    await Promise.resolve();
    expect(authStub.clearSession).toHaveBeenCalled();
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/session-expired');
  });

  it('401 em /auth/login nao redireciona', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.post('/api/v1/auth/login', {}).subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ message: 'invalid' }, { status: 401, statusText: 'Unauthorized' });
    await errorPromise;
    expect(authStub.clearSession).not.toHaveBeenCalled();
    expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
  });

  it('403 redireciona para /access-denied', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.get('/api/v1/usuarios').subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/usuarios');
    req.flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    await errorPromise;
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/access-denied');
    expect(authStub.clearSession).not.toHaveBeenCalled();
  });

  // 423 = conta bloqueada. O ramo existe desde a Sprint 5 e ficou sem teste ate a M-Sprint 17.
  it('423 limpa sessao e redireciona para /account-locked', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.get('/api/v1/auth/me').subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({ message: 'Conta bloqueada' }, { status: 423, statusText: 'Locked' });
    await errorPromise;
    await Promise.resolve();
    expect(authStub.clearSession).toHaveBeenCalled();
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/account-locked');
  });

  // O 423 chega tambem de /auth/login, que e a origem real da jornada: ao contrario do 401, o
  // interceptor NAO abre excecao para a rota de login. Sem este teste, mover a checagem de 423 para
  // dentro do `!isLogoutOrLogin` passaria despercebido e a jornada inteira morreria.
  it('423 em /auth/login tambem redireciona', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.post('/api/v1/auth/login', {}).subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ message: 'Conta bloqueada' }, { status: 423, statusText: 'Locked' });
    await errorPromise;
    await Promise.resolve();
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/account-locked');
  });

  // Teste negativo: rate limit nao e conta bloqueada. O backend passou o limite de login para 10
  // justamente para o 429 nao mascarar o 423 (Sprint 33); tratar os dois igual aqui desfaria isso e
  // mandaria para /account-locked quem so precisa esperar alguns segundos.
  it('429 nao redireciona nem apaga a sessao', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.post('/api/v1/auth/login', {}).subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ message: 'Muitas tentativas' }, { status: 429, statusText: 'Too Many Requests' });
    await errorPromise;
    await Promise.resolve();
    expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
    expect(authStub.clearSession).not.toHaveBeenCalled();
  });

  it('outros erros nao redirecionam', async () => {
    const errorPromise = new Promise<HttpErrorResponse>((resolve) => {
      http.get('/api/v1/auth/me').subscribe({
        next: () => undefined,
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush(
      { message: 'Erro interno.', traceId: 'trace-mobile-1' },
      { status: 500, statusText: 'Server Error' },
    );
    const error = await errorPromise;
    expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
    expect(authStub.clearSession).not.toHaveBeenCalled();
    expect(error.error.message).toBe('Erro interno. Código de suporte: trace-mobile-1.');
  });

  it('4xx preserva mensagem sem codigo de suporte', async () => {
    const errorPromise = new Promise<HttpErrorResponse>((resolve) => {
      http.post('/api/v1/propostas', {}).subscribe({
        next: () => undefined,
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/propostas');
    req.flush(
      { message: 'Proposta invalida.', traceId: 'trace-mobile-2' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const error = await errorPromise;

    expect(error.error.message).toBe('Proposta invalida.');
  });

  afterEach(() => httpMock.verify());
});
