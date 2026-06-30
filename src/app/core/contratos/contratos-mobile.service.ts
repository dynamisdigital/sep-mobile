import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ContratoResponse,
  StatusAssinaturaResponse,
  VersaoContratoResponse,
} from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;
const CONTRATOS_URL = `${API_BASE_URL}/contratos`;

// Resultado tipado do download do PDF assinado. O blob e transitorio: a UI cria a URL de objeto
// no momento da abertura e a revoga em seguida. Nada e persistido.
export interface DocumentoAssinadoResult {
  blob: Blob;
  nomeArquivo: string;
  hashSha256: string | null;
}

// Orquestra apenas o transporte HTTP da formalizacao (contratos Sprints 10-11). Ownership,
// versionamento, regra contratual, assinatura e validade juridica pertencem ao backend; o service
// propaga os DTOs sem interpreta-los e nunca persiste resposta, conteudo, PDF, hash ou token. O
// stepUpInterceptor anexa `X-Step-Up-Token` apenas no PATCH de aceite; auth pelo authInterceptor.
@Injectable({ providedIn: 'root' })
export class ContratosMobileService {
  private readonly http = inject(HttpClient);

  consultarPorProposta(propostaId: string): Promise<ContratoResponse> {
    return firstValueFrom(
      this.http.get<ContratoResponse>(`${CONTRATOS_URL}/proposta/${propostaId}`),
    );
  }

  consultarPorId(contratoId: string): Promise<ContratoResponse> {
    return firstValueFrom(this.http.get<ContratoResponse>(`${CONTRATOS_URL}/${contratoId}`));
  }

  listarVersoes(contratoId: string): Promise<VersaoContratoResponse[]> {
    return firstValueFrom(
      this.http.get<VersaoContratoResponse[]>(`${CONTRATOS_URL}/${contratoId}/versoes`),
    );
  }

  // Body vazio coerente com o backend: IP e User-Agent sao derivados do request HTTP, nao do
  // payload. O stepUpInterceptor injeta o token de uso unico neste PATCH.
  registrarAceite(contratoId: string): Promise<ContratoResponse> {
    return firstValueFrom(
      this.http.patch<ContratoResponse>(`${CONTRATOS_URL}/${contratoId}/aceite`, {}),
    );
  }

  consultarStatusAssinatura(contratoId: string): Promise<StatusAssinaturaResponse> {
    return firstValueFrom(
      this.http.get<StatusAssinaturaResponse>(`${CONTRATOS_URL}/${contratoId}/assinatura/status`),
    );
  }

  // Le o PDF como blob transitorio e captura os metadados dos headers. O nome sugerido e
  // sanitizado antes de virar atributo `download`; sem header valido, usa fallback local.
  async baixarDocumentoAssinado(contratoId: string): Promise<DocumentoAssinadoResult> {
    const response = await firstValueFrom(
      this.http.get(`${CONTRATOS_URL}/${contratoId}/documento-assinado`, {
        observe: 'response',
        responseType: 'blob',
      }),
    );
    const blob = response.body;
    // Documento legal: corpo ausente/vazio e erro explicito, nunca um PDF vazio "bem-sucedido".
    if (!blob || blob.size === 0) {
      throw new Error('Documento assinado indisponivel.');
    }
    return {
      blob,
      nomeArquivo: extrairNomeArquivo(response, contratoId),
      hashSha256: response.headers.get('X-Document-Hash-Sha256'),
    };
  }
}

// Extrai o filename do Content-Disposition e remove qualquer caractere fora de `[A-Za-z0-9._-]`,
// neutralizando separadores de path e caracteres de controle antes do atributo `download`.
// Fallback determinista quando o header esta ausente ou vazio.
function extrairNomeArquivo(response: HttpResponse<Blob>, contratoId: string): string {
  const fallback = `contrato-${contratoId}-assinado.pdf`;
  const disposition = response.headers.get('Content-Disposition');
  const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
  const bruto = match?.[1]?.trim() ?? '';
  const sanitizado = bruto.replace(/[^\w.-]/g, '_');
  return sanitizado.length > 0 ? sanitizado : fallback;
}
