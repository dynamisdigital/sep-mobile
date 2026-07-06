import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PixDesembolsoTomadorResponse,
  PixOperacaoCredoraResponse,
  PixPagamentoParcelaResponse,
} from '../api/api.models';
import { PixMobileService } from './pix-mobile.service';

const API = 'http://localhost:8080/api/v1';
const PIX = `${API}/pix`;
const CREDORES = `${API}/credores`;
const CONTRATO_ID = '1f155daf-c0e8-6f15-be21-5f51a516a416';
const PARCELA_ID = '2f155daf-c0e8-6f15-be21-5f51a516a417';
const OPERACAO_ID = '7f155daf-c0e8-6f15-be21-5f51a516a41c';

describe('PixMobileService', () => {
  let service: PixMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PixMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // --- P1: desembolso do tomador ---

  it('consultarDesembolsoDoContrato GET /pix/contratos/{id}/desembolso, sem step-up nem Idempotency-Key', async () => {
    const promise = service.consultarDesembolsoDoContrato(CONTRATO_ID);
    const req = httpMock.expectOne(`${PIX}/contratos/${CONTRATO_ID}/desembolso`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(desembolsoFixture());
    await expect(promise).resolves.toEqual(desembolsoFixture());
  });

  it('consultarDesembolsoDoContrato propaga 404 (ausencia neutra) sem converter em sucesso', async () => {
    const promise = service.consultarDesembolsoDoContrato(CONTRATO_ID);
    const req = httpMock.expectOne(`${PIX}/contratos/${CONTRATO_ID}/desembolso`);
    req.flush({ message: 'Recurso Pix nao encontrado' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });

  it('consultarDesembolsoDoContrato propaga 403 (papel operacional) para tratamento na UI', async () => {
    const promise = service.consultarDesembolsoDoContrato(CONTRATO_ID);
    const req = httpMock.expectOne(`${PIX}/contratos/${CONTRATO_ID}/desembolso`);
    req.flush({ message: 'Acesso negado' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toBeDefined();
  });

  // --- P2: status Pix da parcela ---

  it('consultarStatusPixDaParcela GET /pix/parcelas/{id}/status usa o parcelaId no path', async () => {
    const promise = service.consultarStatusPixDaParcela(PARCELA_ID);
    const req = httpMock.expectOne(`${PIX}/parcelas/${PARCELA_ID}/status`);
    expect(req.request.method).toBe('GET');
    req.flush(parcelaAguardandoFixture());
    // Fidelidade de borda: mensagemPublica nula chega intacta (nao vira string vazia).
    await expect(promise).resolves.toEqual(parcelaAguardandoFixture());
  });

  it('consultarStatusPixDaParcela preserva a mensagemPublica sanitizada nos estados de atencao', async () => {
    const promise = service.consultarStatusPixDaParcela(PARCELA_ID);
    const req = httpMock.expectOne(`${PIX}/parcelas/${PARCELA_ID}/status`);
    const divergente = parcelaDivergenteFixture();
    req.flush(divergente);
    const resposta = await promise;
    expect(resposta.status).toBe('DIVERGENTE');
    expect(resposta.mensagemPublica).toBe(divergente.mensagemPublica);
  });

  it('consultarStatusPixDaParcela propaga 404 (sem estado Pix) sem converter em sucesso', async () => {
    const promise = service.consultarStatusPixDaParcela(PARCELA_ID);
    const req = httpMock.expectOne(`${PIX}/parcelas/${PARCELA_ID}/status`);
    req.flush({ message: 'Recurso Pix nao encontrado' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });

  // --- P3: status Pix da operacao da credora ---

  it('consultarStatusPixDaOperacao GET /credores/carteira/{id}/pix usa o operacaoId no path', async () => {
    const promise = service.consultarStatusPixDaOperacao(OPERACAO_ID);
    const req = httpMock.expectOne(`${CREDORES}/carteira/${OPERACAO_ID}/pix`);
    expect(req.request.method).toBe('GET');
    req.flush(operacaoFixture());
    await expect(promise).resolves.toEqual(operacaoFixture());
  });

  it('consultarStatusPixDaOperacao propaga 404 (credora/operacao/sem Pix) sem converter em sucesso', async () => {
    const promise = service.consultarStatusPixDaOperacao(OPERACAO_ID);
    const req = httpMock.expectOne(`${CREDORES}/carteira/${OPERACAO_ID}/pix`);
    req.flush(
      { message: 'Status Pix da operacao nao encontrado' },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(promise).rejects.toBeDefined();
  });
});

function desembolsoFixture(): PixDesembolsoTomadorResponse {
  return {
    status: 'EM_PROCESSAMENTO',
    valor: 1500,
    atualizadoEm: '2026-07-06T10:00:00-03:00',
  };
}

function parcelaAguardandoFixture(): PixPagamentoParcelaResponse {
  return {
    status: 'AGUARDANDO',
    valor: 350,
    atualizadoEm: '2026-07-06T10:00:00-03:00',
    mensagemPublica: null,
  };
}

function parcelaDivergenteFixture(): PixPagamentoParcelaResponse {
  return {
    status: 'DIVERGENTE',
    valor: 350,
    atualizadoEm: '2026-07-06T10:00:00-03:00',
    mensagemPublica: 'Pagamento Pix em verificacao. Se persistir, procure o suporte.',
  };
}

function operacaoFixture(): PixOperacaoCredoraResponse {
  return {
    status: 'LIQUIDADO',
    valor: 1500,
    atualizadoEm: '2026-07-06T10:00:00-03:00',
  };
}
