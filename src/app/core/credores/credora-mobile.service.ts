import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ElegibilidadeResponse,
  EmpresaCredoraResponse,
  InteresseResponse,
  OperacaoCarteiraResponse,
  OportunidadeResponse,
} from '../api/api.models';

const CREDORES_URL = `${environment.apiBaseUrl}/credores`;

// Orquestra apenas o transporte HTTP da jornada da empresa credora (Epic 10; backend Sprints
// 16-17 + 25). Ownership, elegibilidade, regras de interesse e associacao de carteira permanecem
// no backend: o service propaga os DTOs sem interpreta-los e nunca persiste respostas. Auth vem
// do authInterceptor. Sem cadastro, sync ou endpoints administrativos — fora do recorte da M-10.
@Injectable({ providedIn: 'root' })
export class CredoraMobileService {
  private readonly http = inject(HttpClient);

  consultarMinhaCredora(): Promise<EmpresaCredoraResponse> {
    return firstValueFrom(this.http.get<EmpresaCredoraResponse>(`${CREDORES_URL}/me`));
  }

  consultarElegibilidade(): Promise<ElegibilidadeResponse> {
    return firstValueFrom(this.http.get<ElegibilidadeResponse>(`${CREDORES_URL}/me/elegibilidade`));
  }

  listarOportunidades(): Promise<OportunidadeResponse[]> {
    return firstValueFrom(this.http.get<OportunidadeResponse[]>(`${CREDORES_URL}/oportunidades`));
  }

  consultarOportunidade(oportunidadeId: string): Promise<OportunidadeResponse> {
    return firstValueFrom(
      this.http.get<OportunidadeResponse>(`${CREDORES_URL}/oportunidades/${oportunidadeId}`),
    );
  }

  // Leitura autoritativa do interesse ativo (backend Sprint 25 — Gate I1). 404 quando nao ha
  // interesse ativo (ou o usuario nao possui credora); o chamador trata o 404 como "sem interesse".
  consultarInteresseAtivo(oportunidadeId: string): Promise<InteresseResponse> {
    return firstValueFrom(
      this.http.get<InteresseResponse>(
        `${CREDORES_URL}/oportunidades/${oportunidadeId}/interesses/me`,
      ),
    );
  }

  // POST sem corpo: o backend nao exige body para registrar interesse.
  registrarInteresse(oportunidadeId: string): Promise<InteresseResponse> {
    return firstValueFrom(
      this.http.post<InteresseResponse>(
        `${CREDORES_URL}/oportunidades/${oportunidadeId}/interesses`,
        null,
      ),
    );
  }

  // DELETE devolve 204 sem corpo; resolve sem fabricar DTO.
  cancelarInteresse(oportunidadeId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${CREDORES_URL}/oportunidades/${oportunidadeId}/interesses/me`),
    );
  }

  listarCarteira(): Promise<OperacaoCarteiraResponse[]> {
    return firstValueFrom(this.http.get<OperacaoCarteiraResponse[]>(`${CREDORES_URL}/carteira`));
  }

  consultarOperacao(operacaoId: string): Promise<OperacaoCarteiraResponse> {
    return firstValueFrom(
      this.http.get<OperacaoCarteiraResponse>(`${CREDORES_URL}/carteira/${operacaoId}`),
    );
  }
}
