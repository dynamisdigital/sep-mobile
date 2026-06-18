import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { OnboardingMobileService } from '../../../core/onboarding/onboarding-mobile.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { OnboardingShellComponent } from './onboarding-shell.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

// O passo de dados renderiza ion-input (que nao monta no happy-dom). Por isso a etapa
// de selecao e testada via DOM e a orquestracao (iniciar/erro/avanco) via instancia,
// como na convencao do repo (login/register).
function setupDom(onboardingStub: Partial<OnboardingMobileService> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal<UsuarioResponse | null>(cliente) } },
      { provide: ThemeService, useValue: { isDark: signal(false), toggle: () => undefined } },
      { provide: OnboardingMobileService, useValue: onboardingStub },
    ],
  });
  const fixture = TestBed.createComponent(OnboardingShellComponent);
  fixture.detectChanges();
  return fixture;
}

function build(onboardingStub: Partial<OnboardingMobileService> = {}): OnboardingShellComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: OnboardingMobileService, useValue: onboardingStub }],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new OnboardingShellComponent());
}

describe('OnboardingShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('inicia exibindo titulo e selecao PF/PJ, sem progresso', () => {
    const el = setupDom().nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sep-onboarding-title"]')?.textContent).toContain(
      'Onboarding',
    );
    expect(el.querySelector('[data-testid="sep-onboarding-choice-pf"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-onboarding-choice-pj"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-onboarding-steps"]')).toBeNull();
  });

  it('oferece retorno para a home do tomador', () => {
    const el = setupDom().nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sep-onboarding-back"]')?.getAttribute('href')).toBe(
      '/app/inicio',
    );
  });

  it('selecionar PF avanca a etapa para dados', () => {
    const component = build();
    expect(component.etapa()).toBe('selecionar');
    component.selecionarTipo('PF');
    expect(component.tipo()).toBe('PF');
    expect(component.etapa()).toBe('dados');
  });

  it('voltarSelecao retorna para a escolha de tipo', () => {
    const component = build();
    component.selecionarTipo('PJ');
    component.voltarSelecao();
    expect(component.tipo()).toBeNull();
    expect(component.etapa()).toBe('selecionar');
  });

  it('submit PF valido chama iniciarPessoa e avanca para documentos', async () => {
    const iniciarPessoa = vi.fn().mockResolvedValue({
      id: 'pf-1',
      status: 'INICIADO',
      dataCriacao: 'x',
      dataModificacao: 'x',
    });
    const component = build({ iniciarPessoa });
    component.selecionarTipo('PF');
    const payload = {
      cpf: '12345678901',
      nomeCompleto: 'Maria da Silva',
      dataNascimento: '1990-05-12',
    };
    await component.onIniciarPessoa(payload);
    expect(iniciarPessoa).toHaveBeenCalledWith(payload);
    expect(component.onboardingId()).toBe('pf-1');
    expect(component.etapa()).toBe('documentos');
  });

  it('submit PJ valido chama iniciarEmpresa', async () => {
    const iniciarEmpresa = vi.fn().mockResolvedValue({
      id: 'pj-1',
      status: 'INICIADO',
      cnpj: '12.345.678/0001-90',
      razaoSocial: 'Acme',
      dataCriacao: 'x',
      dataModificacao: 'x',
    });
    const component = build({ iniciarEmpresa });
    const payload = {
      cnpj: '12345678000190',
      razaoSocial: 'Acme Ltda',
      nomeFantasia: 'Acme',
      tipoSocietario: 'LTDA' as const,
      porte: 'ME' as const,
    };
    await component.onIniciarEmpresa(payload);
    expect(iniciarEmpresa).toHaveBeenCalledWith(payload);
    expect(component.onboardingId()).toBe('pj-1');
  });

  it('erro do backend vira feedback amigavel e mantem a etapa de dados', async () => {
    const erro = new HttpErrorResponse({ status: 400, error: { message: 'CPF invalido' } });
    const iniciarPessoa = vi.fn().mockRejectedValue(erro);
    const component = build({ iniciarPessoa });
    component.selecionarTipo('PF');
    await component.onIniciarPessoa({
      cpf: '12345678901',
      nomeCompleto: 'Maria',
      dataNascimento: '1990-05-12',
    });
    expect(component.errorMessage()).toBe('CPF invalido');
    expect(component.etapa()).toBe('dados');
  });
});
