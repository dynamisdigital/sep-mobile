import { describe, expect, it } from 'vitest';

import { formatarDataIso, formatarLocalDate } from './data';

const DIA_MES_ANO: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};
const COM_HORA: Intl.DateTimeFormatOptions = { ...DIA_MES_ANO, hour: '2-digit', minute: '2-digit' };

/**
 * Meio-dia UTC de proposito: em qualquer fuso entre -11 e +11 o **dia** do calendario e o mesmo, o
 * que torna a afirmacao independente da maquina. O horario NAO e afirmado em lugar nenhum deste
 * arquivo — o CI roda em UTC e a maquina de dev em -03.
 */
const INSTANTE_VALIDO = '2026-09-14T12:00:00Z';

describe('formatarDataIso', () => {
  describe('data que nao e exibivel', () => {
    /**
     * **`null` e o caso que motivou a FMF-4.1, e o unico que nao falha alto.** `new Date(null)`
     * coage `null` para `0` e devolve a epoch — instante valido, `getTime()` = 0, `Number.isNaN`
     * falso. A guarda que a M-19 escreveu testava so `NaN`, deixava passar, e a central mostrava
     * `31/12/1969` (em -03) ou `01/01/1970` (em UTC): data plausivel, errada e sem aviso.
     */
    it('null vira string vazia, e nao a epoch', () => {
      expect(formatarDataIso(null as unknown as string, DIA_MES_ANO)).toBe('');
    });

    it('undefined vira string vazia', () => {
      expect(formatarDataIso(undefined as unknown as string, DIA_MES_ANO)).toBe('');
    });

    /**
     * `''` nao tem guarda propria: cai no ramo do nao-parseavel (`new Date('')` e `Invalid Date`) e
     * volta verbatim, que para string vazia **e** string vazia. O teste trava o desfecho, nao o
     * caminho — uma guarda dedicada foi escrita, sobreviveu a mutacao que a removia, e saiu.
     */
    it('string vazia vira string vazia', () => {
      expect(formatarDataIso('', DIA_MES_ANO)).toBe('');
    });

    it.each(['lixo', '2026-13-45', 'PT2H'])('%s nao parseavel volta verbatim', (entrada) => {
      expect(formatarDataIso(entrada, DIA_MES_ANO)).toBe(entrada);
    });

    /** Era `RangeError: Invalid time value` dentro do template, derrubando a lista inteira. */
    it.each([null, undefined, '', 'lixo', '2026-13-45'])('%s nao lanca', (entrada) => {
      expect(() => formatarDataIso(entrada as unknown as string, COM_HORA)).not.toThrow();
    });
  });

  describe('data exibivel', () => {
    it('formata o dia em pt-BR', () => {
      expect(formatarDataIso(INSTANTE_VALIDO, DIA_MES_ANO)).toBe('14/09/2026');
    });

    /** Prova que as `opcoes` chegam ao `Intl` em vez de ficarem ignoradas. */
    it('aplica as opcoes recebidas', () => {
      const comHora = formatarDataIso(INSTANTE_VALIDO, COM_HORA);
      expect(comHora).toContain('14/09/2026');
      expect(comHora.length).toBeGreaterThan(formatarDataIso(INSTANTE_VALIDO, DIA_MES_ANO).length);
    });

    /**
     * A epoch **explicita** continua formatando: a guarda de `null` nao pode virar "descarta o
     * instante 0". Quem mandar `1970-01-01` de verdade tem direito a ver a data.
     */
    it('a epoch explicita e formatada, nao descartada', () => {
      expect(formatarDataIso('1970-01-01T12:00:00Z', DIA_MES_ANO)).toBe('01/01/1970');
    });
  });
});

describe('formatarLocalDate', () => {
  it('fixa meio-dia local e nao desloca o dia', () => {
    expect(formatarLocalDate('2026-09-14', DIA_MES_ANO)).toBe('14/09/2026');
  });

  /**
   * **O teste acima nao prova o meio-dia, e a mutacao mostrou isso.** Sem o `T12:00:00` a entrada
   * vira `new Date('2026-09-14')`, que e meia-noite **UTC**: numa maquina em UTC ou a leste de
   * Greenwich o dia exibido continua 14/09 e o mutante passa. Ele so morre a oeste — ou seja, o
   * teste acima mata o mutante na maquina de dev (-03) e o deixa vivo no CI (UTC).
   *
   * Por isso este fixa o fuso em vez de depender do ambiente. `Pacific/Honolulu` (-10) e o pior
   * caso realista: meia-noite UTC de 14/09 la ainda e 13/09.
   */
  it('o meio-dia fixo e o que segura o dia num fuso a oeste', () => {
    const fusoOriginal = process.env['TZ'];
    try {
      process.env['TZ'] = 'Pacific/Honolulu';
      expect(formatarLocalDate('2026-09-14', DIA_MES_ANO)).toBe('14/09/2026');
      // Controle: a mesma data sem o meio-dia volta um dia neste fuso. Se esta linha passar a
      // devolver 14/09, o ambiente deixou de honrar `process.env['TZ']` e o teste acima virou vacuo.
      expect(formatarDataIso('2026-09-14', DIA_MES_ANO)).toBe('13/09/2026');
    } finally {
      process.env['TZ'] = fusoOriginal;
    }
  });

  it.each([null, undefined])('%s vira string vazia', (entrada) => {
    expect(formatarLocalDate(entrada as unknown as string, DIA_MES_ANO)).toBe('');
  });

  /**
   * Antes da validacao de formato, a interpolacao montava `"undefinedT12:00:00"` /
   * `"lixoT12:00:00"` e o `Intl` lancava `RangeError`. Agora volta verbatim.
   *
   * O OffsetDateTime esta na lista porque e o engano plausivel: passado aqui viraria
   * `"2026-09-14T10:00:00ZT12:00:00"`.
   */
  it.each(['lixo', '2026-09', '2026-9-4', '2026/09/14', '2026.09.14', '2026-09-14T10:00:00Z'])(
    '%s fora do formato volta verbatim',
    (entrada) => {
      expect(formatarLocalDate(entrada, DIA_MES_ANO)).toBe(entrada);
    },
  );

  /**
   * Formato certo mas calendario impossivel **nao** e trabalho desta funcao — validar dia/mes e do
   * backend. O que importa e nao lancar: `new Date('2026-99-99T12:00:00')` e `Invalid Date`, entao
   * cai no verbatim do `formatarDataIso`.
   */
  it('formato certo com calendario impossivel volta verbatim, sem lancar', () => {
    expect(formatarLocalDate('2026-99-99', DIA_MES_ANO)).toBe('2026-99-99T12:00:00');
  });
});
