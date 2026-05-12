import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TokenResponse, TotpVerifyRequest } from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;

/**
 * M-Sprint 5: chamadas MFA TOTP / verify do mobile. Setup TOTP no mobile fica
 * pendente da fase Mobile 2+ (provavel via web). {@link verify} conclui login
 * apos {@code /auth/login} retornar {@code mfaRequired=true}.
 */
@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);

  async verify(payload: TotpVerifyRequest): Promise<TokenResponse> {
    return firstValueFrom(
      this.http.post<TokenResponse>(`${API_BASE_URL}/auth/totp/verify`, payload),
    );
  }
}
