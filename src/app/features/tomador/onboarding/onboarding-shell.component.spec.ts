import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingJourneyStore } from '../../../core/onboarding/onboarding-journey.store';
import { OnboardingMobileService } from '../../../core/onboarding/onboarding-mobile.service';
import { OnboardingShellComponent } from './onboarding-shell.component';

// Toda a orquestracao e testada via instancia (o template usa ion-input/ion-select, que
// nao montam no happy-dom), seguindo a convencao do repo (login/register).
function build(onboarding: Partial<OnboardingMobileService> = {}, journeyOverrides = {}) {
  const journey = {
    carregar: vi.fn().mockResolvedValue(null),
    salvar: vi.fn().mockResolvedValue(undefined),
    limpar: vi.fn().mockResolvedValue(undefined),
    ...journeyOverrides,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: OnboardingMobileService, useValue: onboarding },
      { provide: OnboardingJourneyStore, useValue: journey },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new OnboardingShellComponent());
  return { component, journey };
}

function statusPf(documentosEnviados: { id: string; tipo: string }[] = [], extra = {}) {
  return {
    id: 'pf-1',
    status: 'DOCUMENTOS_RECEBIDOS',
    dataCriacao: 'x',
    dataModificacao: 'x',
    documentosEnviados,
    resultado: null,
    ...extra,
  };
}

