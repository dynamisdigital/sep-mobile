import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  StepUpCompleteRequest,
  StepUpCompleteResponse,
  StepUpInitiateResponse,
} from '../api/api.models';
import { StepUpTokenStore } from './step-up-token.store';

const API_BASE_URL = environment.apiBaseUrl;

/**
 * Servico de step-up authentication mobile (follow-up 5F-FIX-05 da Sprint 5).
 *
 * Fluxo:
 * 1. {@link initiate} obtem `stepUpChallengeId` (TTL 5 min no servidor).
 * 2. Usuario apresenta codigo TOTP ou backup code.
 * 3. {@link complete} troca challenge+codigo por `stepUpToken` (uso unico) e
 *    persiste no {@link StepUpTokenStore}; o {@code stepUpInterceptor}
 *    consome o token na proxima chamada sensivel (ex.: PATCH senha).
 */
@Injectable({ providedIn: 'root' })
export class StepUpService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(StepUpTokenStore);

  async initiate(): Promise<StepUpInitiateResponse> {
    return firstValueFrom(
      this.http.post<StepUpInitiateResponse>(`${API_BASE_URL}/auth/step-up/initiate`, {}),
    );
  }

  /** Resolve o challenge + codigo; em sucesso armazena o stepUpToken pro proximo request. */
  async complete(request: StepUpCompleteRequest): Promise<StepUpCompleteResponse> {
    const response = await firstValueFrom(
      this.http.post<StepUpCompleteResponse>(`${API_BASE_URL}/auth/step-up/complete`, request),
    );
    this.store.set(response.stepUpToken);
    return response;
  }
}
