import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { codigoDeErroDaApi } from '../api/api-error';
import { NotificacaoResponse, PageResponse } from '../api/api.models';
import { NotificacoesMobileService } from './notificacoes-mobile.service';

const NOTIFICACOES = 'http://localhost:8080/api/v1/notificacoes';
const NOTIFICACAO_ID = '1f0a8c2e-7d3b-6e10-9a4f-2b7c5d8e9f00';
const CONTRATO_ID = '1f0a8c2e-7d3b-6e10-9a4f-2b7c5d8e9f01';

describe('NotificacoesMobileService', () => {
  let service: NotificacoesMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificacoesMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('listar', () => {
    it('GET /notificacoes so com page e size na query, sem dono nem canal', async () => {
      const promise = service.listar(2, 10);
      const req = httpMock.expectOne((r) => r.url === NOTIFICACOES);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().sort()).toEqual(['page', 'size']);
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('10');
      expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush(paginaFixture());
      await expect(promise).resolves.toEqual(paginaFixture());
    });

    // Fidelidade de borda: o backend manda `lidaEm` e `referencia` presentes e nulos. O service nao
    // pode trocar null por undefined nem descartar a referencia de quem tem.
    it('propaga lidaEm e referencia nulos intactos, e a referencia de quem tem', async () => {
      const promise = service.listar(0, 10);
      httpMock.expectOne((r) => r.url === NOTIFICACOES).flush(paginaFixture());
      const [naoLida, lida] = (await promise).content;
      expect(naoLida.lidaEm).toBeNull();
      expect(naoLida.referencia).toEqual({ tipo: 'CONTRATO', id: CONTRATO_ID });
      expect(lida.lidaEm).toBe('2026-09-14T10:05:00.123456-03:00');
      expect(lida.referencia).toBeNull();
    });

    it('200 com pagina vazia e sucesso, nao erro', async () => {
      const promise = service.listar(0, 10);
      const vazia = paginaFixture([]);
      httpMock.expectOne((r) => r.url === NOTIFICACOES).flush(vazia);
      await expect(promise).resolves.toEqual(vazia);
    });

    it('propaga o 400 NTF-400-001 de paginacao invalida com o codigo legivel pelo helper', async () => {
      const promise = service.listar(-1, 10);
      httpMock
        .expectOne((r) => r.url === NOTIFICACOES)
        .flush(
          {
            status: 400,
            error: 'Bad Request',
            message: 'Paginacao invalida: page deve ser maior ou igual a 0 e size entre 1 e 100',
            path: '/api/v1/notificacoes',
            codigo: 'NTF-400-001',
          },
          { status: 400, statusText: 'Bad Request' },
        );
      const erro = await promise.catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(HttpErrorResponse);
      expect((erro as HttpErrorResponse).status).toBe(400);
      expect(codigoDeErroDaApi(erro)).toBe('NTF-400-001');
    });
  });

  describe('contarNaoLidas', () => {
    it('GET /notificacoes/nao-lidas/contagem sem query nem corpo', async () => {
      const promise = service.contarNaoLidas();
      const req = httpMock.expectOne(`${NOTIFICACOES}/nao-lidas/contagem`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush({ naoLidas: 3 });
      await expect(promise).resolves.toEqual({ naoLidas: 3 });
    });

    it('zero e sucesso, nao ausencia', async () => {
      const promise = service.contarNaoLidas();
      httpMock.expectOne(`${NOTIFICACOES}/nao-lidas/contagem`).flush({ naoLidas: 0 });
      await expect(promise).resolves.toEqual({ naoLidas: 0 });
    });

    it('propaga falha tecnica sem converter em contagem', async () => {
      const promise = service.contarNaoLidas();
      httpMock
        .expectOne(`${NOTIFICACOES}/nao-lidas/contagem`)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });
      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    });
  });

  describe('marcarComoLida', () => {
    it('POST /notificacoes/{id}/leitura sem corpo, sem Idempotency-Key, com o id no path', async () => {
      const promise = service.marcarComoLida(NOTIFICACAO_ID);
      const req = httpMock.expectOne(`${NOTIFICACOES}/${NOTIFICACAO_ID}/leitura`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      const lida = { ...naoLidaFixture(), lidaEm: '2026-09-14T10:06:00.654321-03:00' };
      req.flush(lida);
      await expect(promise).resolves.toEqual(lida);
    });

    // O 404 e o mesmo para aviso inexistente, alheio ou de e-mail: o service nao o transforma em
    // nada mais especifico, e a UI so pode ramificar pelo que chegou.
    it('propaga o 404 neutro NTF-404-001 sem converter em sucesso', async () => {
      const promise = service.marcarComoLida(NOTIFICACAO_ID);
      httpMock.expectOne(`${NOTIFICACOES}/${NOTIFICACAO_ID}/leitura`).flush(
        {
          status: 404,
          error: 'Not Found',
          message: 'Notificacao nao encontrada',
          path: `/api/v1/notificacoes/${NOTIFICACAO_ID}/leitura`,
          codigo: 'NTF-404-001',
        },
        { status: 404, statusText: 'Not Found' },
      );
      const erro = await promise.catch((e: unknown) => e);
      expect((erro as HttpErrorResponse).status).toBe(404);
      expect(codigoDeErroDaApi(erro)).toBe('NTF-404-001');
    });
  });
});

function naoLidaFixture(): NotificacaoResponse {
  return {
    id: NOTIFICACAO_ID,
    tipo: 'DESEMBOLSO_PIX_CONCLUIDO',
    titulo: 'Desembolso concluido',
    mensagem: 'A transferencia Pix do desembolso do seu contrato foi concluida.',
    criadaEm: '2026-09-14T10:00:00.123456-03:00',
    lidaEm: null,
    referencia: { tipo: 'CONTRATO', id: CONTRATO_ID },
  };
}

function lidaSemReferenciaFixture(): NotificacaoResponse {
  return {
    id: '1f0a8c2e-7d3b-6e10-9a4f-2b7c5d8e9f02',
    tipo: 'DESEMBOLSO_PIX_CONCLUIDO',
    titulo: 'Desembolso concluido',
    mensagem: 'A transferencia Pix do desembolso do seu contrato foi concluida.',
    criadaEm: '2026-09-13T09:00:00.000001-03:00',
    lidaEm: '2026-09-14T10:05:00.123456-03:00',
    referencia: null,
  };
}

function paginaFixture(
  content: NotificacaoResponse[] = [naoLidaFixture(), lidaSemReferenciaFixture()],
): PageResponse<NotificacaoResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    number: 0,
    size: 10,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}
