import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStub: { getAccessToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authStub = { getAccessToken: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('anexa Authorization quando ha token', async () => {
    authStub.getAccessToken.mockResolvedValue('jwt-token');
    const promise = new Promise<void>((resolve) => {
      http.get('/api/v1/auth/me').subscribe(() => resolve());
    });
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne('/api/v1/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
    await promise;
  });

  it('nao anexa Authorization sem token', async () => {
    authStub.getAccessToken.mockResolvedValue(null);
    const promise = new Promise<void>((resolve) => {
      http.get('/api/v1/auth/me').subscribe(() => resolve());
    });
    await Promise.resolve();
    await Promise.resolve();
    const req = httpMock.expectOne('/api/v1/auth/me');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
  });

  it('pula login - nao consulta token', async () => {
    const promise = new Promise<void>((resolve) => {
      http.post('/api/v1/auth/login', { username: 'a', password: '1' }).subscribe(() => resolve());
    });
    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(authStub.getAccessToken).not.toHaveBeenCalled();
    req.flush({});
    await promise;
  });

  it('pula POST /usuarios publico', async () => {
    const promise = new Promise<void>((resolve) => {
      http
        .post('http://localhost:8080/api/v1/usuarios', {
          username: 'a',
          password: '1',
          role: 'CLIENTE',
        })
        .subscribe(() => resolve());
    });
    const req = httpMock.expectOne('http://localhost:8080/api/v1/usuarios');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(authStub.getAccessToken).not.toHaveBeenCalled();
    req.flush({});
    await promise;
  });

  afterEach(() => httpMock.verify());
});
