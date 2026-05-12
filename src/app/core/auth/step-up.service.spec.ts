import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { StepUpService } from './step-up.service';
import { StepUpTokenStore } from './step-up-token.store';

describe('StepUpService', () => {
  let service: StepUpService;
  let store: StepUpTokenStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    service = TestBed.inject(StepUpService);
    store = TestBed.inject(StepUpTokenStore);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient); // sanity
  });

  it('initiate devolve stepUpChallengeId', async () => {
    const promise = service.initiate();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/step-up/initiate`);
    expect(req.request.method).toBe('POST');
    req.flush({ stepUpChallengeId: 'chal-1' });
    expect((await promise).stepUpChallengeId).toBe('chal-1');
  });

  it('complete armazena stepUpToken no store', async () => {
    const promise = service.complete({ stepUpChallengeId: 'chal-1', codigo: '123456' });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/step-up/complete`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stepUpChallengeId: 'chal-1', codigo: '123456' });
    req.flush({ stepUpToken: 'step-up-xyz' });
    await promise;
    expect(store.hasToken()).toBe(true);
    expect(store.consume()).toBe('step-up-xyz');
  });

  afterEach(() => httpMock.verify());
});
