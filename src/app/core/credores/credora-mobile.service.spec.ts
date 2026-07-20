import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StatusAporteCredora } from '../api/api.models';

import { CredoraMobileService } from './credora-mobile.service';

const API = 'http://localhost:8080/api/v1';
const CREDORES = `${API}/credores`;
const OP_ID = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';
const OPER_ID = '2f0799c0-98b9-6d9d-bc4a-7d6f5b772002';

describe('CredoraMobileService', () => {
  let service: CredoraMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CredoraMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consultarMinhaCredora GET /credores/me', async () => {
    const promise = service.consultarMinhaCredora();
    const req = httpMock.expectOne(`${CREDORES}/me`);
    expect(req.request.method).toBe('GET');
    req.flush(credoraFixture());
    await expect(promise).resolves.toMatchObject({ status: 'ATIVA', elegibilidade: 'ELEGIVEL' });
  });

  it('consultarElegibilidade GET /credores/me/elegibilidade', async () => {
    const promise = service.consultarElegibilidade();
    const req = httpMock.expectOne(`${CREDORES}/me/elegibilidade`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ATIVA', elegibilidade: 'ELEGIVEL', motivoInelegibilidade: null });
    await expect(promise).resolves.toMatchObject({ elegibilidade: 'ELEGIVEL' });
  });

  it('listarOportunidades GET /credores/oportunidades sem params', async () => {
    const promise = service.listarOportunidades();
    const req = httpMock.expectOne(`${CREDORES}/oportunidades`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([oportunidadeFixture()]);
    await expect(promise).resolves.toHaveLength(1);
  });

  it('consultarOportunidade GET /credores/oportunidades/{id}', async () => {
    const promise = service.consultarOportunidade(OP_ID);
    const req = httpMock.expectOne(`${CREDORES}/oportunidades/${OP_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(oportunidadeFixture());
    await expect(promise).resolves.toMatchObject({ id: OP_ID });
  });

  it('consultarInteresseAtivo GET /credores/oportunidades/{id}/interesses/me', async () => {
    const promise = service.consultarInteresseAtivo(OP_ID);
    const req = httpMock.expectOne(`${CREDORES}/oportunidades/${OP_ID}/interesses/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: OP_ID, oportunidadeId: OP_ID, status: 'ATIVO', dataCriacao: DATA });
    await expect(promise).resolves.toMatchObject({ status: 'ATIVO' });
  });

  it('registrarInteresse POST /credores/oportunidades/{id}/interesses sem corpo', async () => {
    const promise = service.registrarInteresse(OP_ID);
    const req = httpMock.expectOne(`${CREDORES}/oportunidades/${OP_ID}/interesses`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(
      { id: OP_ID, oportunidadeId: OP_ID, status: 'ATIVO', dataCriacao: DATA },
      { status: 201, statusText: 'Created' },
    );
    await expect(promise).resolves.toMatchObject({ status: 'ATIVO' });
  });

  it('cancelarInteresse DELETE .../interesses/me trata 204 como sucesso', async () => {
    const promise = service.cancelarInteresse(OP_ID);
    const req = httpMock.expectOne(`${CREDORES}/oportunidades/${OP_ID}/interesses/me`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(promise).resolves.toBeNull();
  });

  it('listarCarteira GET /credores/carteira', async () => {
    const promise = service.listarCarteira();
    const req = httpMock.expectOne(`${CREDORES}/carteira`);
    expect(req.request.method).toBe('GET');
    req.flush([operacaoFixture()]);
    await expect(promise).resolves.toHaveLength(1);
  });

  it('consultarOperacao GET /credores/carteira/{id}', async () => {
    const promise = service.consultarOperacao(OPER_ID);
    const req = httpMock.expectOne(`${CREDORES}/carteira/${OPER_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(operacaoFixture());
    await expect(promise).resolves.toMatchObject({ id: OPER_ID, status: 'ASSOCIADA' });
  });

  it('listarAportes GET /credores/operacoes/{id}/aportes preservando a ordem do backend', async () => {
    const promise = service.listarAportes(OPER_ID);
    const req = httpMock.expectOne(`${CREDORES}/operacoes/${OPER_ID}/aportes`);
    expect(req.request.method).toBe('GET');
    req.flush([aporteFixture('LIQUIDADO'), aporteFixture('PENDENTE')]);
    await expect(promise).resolves.toMatchObject([{ status: 'LIQUIDADO' }, { status: 'PENDENTE' }]);
  });

  it('listarAportes nao anexa X-Step-Up-Token nem Idempotency-Key (GET owner-scoped)', async () => {
    const promise = service.listarAportes(OPER_ID);
    const req = httpMock.expectOne(`${CREDORES}/operacoes/${OPER_ID}/aportes`);
    expect(req.request.headers.has('X-Step-Up-Token')).toBe(false);
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush([]);
    await expect(promise).resolves.toEqual([]);
  });

  it('listarAportes trata lista vazia como estado valido, sem fabricar item', async () => {
    const promise = service.listarAportes(OPER_ID);
    httpMock.expectOne(`${CREDORES}/operacoes/${OPER_ID}/aportes`).flush([]);
    await expect(promise).resolves.toEqual([]);
  });

  it('listarAportes propaga 404 neutro de operacao alheia/inexistente', async () => {
    const promise = service.listarAportes(OPER_ID);
    const req = httpMock.expectOne(`${CREDORES}/operacoes/${OPER_ID}/aportes`);
    req.flush({ message: 'nao encontrado' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });

  it('propaga erro HTTP (404/409/422) sem converter em vazio/sucesso', async () => {
    const promise = service.consultarInteresseAtivo(OP_ID);
    const req = httpMock.expectOne(`${CREDORES}/oportunidades/${OP_ID}/interesses/me`);
    req.flush({ message: 'nao encontrado' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });

  it('nao expoe metodos de cadastro, sync ou associacao de carteira (endpoints ADMIN)', () => {
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(metodos).not.toContain('cadastrarCredora');
    expect(metodos).not.toContain('sincronizarOportunidades');
    expect(metodos).not.toContain('associarOperacao');
  });

  // Gate M-16.0: aporte e matching exigem FINANCEIRO/ADMIN, persona ausente no mobile. O service
  // so pode ler aportes; qualquer mutacao aqui seria 403 e violaria o recorte da spec 216.
  it('nao expoe mutacao de aporte, decisao de matching ou chaves Pix (persona FINANCEIRO)', () => {
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(metodos).not.toContain('registrarAporte');
    expect(metodos).not.toContain('decidirMatching');
    expect(metodos).not.toContain('listarSugestoesMatching');
    expect(metodos).not.toContain('listarChaves');
  });
});

const DATA = '2026-07-03T09:00:00-03:00';

function credoraFixture() {
  return {
    id: '9f0799c0-98b9-6d9d-bc4a-7d6f5b770009',
    usuarioId: 'af0799c0-98b9-6d9d-bc4a-7d6f5b77000a',
    onboardingId: 'bf0799c0-98b9-6d9d-bc4a-7d6f5b77000b',
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Credora Teste LTDA',
    status: 'ATIVA',
    elegibilidade: 'ELEGIVEL',
    motivoInelegibilidade: null,
    tipoCredora: 'EMPRESA',
    capacidadeAporte: 100000,
    dataCriacao: DATA,
    dataModificacao: DATA,
  };
}

function oportunidadeFixture() {
  return {
    id: OP_ID,
    propostaId: 'cf0799c0-98b9-6d9d-bc4a-7d6f5b77000c',
    contratoId: null,
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 1.99,
    status: 'DISPONIVEL',
    dataCriacao: DATA,
  };
}

function aporteFixture(status: StatusAporteCredora) {
  return {
    id: 'ef0799c0-98b9-6d9d-bc4a-7d6f5b77000e',
    operacaoId: OPER_ID,
    status,
    valor: 5000,
    dataCriacao: DATA,
    dataAtualizacao: DATA,
  };
}

function operacaoFixture() {
  return {
    id: OPER_ID,
    contratoId: 'df0799c0-98b9-6d9d-bc4a-7d6f5b77000d',
    oportunidadeId: OP_ID,
    status: 'ASSOCIADA',
    justificativa: 'Associacao assistida',
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 1.99,
    contratoStatus: 'ASSINADO',
    cobranca: null,
    dataCriacao: DATA,
  };
}
