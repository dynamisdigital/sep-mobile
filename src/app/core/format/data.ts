/**
 * Formata uma data ISO vinda da API para exibicao em `pt-BR`, sem nunca lancar e sem nunca inventar
 * um instante que o backend nao mandou.
 *
 * Corpo unico de verdade para os `formatarData`/`formatarDataHora` das features, que continuam
 * existindo com nome e opcoes proprias: a escolha do que mostrar e do call site. O que se generaliza
 * e o tratamento do que **nao** formata.
 *
 * Tres desfechos:
 *
 * 1. **ausente** (`null`, `undefined`) -> `''`. Nao ha instante a mostrar, e a tela renderiza vazio
 *    em vez de uma data falsa.
 * 2. **presente mas nao parseavel** -> o proprio texto recebido. Falha visivel e melhor que falha
 *    silenciosa. String vazia cai aqui e devolve `''` — nao ha guarda propria para `''` porque
 *    `new Date('')` ja e `Invalid Date`, e a guarda que existia sobreviveu a mutacao que a removia.
 * 3. **parseavel** -> `Intl.DateTimeFormat('pt-BR', opcoes)`.
 *
 * **Por que `null` precisa de ramo proprio.** `new Date(null)` faz coercao numerica para `0` e
 * devolve a **epoch**, que e um instante valido — `getTime()` da `0`, nao `NaN`. Uma guarda que so
 * testa `Number.isNaN` deixa passar, e a tela mostra `31/12/1969` (em -03) ou `01/01/1970` (em UTC):
 * data plausivel, errada e sem aviso. A guarda que a M-19 escreveu neste repo tinha exatamente esse
 * furo, e a da F-27 no `sep-app` tambem.
 *
 * O parametro e tipado `string` porque e isso que os modelos do OpenAPI declaram. **O tipo mente por
 * um motivo medido**: o springdoc descarta `nullable` em OpenAPI 3.1 (aprendizado (2) da Sprint 38),
 * entao o documento nao tem marca de nulidade nenhuma e campo que o backend pode mandar `null` chega
 * aqui declarado `string`. Por isso a guarda e de runtime, e nao de tipo.
 */
export function formatarDataIso(iso: string, opcoes: Intl.DateTimeFormatOptions): string {
  if (iso == null) {
    return '';
  }
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
}

/**
 * Formata um `LocalDate` (`yyyy-MM-dd`) fixando **meio-dia local**, para que o dia exibido seja o dia
 * recebido em qualquer fuso — `new Date('2026-09-14')` e lido como UTC e volta um dia a oeste de
 * Greenwich.
 *
 * So o formato exato e aceito. Texto fora dele volta verbatim em vez de virar data: sem a validacao,
 * a interpolacao montava `"undefinedT12:00:00"` e o `Intl` lancava `RangeError` dentro do template,
 * derrubando a lista inteira.
 */
export function formatarLocalDate(data: string, opcoes: Intl.DateTimeFormatOptions): string {
  if (data == null) {
    return '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }
  return formatarDataIso(`${data}T12:00:00`, opcoes);
}
