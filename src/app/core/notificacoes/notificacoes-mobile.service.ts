import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { NotificacaoResponse, NotificacoesNaoLidasResponse, PageResponse } from '../api/api.models';

const NOTIFICACOES_URL = `${environment.apiBaseUrl}/notificacoes`;

// Transporte HTTP da central de notificacoes (M-Sprint 19; backend Sprint 38, ADR 0021 §9).
// O dono e sempre o usuario do token: nenhuma chamada envia usuario, canal ou origem. Recorte
// IN_APP, ordenacao (`criadaEm` desc, `id` desc), ownership e idempotencia da leitura pertencem ao
// backend; o service propaga os DTOs sem interpreta-los nem persisti-los. Erros sobem intactos para
// a UI decidir — `404` da leitura e neutro (inexistente, alheia ou de e-mail). Auth pelo
// authInterceptor; sem step-up nem Idempotency-Key.
@Injectable({ providedIn: 'root' })
export class NotificacoesMobileService {
  private readonly http = inject(HttpClient);

  // `page` a partir de 0 e `size` de 1 a 100; fora disso o backend responde 400 NTF-400-001.
  listar(page: number, size: number): Promise<PageResponse<NotificacaoResponse>> {
    return firstValueFrom(
      this.http.get<PageResponse<NotificacaoResponse>>(NOTIFICACOES_URL, {
        params: { page, size },
      }),
    );
  }

  contarNaoLidas(): Promise<NotificacoesNaoLidasResponse> {
    return firstValueFrom(
      this.http.get<NotificacoesNaoLidasResponse>(`${NOTIFICACOES_URL}/nao-lidas/contagem`),
    );
  }

  // POST sem corpo e idempotente: repetir devolve 200 com a `lidaEm` da primeira leitura, entao o
  // retry depois de um timeout que gravou nao precisa de Idempotency-Key.
  marcarComoLida(id: string): Promise<NotificacaoResponse> {
    return firstValueFrom(
      this.http.post<NotificacaoResponse>(`${NOTIFICACOES_URL}/${id}/leitura`, null),
    );
  }
}
