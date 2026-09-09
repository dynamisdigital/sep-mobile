import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from './api.models';

/**
 * Leitura segura do corpo de erro padronizado da API (`ErrorResponseDto`).
 *
 * Ate a M-Sprint 18 este arquivo nao existia e cada tela fazia o proprio
 * `err.error as ApiErrorResponse` — nove vezes, em oito arquivos, com duas assinaturas de tipo
 * diferentes (`| null | undefined` e `| undefined`), o que ja denunciava copia sem fonte unica.
 * O cast e uma promessa que o runtime nao cumpre: `err.error` chega como `unknown` de fato.
 *
 * O que ele pode ser, medido nos caminhos que o app percorre:
 *
 * - o DTO, no caso feliz de erro;
 * - `null`, num 204/504 sem corpo;
 * - uma `string`, quando um proxy devolve HTML em vez de JSON;
 * - um `ProgressEvent`, em falha de rede — e ai nem `HttpErrorResponse.error` e objeto do servidor.
 *
 * So o primeiro caso tem os campos; os demais precisam cair no fallback do chamador, e nao em
 * `undefined` disfarcado de valor. O irmao `support-reference.ts` ja narra o mesmo campo antes de
 * usar (`VALID_TRACE_ID`), e este arquivo segue esse padrao, nao o dos nove casts.
 *
 * **Ausente e `undefined`, sempre.** Nunca `null`, nunca `''`. Retorno unico deixa o chamador
 * escolher o proprio padrao com `??` sem precisar saber qual das varias formas de "nao veio" ocorreu.
 */
function campoDeTextoDoErro(erro: unknown, campo: keyof ApiErrorResponse): string | undefined {
  if (!(erro instanceof HttpErrorResponse)) {
    return undefined;
  }
  const corpo: unknown = erro.error;
  if (corpo === null || typeof corpo !== 'object') {
    return undefined;
  }
  const bruto: unknown = (corpo as Record<string, unknown>)[campo];
  // Sem coercao de proposito. O `.toString()` que alguns call sites faziam transformava um
  // `message` numerico em `"5"` e um objeto em `"[object Object]"` — texto que a tela mostraria ao
  // usuario como se fosse copy do backend. E sem a guarda o `.trim()` abaixo LANCARIA dentro do
  // callback de erro, deixando o `submitting.set(false)` seguinte sem rodar e a tela carregando
  // para sempre.
  if (typeof bruto !== 'string') {
    return undefined;
  }
  const texto = bruto.trim();
  return texto === '' ? undefined : texto;
}

/**
 * A `message` do corpo, aparada, ou `undefined` quando nao ha nenhuma utilizavel.
 *
 * **Branco vira ausente, e isso e guarda defensiva, nao correcao de bug observado.** O
 * `DomainException` do `sep-api` faz `super(mensagem)` sem validar branco e o `@JsonInclude(NON_NULL)`
 * suprime so `null` — nada no tipo impede `""` de chegar aqui. Proxies entre o app e a API sao a
 * outra origem plausivel. O estrago que a guarda evita e concreto neste repo: os call sites fazem
 * `erro.set(mensagemDaApi(err) ?? 'padrao')` e o template `@if (erro(); as msg)`; com `''` o `@if`
 * trata como falsy, o no nao e criado e **a tela fica muda depois do erro**.
 */
export function mensagemDaApi(erro: unknown): string | undefined {
  return campoDeTextoDoErro(erro, 'message');
}

/**
 * O `codigo` do corpo (`ErrorResponseDto.codigo`, backend Sprint 36), aparado, ou `undefined`.
 *
 * **Escolhe o RAMO, nao a FRASE.** O texto continua vindo de `mensagemDaApi` onde o corpo e
 * autoritativo; por isso este helper nao devolve copy nenhuma e nao conhece nenhum catalogo.
 *
 * **Nao valida contra lista local, de proposito.** O backend publica hoje um subconjunto da
 * taxonomia e a Sprint 37 vai mexer nele; uma lista fechada aqui faria o mobile recusar codigo novo
 * e cair no ramo legado sem sinal nenhum. Quem nao reconhece o valor ramifica pelo status, que e
 * exatamente o comportamento anterior a esta sprint.
 *
 * Branco tambem vira `undefined`: `'   '` e truthy, e um `Set.has` ou `switch` sobre ele escolheria
 * o ramo default achando que recebeu identificador.
 */
export function codigoDeErroDaApi(erro: unknown): string | undefined {
  return campoDeTextoDoErro(erro, 'codigo');
}
