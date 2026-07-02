import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AgendaPagamentoResponse,
  RecebimentoTomadorResponse,
  ValorAtualizadoParcelaResponse,
} from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;
const COBRANCA_URL = `${API_BASE_URL}/cobranca`;

// Orquestra apenas o transporte HTTP de cobranca (agenda/parcela — Sprints 12-13). Ownership,
// calculo de saldo/juros/mora/multa, dias de atraso, status e transicoes pertencem ao backend;
// o service propaga os DTOs sem interpreta-los e nunca persiste a resposta. O CLIENTE consulta
// apenas as proprias agendas/parcelas (ownership aplicado no backend); erros 403/404 sobem para
// tratamento na UI e nunca sao convertidos em sucesso ou lista vazia. Auth pelo authInterceptor.
//
// Endpoints internos FINANCEIRO/ADMIN — recebimento manual, listagem de recebimentos,
// inadimplencia, contato e proposta de renegociacao — NAO sao expostos aqui.
@Injectable({ providedIn: 'root' })
export class CobrancaMobileService {
  private readonly http = inject(HttpClient);

  consultarAgenda(contratoId: string): Promise<AgendaPagamentoResponse> {
    return firstValueFrom(
      this.http.get<AgendaPagamentoResponse>(`${COBRANCA_URL}/contratos/${contratoId}/agenda`),
    );
  }

  consultarParcela(parcelaId: string): Promise<ValorAtualizadoParcelaResponse> {
    return firstValueFrom(
      this.http.get<ValorAtualizadoParcelaResponse>(`${COBRANCA_URL}/parcelas/${parcelaId}`),
    );
  }

  // Historico owner-scoped do tomador (Sprint 23 backend — B1). NAO usa o GET /recebimentos
  // interno de FINANCEIRO/ADMIN; a ordenacao (DESC) e a ownership vem do backend.
  consultarRecebimentos(parcelaId: string): Promise<RecebimentoTomadorResponse[]> {
    return firstValueFrom(
      this.http.get<RecebimentoTomadorResponse[]>(
        `${COBRANCA_URL}/parcelas/${parcelaId}/recebimentos`,
      ),
    );
  }
}
