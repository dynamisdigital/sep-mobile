import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PixDesembolsoTomadorResponse,
  PixOperacaoCredoraResponse,
  PixPagamentoParcelaResponse,
} from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;
const PIX_URL = `${API_BASE_URL}/pix`;
const CREDORES_URL = `${API_BASE_URL}/credores`;

// Transporte HTTP das leituras Pix owner-scoped (M-Sprint 11 / backend Sprint 26 Gates P1-P3).
// Somente GET read-only; ownership, status e valor vem do backend e o service propaga os DTOs sem
// interpreta-los nem persisti-los. 404 = ausencia neutra (recurso alheio/inexistente/sem Pix);
// 403, rede e 5xx sobem para tratamento na UI e nunca sao convertidos em sucesso. Auth pelo
// authInterceptor; sem step-up, Idempotency-Key ou header financeiro.
//
// Os endpoints operacionais de Pix (FINANCEIRO/ADMIN/BACKOFFICE — desembolsos, referencias,
// recebimentos internos, conciliacao) NAO sao expostos aqui.
@Injectable({ providedIn: 'root' })
export class PixMobileService {
  private readonly http = inject(HttpClient);

  // P1 — status do desembolso Pix de um contrato proprio (ROLE_CLIENTE).
  consultarDesembolsoDoContrato(contratoId: string): Promise<PixDesembolsoTomadorResponse> {
    return firstValueFrom(
      this.http.get<PixDesembolsoTomadorResponse>(`${PIX_URL}/contratos/${contratoId}/desembolso`),
    );
  }

  // P2 — estado Pix de uma parcela propria (ROLE_CLIENTE). O historico liquidado continua em
  // CobrancaMobileService.consultarRecebimentos (meioPagamento=PIX); este metodo nao o duplica.
  consultarStatusPixDaParcela(parcelaId: string): Promise<PixPagamentoParcelaResponse> {
    return firstValueFrom(
      this.http.get<PixPagamentoParcelaResponse>(`${PIX_URL}/parcelas/${parcelaId}/status`),
    );
  }

  // P3 — status Pix de uma operacao da carteira da propria credora (acesso por presenca de
  // credora, sem role CREDORA).
  consultarStatusPixDaOperacao(operacaoId: string): Promise<PixOperacaoCredoraResponse> {
    return firstValueFrom(
      this.http.get<PixOperacaoCredoraResponse>(`${CREDORES_URL}/carteira/${operacaoId}/pix`),
    );
  }
}
