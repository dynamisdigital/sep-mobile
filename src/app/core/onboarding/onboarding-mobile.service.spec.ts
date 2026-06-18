import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IniciarOnboardingEmpresaRequest, IniciarOnboardingPessoaRequest } from '../api/api.models';
import { OnboardingMobileService } from './onboarding-mobile.service';

const API = 'http://localhost:8080/api/v1';
const PESSOA = `${API}/onboarding/pessoa`;
const EMPRESA = `${API}/onboarding/empresa`;
const ID = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';

describe('OnboardingMobileService', () => {
  let service: OnboardingMobileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OnboardingMobileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('iniciarPessoa POST /onboarding/pessoa com payload PF', async () => {
    const payload: IniciarOnboardingPessoaRequest = {
      cpf: '12345678901',
      nomeCompleto: 'Maria da Silva',
      dataNascimento: '1990-05-12',
    };
    const promise = service.iniciarPessoa(payload);
    const req = httpMock.expectOne(PESSOA);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: ID, status: 'INICIADO', dataCriacao: 'x', dataModificacao: 'x' });
    await expect(promise).resolves.toMatchObject({ id: ID, status: 'INICIADO' });
  });

  it('iniciarEmpresa POST /onboarding/empresa com payload PJ', async () => {
    const payload: IniciarOnboardingEmpresaRequest = {
      cnpj: '12345678000190',
      razaoSocial: 'Acme Ltda',
      nomeFantasia: 'Acme',
      tipoSocietario: 'LTDA',
      porte: 'ME',
    };
    const promise = service.iniciarEmpresa(payload);
    const req = httpMock.expectOne(EMPRESA);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      id: ID,
      status: 'INICIADO',
      cnpj: '12.345.678/0001-90',
      razaoSocial: 'Acme Ltda',
      dataCriacao: 'x',
      dataModificacao: 'x',
    });
    await expect(promise).resolves.toMatchObject({ id: ID });
  });

  it('enviarDocumentoPessoa usa FormData preservando tipo e arquivo', async () => {
    const arquivo = new File(['conteudo'], 'rg.png', { type: 'image/png' });
    const promise = service.enviarDocumentoPessoa(ID, 'RG', arquivo);
    const req = httpMock.expectOne(`${PESSOA}/${ID}/documentos`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('tipo')).toBe('RG');
    expect(body.get('arquivo')).toBe(arquivo);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('enviarDocumentoEmpresa usa FormData com tipo PJ', async () => {
    const arquivo = new File(['conteudo'], 'contrato.pdf', { type: 'application/pdf' });
    const promise = service.enviarDocumentoEmpresa(ID, 'CONTRATO_SOCIAL', arquivo);
    const req = httpMock.expectOne(`${EMPRESA}/${ID}/documentos`);
    const body = req.request.body as FormData;
    expect(body.get('tipo')).toBe('CONTRATO_SOCIAL');
    expect(body.get('arquivo')).toBe(arquivo);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('verificarPessoa POST /onboarding/pessoa/{id}/verificar (202 Accepted)', async () => {
    const promise = service.verificarPessoa(ID);
    const req = httpMock.expectOne(`${PESSOA}/${ID}/verificar`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await promise;
  });

  it('verificarEmpresa POST /onboarding/empresa/{id}/verificar (202 Accepted)', async () => {
    const promise = service.verificarEmpresa(ID);
    const req = httpMock.expectOne(`${EMPRESA}/${ID}/verificar`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await promise;
  });

  it('consultarPessoa propaga StatusOnboardingResponse do backend', async () => {
    const promise = service.consultarPessoa(ID);
    const req = httpMock.expectOne(`${PESSOA}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: ID,
      status: 'EM_VERIFICACAO',
      dataCriacao: 'x',
      dataModificacao: 'x',
      documentosEnviados: [],
      resultado: null,
    });
    await expect(promise).resolves.toMatchObject({ status: 'EM_VERIFICACAO' });
  });

  it('consultarEmpresa propaga StatusOnboardingEmpresaResponse do backend', async () => {
    const promise = service.consultarEmpresa(ID);
    const req = httpMock.expectOne(`${EMPRESA}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: ID,
      status: 'PENDENCIA',
      dataCriacao: 'x',
      dataModificacao: 'x',
      dadosEmpresa: {
        cnpj: '12.345.678/0001-90',
        razaoSocial: 'Acme Ltda',
        nomeFantasia: null,
        tipoSocietario: 'LTDA',
        porte: 'ME',
      },
      documentosEnviados: [],
      representantes: [],
      resultado: null,
    });
    await expect(promise).resolves.toMatchObject({ status: 'PENDENCIA' });
  });

  it('listarRepresentantesEmpresa GET /onboarding/empresa/{id}/representantes', async () => {
    const promise = service.listarRepresentantesEmpresa(ID);
    const req = httpMock.expectOne(`${EMPRESA}/${ID}/representantes`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: ID, nome: 'Joao', cpfMascarado: '123***45', cargo: 'Socio', pld: null }]);
    await expect(promise).resolves.toHaveLength(1);
  });

  it('propaga erro HTTP do backend para tratamento na UI', async () => {
    const promise = service.consultarPessoa(ID);
    const req = httpMock.expectOne(`${PESSOA}/${ID}`);
    req.flush({ message: 'Nao encontrado' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).rejects.toBeDefined();
  });
});
