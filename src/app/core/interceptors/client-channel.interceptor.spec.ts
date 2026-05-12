import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { clientChannelInterceptor } from './client-channel.interceptor';

describe('clientChannelInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([clientChannelInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('anexa X-Client-Channel=MOBILE em chamadas para a API', async () => {
    const url = `${environment.apiBaseUrl}/auth/me`;
    const promise = new Promise<void>((resolve) => {
      http.get(url).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('X-Client-Channel')).toBe('MOBILE');
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
    await promise;
  });

  it('ignora URLs fora da API (CDNs, analytics)', async () => {
    const url = 'https://outro-host.example.com/coisa';
    const promise = new Promise<void>((resolve) => {
      http.get(url).subscribe(() => resolve());
    });
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('X-Client-Channel')).toBe(false);
    req.flush({});
    await promise;
  });

  afterEach(() => httpMock.verify());
});
