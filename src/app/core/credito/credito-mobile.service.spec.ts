import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CriarPropostaRequest, IniciarConsentimentoOpenFinanceRequest } from '../api/api.models';
import { CreditoMobileService } from './credito-mobile.service';

const API = 'http://localhost:8080/api/v1';
const PROPOSTAS = `${API}/credito/propostas`;
const ID = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';

describe('CreditoMobileService', () => {
  let service: CreditoMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CreditoMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listarPropostas GET /credito/propostas com filtros status/page/size', async () => {
    const promise = service.listarPropostas({ status: 'EM_ANALISE', page: 2, size: 10 });
    const req = httpMock.expectOne((r) => r.url === PROPOSTAS);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('EM_ANALISE');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(pagina([]));
    await expect(promise).resolves.toMatchObject({ content: [] });
  });

  it('listarPropostas nunca envia tomadorId (ownership do CLIENTE no backend)', async () => {
    const promise = service.listarPropostas();
    const req = httpMock.expectOne((r) => r.url === PROPOSTAS);
    expect(req.request.params.has('tomadorId')).toBe(false);
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush(pagina([]));
    await promise;
  });

  it('listarPropostas omite params ausentes mas preserva page=0', async () => {
    const promise = service.listarPropostas({ page: 0 });
    const req = httpMock.expectOne((r) => r.url === PROPOSTAS);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('size')).toBe(false);
    req.flush(pagina([]));
    await promise;
  });

  it('consultarProposta GET /credito/propostas/{id} usa o id no path', async () => {
    const promise = service.consultarProposta(ID);
    const req = httpMock.expectOne(`${PROPOSTAS}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(propostaFixture());
    await expect(promise).resolves.toMatchObject({ id: ID });
  });

  it('criarProposta POST envia os quatro campos exatos', async () => {
    const payload: CriarPropostaRequest = {
      solicitacaoOnboardingId: ID,
      tipoOperacao: 'CAPITAL_GIRO',
      valorSolicitado: 10000,
      prazoMeses: 12,
    };
    const promise = service.criarProposta(payload);
    const req = httpMock.expectOne(PROPOSTAS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(propostaFixture(), { status: 201, statusText: 'Created' });
    await expect(promise).resolves.toMatchObject({ id: ID });
  });

  it('iniciarConsentimentoOpenFinance POST .../open-finance/consentimento com documento e URI exatos', async () => {
    const payload: IniciarConsentimentoOpenFinanceRequest = {
      cpfCnpjTomador: '12345678901',
      redirectUri: `https://app.sep/app/propostas/${ID}/open-finance/retorno`,
    };
    const promise = service.iniciarConsentimentoOpenFinance(ID, payload);
    const req = httpMock.expectOne(`${PROPOSTAS}/${ID}/open-finance/consentimento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(
      {
        consentimentoId: ID,
        status: 'PENDENTE',
        urlAutorizacao: 'https://provider.example/auth',
        dataExpiracao: '2026-07-01T00:00:00-03:00',
      },
      { status: 201, statusText: 'Created' },
    );
    await expect(promise).resolves.toMatchObject({ status: 'PENDENTE' });
  });

  it('consultarOpenFinance GET .../open-finance usa o endpoint correto', async () => {
    const promise = service.consultarOpenFinance(ID);
    const req = httpMock.expectOne(`${PROPOSTAS}/${ID}/open-finance`);
    expect(req.request.method).toBe('GET');
    req.flush({
      statusConsentimento: 'AUTORIZADO',
      dataInicio: '2026-06-30T09:00:00-03:00',
      dataAutorizacao: '2026-06-30T09:05:00-03:00',
      dataExpiracao: null,
      ultimaMovimentacao: null,
    });
    await expect(promise).resolves.toMatchObject({ statusConsentimento: 'AUTORIZADO' });
  });

  it('propaga erro HTTP do backend para tratamento na UI', async () => {
    const promise = service.consultarProposta(ID);
    const req = httpMock.expectOne(`${PROPOSTAS}/${ID}`);
    req.flush({ message: 'Acesso negado' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toBeDefined();
  });
});

function propostaFixture() {
  return {
    id: ID,
    tomadorId: '2f0799c0-98b9-6d9d-bc4a-7d6f5b772002',
    solicitacaoOnboardingId: ID,
    tipoOperacao: 'CAPITAL_GIRO',
    valorSolicitado: 10000,
    moeda: 'BRL',
    prazoMeses: 12,
    status: 'EM_ANALISE',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    score: null,
    parecer: null,
  };
}

function pagina(content: unknown[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}
