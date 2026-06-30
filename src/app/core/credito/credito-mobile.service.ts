import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CriarPropostaRequest,
  IniciarConsentimentoOpenFinanceRequest,
  IniciarConsentimentoOpenFinanceResponse,
  OpenFinanceStatusResponse,
  PageResponse,
  PropostaResponse,
  StatusProposta,
} from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;
const PROPOSTAS_URL = `${API_BASE_URL}/credito/propostas`;

export interface ListarPropostasParams {
  status?: StatusProposta;
  page?: number;
  size?: number;
}

// Orquestra apenas o transporte HTTP de credito/Open Finance. Score, parecer, elegibilidade e
// decisoes de credito pertencem ao backend; o service propaga os DTOs sem interpreta-los e nunca
// persiste respostas. O CLIENTE lista apenas as proprias propostas: nunca envia `tomadorId`
// (ownership e aplicado no backend). Auth e injetado pelo authInterceptor.
@Injectable({ providedIn: 'root' })
export class CreditoMobileService {
  private readonly http = inject(HttpClient);

  listarPropostas(params: ListarPropostasParams = {}): Promise<PageResponse<PropostaResponse>> {
    return firstValueFrom(
      this.http.get<PageResponse<PropostaResponse>>(PROPOSTAS_URL, {
        params: toHttpParams(params),
      }),
    );
  }

  consultarProposta(id: string): Promise<PropostaResponse> {
    return firstValueFrom(this.http.get<PropostaResponse>(`${PROPOSTAS_URL}/${id}`));
  }

  criarProposta(request: CriarPropostaRequest): Promise<PropostaResponse> {
    return firstValueFrom(this.http.post<PropostaResponse>(PROPOSTAS_URL, request));
  }

  iniciarConsentimentoOpenFinance(
    propostaId: string,
    request: IniciarConsentimentoOpenFinanceRequest,
  ): Promise<IniciarConsentimentoOpenFinanceResponse> {
    return firstValueFrom(
      this.http.post<IniciarConsentimentoOpenFinanceResponse>(
        `${PROPOSTAS_URL}/${propostaId}/open-finance/consentimento`,
        request,
      ),
    );
  }

  consultarOpenFinance(propostaId: string): Promise<OpenFinanceStatusResponse> {
    return firstValueFrom(
      this.http.get<OpenFinanceStatusResponse>(`${PROPOSTAS_URL}/${propostaId}/open-finance`),
    );
  }
}

// Monta os query params omitindo valores ausentes. `page` e `size` aceitam 0 como valor valido,
// entao o filtro descarta apenas `undefined`/`null` — nunca o zero.
function toHttpParams(params: ListarPropostasParams): HttpParams {
  let httpParams = new HttpParams();
  if (params.status != null) {
    httpParams = httpParams.set('status', params.status);
  }
  if (params.page != null) {
    httpParams = httpParams.set('page', params.page);
  }
  if (params.size != null) {
    httpParams = httpParams.set('size', params.size);
  }
  return httpParams;
}
