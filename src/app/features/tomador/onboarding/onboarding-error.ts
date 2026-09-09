import { mensagemDaApi } from '../../../core/api/api-error';

// Extrai a mensagem amigavel do corpo de erro padronizado da API, com fallback.
// O mobile nao interpreta o status como regra de negocio; apenas apresenta o texto
// devolvido pelo backend. 401/403/423 ja sao tratados pelo errorInterceptor global
// (redirecionamento), entao aqui cobrimos 400/404/409/5xx.
//
// A guarda de shape (erro nao-HTTP, corpo nao-objeto, campo nao-string, texto em branco) mora em
// `mensagemDaApi`; aqui so resta a decisao local, que e qual padrao usar.
export function mensagemOnboardingErro(err: unknown, padrao: string): string {
  return mensagemDaApi(err) ?? padrao;
}