describe('OnboardingShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('inicia na selecao e avanca para dados ao escolher PF', () => {
    const { component } = build();
    expect(component.etapa()).toBe('selecionar');
    component.selecionarTipo('PF');
    expect(component.tipo()).toBe('PF');
    expect(component.etapa()).toBe('dados');
  });

  it('voltarSelecao retorna para a escolha de tipo', () => {
    const { component } = build();
    component.selecionarTipo('PJ');
    component.voltarSelecao();
    expect(component.tipo()).toBeNull();
    expect(component.etapa()).toBe('selecionar');
  });

  it('submit PF chama iniciarPessoa, persiste a jornada e avanca para documentos', async () => {
    const iniciarPessoa = vi.fn().mockResolvedValue({
      id: 'pf-1',
      status: 'INICIADO',
      dataCriacao: 'x',
      dataModificacao: 'x',
    });
    const consultarPessoa = vi.fn().mockResolvedValue(statusPf());
    const { component, journey } = build({ iniciarPessoa, consultarPessoa });
    component.selecionarTipo('PF');
    const payload = { cpf: '12345678901', nomeCompleto: 'Maria', dataNascimento: '1990-05-12' };

    await component.onIniciarPessoa(payload);

    expect(iniciarPessoa).toHaveBeenCalledWith(payload);
    expect(journey.salvar).toHaveBeenCalledWith({ tipo: 'PF', onboardingId: 'pf-1' });
    expect(consultarPessoa).toHaveBeenCalledWith('pf-1');
    expect(component.etapa()).toBe('documentos');
    expect(component.status()).not.toBeNull();
  });

  it('submit PJ chama iniciarEmpresa e persiste a jornada', async () => {
    const iniciarEmpresa = vi.fn().mockResolvedValue({
      id: 'pj-1',
      status: 'INICIADO',
      cnpj: 'x',
      razaoSocial: 'x',
      dataCriacao: 'x',
      dataModificacao: 'x',
    });
    const consultarEmpresa = vi.fn().mockResolvedValue({
      id: 'pj-1',
      status: 'INICIADO',
      dataCriacao: 'x',
      dataModificacao: 'x',
      dadosEmpresa: {
        cnpj: 'x',
        razaoSocial: 'x',
        nomeFantasia: null,
        tipoSocietario: null,
        porte: null,
      },
      documentosEnviados: [],
      representantes: [],
      resultado: null,
    });
    const { component, journey } = build({ iniciarEmpresa, consultarEmpresa });
    component.selecionarTipo('PJ');

    await component.onIniciarEmpresa({ cnpj: '12345678000190', razaoSocial: 'Acme' });

    expect(iniciarEmpresa).toHaveBeenCalled();
    expect(journey.salvar).toHaveBeenCalledWith({ tipo: 'PJ', onboardingId: 'pj-1' });
    expect(consultarEmpresa).toHaveBeenCalledWith('pj-1');
  });

  it('erro ao iniciar vira feedback e mantem a etapa de dados', async () => {
    const erro = new HttpErrorResponse({ status: 400, error: { message: 'CPF invalido' } });
    const iniciarPessoa = vi.fn().mockRejectedValue(erro);
    const { component } = build({ iniciarPessoa });
    component.selecionarTipo('PF');

    await component.onIniciarPessoa({ cpf: '1', nomeCompleto: 'x', dataNascimento: '2000-01-01' });

    expect(component.errorMessage()).toBe('CPF invalido');
    expect(component.etapa()).toBe('dados');
  });

  it('onEnviarDocumento PF envia ao backend e recarrega o status', async () => {
    const arquivo = new File(['x'], 'rg.png', { type: 'image/png' });
    const enviarDocumentoPessoa = vi.fn().mockResolvedValue(undefined);
    const consultarPessoa = vi.fn().mockResolvedValue(statusPf([{ id: 'd1', tipo: 'RG' }]));
    const { component } = build({ enviarDocumentoPessoa, consultarPessoa });
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.onEnviarDocumento({ tipo: 'RG', arquivo });

    expect(enviarDocumentoPessoa).toHaveBeenCalledWith('pf-1', 'RG', arquivo);
    expect(consultarPessoa).toHaveBeenCalledWith('pf-1');
    expect(component.status()?.documentosEnviados).toHaveLength(1);
    expect(component.documentoError()).toBeNull();
  });

  it('erro no upload vira feedback sem derrubar a jornada', async () => {
    const arquivo = new File(['x'], 'rg.png', { type: 'image/png' });
    const erro = new HttpErrorResponse({ status: 400, error: { message: 'Documento invalido' } });
    const enviarDocumentoPessoa = vi.fn().mockRejectedValue(erro);
    const { component } = build({ enviarDocumentoPessoa });
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.onEnviarDocumento({ tipo: 'RG', arquivo });

    expect(component.documentoError()).toBe('Documento invalido');
    expect(component.etapa()).toBe('documentos');
  });

  it('restaura a jornada persistida no ngOnInit e carrega o status', async () => {
    const consultarPessoa = vi.fn().mockResolvedValue(statusPf([{ id: 'd1', tipo: 'RG' }]));
    const { component } = build(
      { consultarPessoa },
      { carregar: vi.fn().mockResolvedValue({ tipo: 'PF', onboardingId: 'pf-9' }) },
    );

    await component.ngOnInit();

    expect(component.tipo()).toBe('PF');
    expect(component.onboardingId()).toBe('pf-9');
    expect(consultarPessoa).toHaveBeenCalledWith('pf-9');
    expect(component.etapa()).toBe('documentos');
  });

  it('irParaStatus e voltarDocumentos alternam a etapa', () => {
    const { component } = build();
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');
    expect(component.etapa()).toBe('documentos');
    component.irParaStatus();
    expect(component.etapa()).toBe('status');
    component.voltarDocumentos();
    expect(component.etapa()).toBe('documentos');
  });

  it('onVerificar PF dispara verificarPessoa e recarrega o status', async () => {
    const verificarPessoa = vi.fn().mockResolvedValue(undefined);
    const consultarPessoa = vi.fn().mockResolvedValue(statusPf([], { status: 'EM_VERIFICACAO' }));
    const { component } = build({ verificarPessoa, consultarPessoa });
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.onVerificar();

    expect(verificarPessoa).toHaveBeenCalledWith('pf-1');
    expect(consultarPessoa).toHaveBeenCalledWith('pf-1');
    expect(component.status()?.status).toBe('EM_VERIFICACAO');
  });

  it('erro ao verificar vira feedback amigavel', async () => {
    const erro = new HttpErrorResponse({
      status: 400,
      error: { message: 'Documentos minimos ausentes' },
    });
    const verificarPessoa = vi.fn().mockRejectedValue(erro);
    const { component } = build({ verificarPessoa });
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.onVerificar();

    expect(component.errorMessage()).toBe('Documentos minimos ausentes');
  });

  it('falha ao consultar status fica visivel em errorMessage', async () => {
    const erro = new HttpErrorResponse({ status: 503, error: { message: 'Servico indisponivel' } });
    const consultarPessoa = vi.fn().mockRejectedValue(erro);
    const { component } = build({ consultarPessoa });
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.atualizarStatus();

    expect(component.errorMessage()).toBe('Servico indisponivel');
  });

  it('recomecar limpa a jornada persistida e volta para a selecao', async () => {
    const { component, journey } = build();
    component.selecionarTipo('PF');
    component.onboardingId.set('pf-1');

    await component.recomecar();

    expect(journey.limpar).toHaveBeenCalled();
    expect(component.tipo()).toBeNull();
    expect(component.onboardingId()).toBeNull();
    expect(component.status()).toBeNull();
    expect(component.etapa()).toBe('selecionar');
  });
});
