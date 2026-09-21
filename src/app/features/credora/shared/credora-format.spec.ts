import { describe, expect, it } from 'vitest';

import { formatarData, formatarDataLocal } from './credora-format';

/**
 * Fiacao com `core/format/data` (FMF-4.1). O contrato completo — e por que `new Date(null)` vira
 * epoch em vez de `NaN` — esta em `core/format/data.spec.ts`; aqui se prova que **estas duas**
 * passam por ele, porque antes chamavam o `Intl` direto.
 *
 * Nenhum horario e afirmado: o CI roda em UTC e a maquina de dev em -03.
 */
describe('formatarData', () => {
  /** Era `31/12/1969` na tela (em -03), sem erro nenhum. */
  it('null nao vira data de 1969', () => {
    expect(formatarData(null as unknown as string)).toBe('');
  });

  /** Era `RangeError: Invalid time value` dentro do template, derrubando a lista. */
  it.each([undefined, '', 'lixo'])('%s nao lanca', (entrada) => {
    expect(() => formatarData(entrada as unknown as string)).not.toThrow();
  });

  it('OffsetDateTime valido continua formatando', () => {
    expect(formatarData('2026-09-14T12:00:00Z')).toBe('14/09/2026');
  });
});

/**
 * `formatarDataLocal` falhava de um jeito **diferente** do irmao, e por isso tem bloco proprio: ele
 * interpolava a entrada em `` `${data}T12:00:00` ``. Com `null` isso vira a string `"nullT12:00:00"`
 * — nao a epoch —, entao aqui o defeito nunca foi 1969; era `RangeError` em todos os casos ruins.
 */
describe('formatarDataLocal', () => {
  /**
   * O meio-dia fixo e a razao de a funcao existir: `new Date('2026-09-14')` e lido como UTC e, em
   * -03, exibiria 13/09. Travado aqui para que a correcao da FMF-4.1 nao desfaca isso sem alguem
   * perceber — este teste falharia num fuso a oeste se o `T12:00:00` sumisse.
   */
  it('LocalDate nao desloca o dia', () => {
    expect(formatarDataLocal('2026-09-14')).toBe('14/09/2026');
  });

  it.each([null, undefined])('%s nao lanca e vira vazio', (entrada) => {
    expect(formatarDataLocal(entrada as unknown as string)).toBe('');
  });

  /**
   * Fora do formato volta verbatim. `'2026-09-14T10:00:00Z'` e o caso que a ancora da regex pega:
   * um OffsetDateTime passado por engano viraria `"2026-09-14T10:00:00ZT12:00:00"`, que nao parseia.
   * `'2026/09/14'` e `'2026.09.14'` travam o separador.
   */
  it.each(['lixo', '2026-09', '2026-9-4', '2026/09/14', '2026.09.14', '2026-09-14T10:00:00Z'])(
    '%s fora do formato volta verbatim',
    (entrada) => {
      expect(formatarDataLocal(entrada)).toBe(entrada);
    },
  );
});
