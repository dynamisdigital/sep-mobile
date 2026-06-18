import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  EmpresaResponse,
  IniciarOnboardingEmpresaRequest,
  IniciarOnboardingPessoaRequest,
  OnboardingResponse,
  RepresentanteLegalResponse,
  StatusOnboardingEmpresaResponse,
  StatusOnboardingResponse,
  TipoDocumento,
} from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;
const PESSOA_URL = `${API_BASE_URL}/onboarding/pessoa`;
const EMPRESA_URL = `${API_BASE_URL}/onboarding/empresa`;

// Orquestra apenas o transporte HTTP do onboarding. Status e decisoes KYC/KYB/PLD
// pertencem ao backend; o service propaga os DTOs sem interpreta-los como regra de
// negocio e nunca retem o arquivo enviado. Auth e injetado pelo authInterceptor.
@Injectable({ providedIn: 'root' })
export class OnboardingMobileService {
  private readonly http = inject(HttpClient);

  // --- Pessoa Fisica (KYC) ---

  iniciarPessoa(request: IniciarOnboardingPessoaRequest): Promise<OnboardingResponse> {
    return firstValueFrom(this.http.post<OnboardingResponse>(PESSOA_URL, request));
  }

  enviarDocumentoPessoa(id: string, tipo: TipoDocumento, arquivo: File): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${PESSOA_URL}/${id}/documentos`, toDocumentoFormData(tipo, arquivo)),
    );
  }

  verificarPessoa(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${PESSOA_URL}/${id}/verificar`, null));
  }

  consultarPessoa(id: string): Promise<StatusOnboardingResponse> {
    return firstValueFrom(this.http.get<StatusOnboardingResponse>(`${PESSOA_URL}/${id}`));
  }

  // --- Pessoa Juridica (KYB) ---

  iniciarEmpresa(request: IniciarOnboardingEmpresaRequest): Promise<EmpresaResponse> {
    return firstValueFrom(this.http.post<EmpresaResponse>(EMPRESA_URL, request));
  }

  enviarDocumentoEmpresa(id: string, tipo: TipoDocumento, arquivo: File): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${EMPRESA_URL}/${id}/documentos`, toDocumentoFormData(tipo, arquivo)),
    );
  }

  verificarEmpresa(id: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${EMPRESA_URL}/${id}/verificar`, null));
  }

  consultarEmpresa(id: string): Promise<StatusOnboardingEmpresaResponse> {
    return firstValueFrom(this.http.get<StatusOnboardingEmpresaResponse>(`${EMPRESA_URL}/${id}`));
  }

  listarRepresentantesEmpresa(id: string): Promise<RepresentanteLegalResponse[]> {
    return firstValueFrom(
      this.http.get<RepresentanteLegalResponse[]>(`${EMPRESA_URL}/${id}/representantes`),
    );
  }
}

// Multipart com os campos exatos esperados pelo backend: `tipo` e `arquivo`.
function toDocumentoFormData(tipo: TipoDocumento, arquivo: File): FormData {
  const form = new FormData();
  form.append('tipo', tipo);
  form.append('arquivo', arquivo);
  return form;
}
