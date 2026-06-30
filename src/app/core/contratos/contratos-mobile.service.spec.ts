import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StatusFormalizacao } from '../api/api.models';
import { ContratosMobileService } from './contratos-mobile.service';

const API = 'http://localhost:8080/api/v1';
const CONTRATOS = `${API}/contratos`;
const ID = '1f1d4920-3f55-6f48-9b3e-aa1234567890';
const PROPOSTA_ID = '2f1d4920-3f55-6f48-9b3e-bb1234567890';

describe('ContratosMobileService', () => {
  let service: ContratosMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContratosMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consultarPorProposta GET /contratos/proposta/{propostaId} monta o path exato', async () => {
    const promise = service.consultarPorProposta(PROPOSTA_ID);
    const req = httpMock.expectOne(`${CONTRATOS}/proposta/${PROPOSTA_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(contratoFixture('AGUARDANDO_ACEITE'));
    await expect(promise).resolves.toMatchObject({ id: ID });
  });

  it('consultarPorId GET /contratos/{id} usa o id no path', async () => {
    const promise = service.consultarPorId(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(contratoFixture('AGUARDANDO_ACEITE'));
    await expect(promise).resolves.toMatchObject({ id: ID });
  });

  it('listarVersoes GET /contratos/{id}/versoes preserva a ordem recebida', async () => {
    const promise = service.listarVersoes(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/versoes`);
    expect(req.request.method).toBe('GET');
    req.flush([versaoFixture(1), versaoFixture(2), versaoFixture(3)]);
    const versoes = await promise;
    expect(versoes.map((v) => v.numero)).toEqual([1, 2, 3]);
  });

  it('registrarAceite PATCH /contratos/{id}/aceite com body vazio retorna ContratoResponse', async () => {
    const promise = service.registrarAceite(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/aceite`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(contratoFixture('ACEITO'));
    await expect(promise).resolves.toMatchObject({ status: 'ACEITO' });
  });

  it('consultarStatusAssinatura GET /contratos/{id}/assinatura/status', async () => {
    const promise = service.consultarStatusAssinatura(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/assinatura/status`);
    expect(req.request.method).toBe('GET');
    req.flush({
      statusContrato: 'EM_ASSINATURA',
      statusEnvelope: 'ENVIADO',
      idEnvelopeExterno: 'env-externo-123',
      dataAtualizacaoProvider: '2026-06-30T10:00:00-03:00',
    });
    await expect(promise).resolves.toMatchObject({ statusEnvelope: 'ENVIADO' });
  });

  it('baixarDocumentoAssinado solicita blob e captura nome/hash dos headers', async () => {
    const promise = service.baixarDocumentoAssinado(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/documento-assinado`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.4 ficticio'], { type: 'application/pdf' }), {
      headers: {
        'Content-Disposition': `attachment; filename="contrato-${ID}-assinado.pdf"`,
        'X-Document-Hash-Sha256': 'ba7816bf8f01cfea414140de5dae2223',
      },
    });
    const result = await promise;
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.nomeArquivo).toBe(`contrato-${ID}-assinado.pdf`);
    expect(result.hashSha256).toBe('ba7816bf8f01cfea414140de5dae2223');
  });

  it('baixarDocumentoAssinado sanitiza nome perigoso removendo separadores de path', async () => {
    const promise = service.baixarDocumentoAssinado(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/documento-assinado`);
    req.flush(new Blob(['x']), {
      headers: { 'Content-Disposition': 'attachment; filename="../../etc/passwd"' },
    });
    const result = await promise;
    expect(result.nomeArquivo).not.toContain('/');
    expect(result.nomeArquivo).not.toContain('\\');
  });

  it('baixarDocumentoAssinado usa fallback local quando nao ha Content-Disposition', async () => {
    const promise = service.baixarDocumentoAssinado(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/documento-assinado`);
    req.flush(new Blob(['x']));
    const result = await promise;
    expect(result.nomeArquivo).toBe(`contrato-${ID}-assinado.pdf`);
    expect(result.hashSha256).toBeNull();
  });

  it('baixarDocumentoAssinado falha quando o corpo do PDF vem vazio (documento legal)', async () => {
    const promise = service.baixarDocumentoAssinado(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}/documento-assinado`);
    req.flush(new Blob([]));
    await expect(promise).rejects.toThrow('indisponivel');
  });

  it.each([403, 404, 409])('propaga erro HTTP %i para tratamento na UI', async (status) => {
    const promise = service.consultarPorId(ID);
    const req = httpMock.expectOne(`${CONTRATOS}/${ID}`);
    req.flush({ message: 'erro' }, { status, statusText: 'Error' });
    await expect(promise).rejects.toBeDefined();
  });

  it('propaga erro de rede para tratamento na UI', async () => {
    const promise = service.consultarPorProposta(PROPOSTA_ID);
    const req = httpMock.expectOne(`${CONTRATOS}/proposta/${PROPOSTA_ID}`);
    req.error(new ProgressEvent('error'));
    await expect(promise).rejects.toBeDefined();
  });

  it('nenhum metodo grava em localStorage ou sessionStorage', async () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');

    const consulta = service.consultarPorId(ID);
    httpMock.expectOne(`${CONTRATOS}/${ID}`).flush(contratoFixture('ASSINADO'));
    await consulta;

    const aceite = service.registrarAceite(ID);
    httpMock.expectOne(`${CONTRATOS}/${ID}/aceite`).flush(contratoFixture('ACEITO'));
    await aceite;

    const download = service.baixarDocumentoAssinado(ID);
    httpMock.expectOne(`${CONTRATOS}/${ID}/documento-assinado`).flush(new Blob(['x']));
    await download;

    expect(localSpy).not.toHaveBeenCalled();
    localSpy.mockRestore();
  });
});

function contratoFixture(status: StatusFormalizacao) {
  return {
    id: ID,
    propostaId: PROPOSTA_ID,
    tomadorId: '3f1d4920-3f55-6f48-9b3e-cc1234567890',
    tipo: 'MUTUO',
    status,
    versaoVigente: versaoFixture(1),
    aceite: null,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
  };
}

function versaoFixture(numero: number) {
  return {
    id: `9f1d4920-3f55-6f48-9b3e-00000000000${numero}`,
    numero,
    conteudoTexto: `Conteudo da versao ${numero}`,
    hashSha256: 'ba7816bf8f01cfea414140de5dae2223',
    dataGeracao: '2026-06-30T09:00:00-03:00',
    parecerOrigemId: null,
    clausulas: [{ id: 'c1', ordem: 1, titulo: 'OBJETO', texto: 'O presente contrato...' }],
  };
}
