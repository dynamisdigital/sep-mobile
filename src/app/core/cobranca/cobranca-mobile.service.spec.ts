import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgendaPagamentoResponse, ValorAtualizadoParcelaResponse } from '../api/api.models';
import { CobrancaMobileService } from './cobranca-mobile.service';

const API = 'http://localhost:8080/api/v1';
const COBRANCA = `${API}/cobranca`;
const CONTRATO_ID = '1f155daf-c0e8-6f15-be21-5f51a516a416';
const PARCELA_ID = '2f155daf-c0e8-6f15-be21-5f51a516a417';

describe('CobrancaMobileService', () => {
  let service: CobrancaMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CobrancaMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consultarAgenda GET /cobranca/contratos/{id}/agenda usa o contratoId no path', async () => {
    const promise = service.consultarAgenda(CONTRATO_ID);
    const req = httpMock.expectOne(`${COBRANCA}/contratos/${CONTRATO_ID}/agenda`);
    expect(req.request.method).toBe('GET');
    req.flush(agendaFixture());
    await expect(promise).resolves.toEqual(agendaFixture());
  });

  it('consultarAgenda propaga o DTO sem transformar a lista de parcelas', async () => {
    const promise = service.consultarAgenda(CONTRATO_ID);
    const req = httpMock.expectOne(`${COBRANCA}/contratos/${CONTRATO_ID}/agenda`);
    const agenda = agendaFixture();
    req.flush(agenda);
    const resposta = await promise;
    // Fidelidade de borda: ordem, campos e status chegam intactos, sem recalculo local.
    expect(resposta.parcelas.map((p) => p.status)).toEqual(['PENDENTE', 'ATRASADA']);
    expect(resposta.parcelas[0].total).toBe(1000);
  });

  it('consultarParcela GET /cobranca/parcelas/{id} usa o parcelaId no path', async () => {
    const promise = service.consultarParcela(PARCELA_ID);
    const req = httpMock.expectOne(`${COBRANCA}/parcelas/${PARCELA_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(valorAtualizadoFixture());
    await expect(promise).resolves.toEqual(valorAtualizadoFixture());
  });

  it('consultarAgenda propaga 403 de ownership para tratamento na UI', async () => {
    const promise = service.consultarAgenda(CONTRATO_ID);
    const req = httpMock.expectOne(`${COBRANCA}/contratos/${CONTRATO_ID}/agenda`);
    req.flush({ message: 'Acesso negado' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toBeDefined();
  });

  it('consultarParcela propaga 404 (parcela indisponivel) sem converter em sucesso', async () => {
    const promise = service.consultarParcela(PARCELA_ID);
    const req = httpMock.expectOne(`${COBRANCA}/parcelas/${PARCELA_ID}`);
    req.flush({ message: 'Nao encontrada' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });
});

function agendaFixture(): AgendaPagamentoResponse {
  return {
    id: '0f8d2b1a-aaaa-6f15-be21-5f51a516a416',
    contratoId: CONTRATO_ID,
    numeroParcelas: 2,
    valorTotal: 2000,
    dataGeracao: '2026-05-22T10:00:00-03:00',
    parcelas: [
      {
        id: PARCELA_ID,
        numero: 1,
        principal: 850,
        juros: 150,
        multa: 0,
        encargos: 0,
        total: 1000,
        dataVencimento: '2026-06-15',
        status: 'PENDENTE',
      },
      {
        id: '3f155daf-c0e8-6f15-be21-5f51a516a418',
        numero: 2,
        principal: 850,
        juros: 150,
        multa: 0,
        encargos: 0,
        total: 1000,
        dataVencimento: '2026-07-15',
        status: 'ATRASADA',
      },
    ],
  };
}

function valorAtualizadoFixture(): ValorAtualizadoParcelaResponse {
  return {
    parcelaId: PARCELA_ID,
    numero: 1,
    status: 'ATRASADA',
    dataVencimento: '2026-06-15',
    principalOriginal: 1000,
    jurosOriginal: 150,
    jurosMora: 10,
    multa: 20,
    valorDevidoAtualizado: 1180,
    totalRecebido: 0,
    valorEmAberto: 1180,
  };
}
