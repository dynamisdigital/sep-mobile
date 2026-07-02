import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StepUpTokenStore } from '../auth/step-up-token.store';
import { stepUpInterceptor } from './step-up.interceptor';

describe('stepUpInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: StepUpTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([stepUpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(StepUpTokenStore);
  });

  it('anexa X-Step-Up-Token em PATCH /usuarios/:id/senha e consome o store', async () => {
    store.set('step-up-abc');
    const url = 'http://localhost:8080/api/v1/usuarios/1f0/senha';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('X-Step-Up-Token')).toBe('step-up-abc');
    expect(store.hasToken()).toBe(false);
    req.flush({});
    await promise;
  });

  it('nao anexa em outras rotas mesmo com token presente', async () => {
    store.set('step-up-abc');
    const url = 'http://localhost:8080/api/v1/auth/me';
    const promise = new Promise<void>((resolve) => {
      http.get(url).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(store.hasToken()).toBe(true);
    req.flush({});
    await promise;
  });

  it('anexa X-Step-Up-Token em PATCH /contratos/:id/aceite e consome o store', async () => {
    store.set('step-up-aceite');
    const url = 'http://localhost:8080/api/v1/contratos/1f1/aceite';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('X-Step-Up-Token')).toBe('step-up-aceite');
    expect(store.hasToken()).toBe(false);
    req.flush({});
    await promise;
  });

  it('nao anexa em GET de contrato mesmo com token presente', async () => {
    store.set('step-up-aceite');
    const url = 'http://localhost:8080/api/v1/contratos/1f1';
    const promise = new Promise<void>((resolve) => {
      http.get(url).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(store.hasToken()).toBe(true);
    req.flush({});
    await promise;
  });

  it('sem token no store, passa adiante sem header', async () => {
    const url = 'http://localhost:8080/api/v1/usuarios/1f0/senha';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    req.flush({});
    await promise;
  });

  it('anexa X-Step-Up-Token em PATCH /cobranca/renegociacoes/:id/aceite e consome o store', async () => {
    store.set('step-up-reneg');
    const url = 'http://localhost:8080/api/v1/cobranca/renegociacoes/1f2/aceite';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('X-Step-Up-Token')).toBe('step-up-reneg');
    expect(store.hasToken()).toBe(false);
    req.flush({});
    await promise;
  });

  it('nao anexa em PATCH de recusa de renegociacao nem consome o token', async () => {
    store.set('step-up-reneg');
    const url = 'http://localhost:8080/api/v1/cobranca/renegociacoes/1f2/recusa';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(store.hasToken()).toBe(true);
    req.flush({});
    await promise;
  });

  it('nao anexa em GET de renegociacao ativa mesmo com token presente', async () => {
    store.set('step-up-reneg');
    const url = 'http://localhost:8080/api/v1/cobranca/parcelas/1f3/renegociacao-ativa';
    const promise = new Promise<void>((resolve) => {
      http.get(url).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(store.hasToken()).toBe(true);
    req.flush({});
    await promise;
  });

  it('nao anexa em URL parecida (sufixo extra apos /aceite)', async () => {
    store.set('step-up-reneg');
    const url = 'http://localhost:8080/api/v1/cobranca/renegociacoes/1f2/aceite/extra';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(store.hasToken()).toBe(true);
    req.flush({});
    await promise;
  });

  it('sem token, PATCH de aceite de renegociacao segue sem header (backend responde 403)', async () => {
    const url = 'http://localhost:8080/api/v1/cobranca/renegociacoes/1f2/aceite';
    const promise = new Promise<void>((resolve) => {
      http.patch(url, {}).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    req.flush({});
    await promise;
  });

  afterEach(() => httpMock.verify());
});
