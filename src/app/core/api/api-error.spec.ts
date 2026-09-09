import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { codigoDeErroDaApi, mensagemDaApi } from './api-error';
import { withSupportReference } from './support-reference';

function erroHttp(corpo: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({ error: corpo, status, statusText: 'Bad Request' });
}

// M-Sprint 18: os nove casts inline que estes dois helpers substituem confiavam no shape do corpo.
// Cada caso abaixo e uma forma de `err.error` que o app alcanca em runtime e que o cast prometia
// nao existir.
describe('api-error', () => {
  describe('mensagemDaApi', () => {
    it('devolve a mensagem do corpo padronizado', () => {
      expect(mensagemDaApi(erroHttp({ message: 'Senha atual incorreta.' }))).toBe(
        'Senha atual incorreta.',
      );
    });

    it('apara espacos ao redor', () => {
      expect(mensagemDaApi(erroHttp({ message: '  Proposta expirada.  ' }))).toBe(
        'Proposta expirada.',
      );
    });

    // O caso que deixa a tela MUDA: os chamadores fazem `erro.set(mensagemDaApi(err) ?? 'padrao')`
    // e o template `@if (erro(); as msg)`. Com '' o `@if` e falsy e o no de erro nunca e criado.
    it.each([
      ['vazia', ''],
      ['so espacos', '   '],
    ])('normaliza mensagem %s para undefined, liberando o fallback do chamador', (_rotulo, msg) => {
      expect(mensagemDaApi(erroHttp({ message: msg }))).toBeUndefined();
    });

    it('devolve undefined quando o corpo nao tem o campo', () => {
      expect(mensagemDaApi(erroHttp({ status: 400, path: '/api/v1/propostas' }))).toBeUndefined();
    });

    it.each([
      ['null (204/504 sem corpo)', null],
      ['string de proxy HTML', '<html><body>502 Bad Gateway</body></html>'],
    ])('devolve undefined para corpo %s', (_rotulo, corpo) => {
      expect(mensagemDaApi(erroHttp(corpo))).toBeUndefined();
    });

    // Sem a guarda de typeof, `.trim()` LANCA aqui — dentro do callback de erro do chamador, que
    // por isso nunca rodaria o `submitting.set(false)` seguinte.
    it.each([
      ['numerico', 5],
      ['objeto', { detalhe: 'x' }],
      ['array', ['a']],
      ['booleano', true],
      ['null', null],
    ])('devolve undefined, sem lancar, para message %s', (_rotulo, valor) => {
      const erro = erroHttp({ message: valor });
      expect(() => mensagemDaApi(erro)).not.toThrow();
      expect(mensagemDaApi(erro)).toBeUndefined();
    });

    it.each([
      ['Error comum', new Error('falha de rede')],
      ['string solta', 'boom'],
      ['undefined', undefined],
    ])('devolve undefined para erro nao-HTTP: %s', (_rotulo, erro) => {
      expect(mensagemDaApi(erro)).toBeUndefined();
    });
  });

  describe('codigoDeErroDaApi', () => {
    it('devolve o codigo publicado pelo backend', () => {
      expect(codigoDeErroDaApi(erroHttp({ message: 'x', codigo: 'MFA-400-004' }))).toBe(
        'MFA-400-004',
      );
    });

    // Corpo sem `codigo` e o caso NORMAL: backend anterior a Sprint 36, handler sem taxonomia,
    // cadeia de seguranca e bean validation respondem assim. Tem de degradar, nao quebrar.
    it('devolve undefined quando o corpo veio sem codigo', () => {
      expect(codigoDeErroDaApi(erroHttp({ message: 'codigo nao deve estar em branco' }))).toBe(
        undefined,
      );
    });

    it.each([
      ['vazio', ''],
      ['so espacos', '  '],
    ])('normaliza codigo %s para undefined', (_rotulo, codigo) => {
      expect(codigoDeErroDaApi(erroHttp({ message: 'x', codigo }))).toBeUndefined();
    });

    it.each([
      ['numerico', 400],
      ['objeto', { valor: 'MFA-400-002' }],
    ])('devolve undefined, sem lancar, para codigo %s', (_rotulo, codigo) => {
      const erro = erroHttp({ message: 'x', codigo });
      expect(() => codigoDeErroDaApi(erro)).not.toThrow();
      expect(codigoDeErroDaApi(erro)).toBeUndefined();
    });

    // NAO ha lista local de codigos aceitos, de proposito: o perimetro publicado muda entre sprints
    // e a Sprint 37 vai renomear parte dele. Codigo desconhecido chega ao chamador, que decide
    // ramificar ou cair no legado por status.
    it('nao filtra codigo desconhecido', () => {
      expect(codigoDeErroDaApi(erroHttp({ message: 'x', codigo: 'XYZ-999-001' }))).toBe(
        'XYZ-999-001',
      );
    });

    it('devolve undefined para erro nao-HTTP', () => {
      expect(codigoDeErroDaApi(new Error('offline'))).toBeUndefined();
    });
  });

  // `withSupportReference` reconstroi o corpo para anexar o traceId; sem o spread ele apagaria o
  // `codigo` do 5xx e o ramo por codigo morreria calado depois de passar pelo interceptor.
  describe('interacao com withSupportReference', () => {
    it('preserva o codigo ao anexar a referencia de suporte', () => {
      const original = new HttpErrorResponse({
        error: { message: 'Falha interna.', traceId: 'abc-123', codigo: 'CRD-500-001' },
        status: 500,
        statusText: 'Internal Server Error',
      });

      const enriquecido = withSupportReference(original);

      expect(codigoDeErroDaApi(enriquecido)).toBe('CRD-500-001');
      expect(mensagemDaApi(enriquecido)).toBe('Falha interna. Código de suporte: abc-123.');
    });
  });
});
