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

  it('outros erros nao redirecionam', async () => {
    const errorPromise = new Promise<unknown>((resolve) => {
      http.get('/api/v1/auth/me').subscribe({
        next: () => resolve('ok'),
        error: (err) => resolve(err),
      });
    });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await errorPromise;
    expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
    expect(authStub.clearSession).not.toHaveBeenCalled();
  });

  afterEach(() => httpMock.verify());
});
