import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmpresaCredoraResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CredoraContextStore, CredoraPresenca } from '../../../core/credores/credora-context.store';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { CredoraHomeComponent } from './home.component';

// HeaderMobileComponent (usado pela home) injeta AuthService; stub minimo com o que ele le.
const authStub = { currentUser: signal(null), logout: async () => undefined };

function credoraFixture(over: Partial<EmpresaCredoraResponse> = {}): EmpresaCredoraResponse {
  return {
    id: 'cred-1',
    usuarioId: 'usuario-secreto-123',
    onboardingId: 'onboarding-secreto-456',
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Credora Alfa LTDA',
    status: 'ATIVA',
    elegibilidade: 'ELEGIVEL',
    motivoInelegibilidade: null,
    tipoCredora: 'EMPRESA',
    capacidadeAporte: 100000,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

interface Cenario {
  estado?: CredoraPresenca;
  credora?: EmpresaCredoraResponse | null;
  oportunidades?: () => Promise<unknown[]>;
  carteira?: () => Promise<unknown[]>;
}

async function setup(c: Cenario = {}) {
  const store = {
    estado: signal<CredoraPresenca>(c.estado ?? 'presente'),
    credora: signal<EmpresaCredoraResponse | null>(
      c.credora === undefined ? credoraFixture() : c.credora,
    ),
    carregar: async () => store.estado(),
  };
  const service = {
    listarOportunidades: c.oportunidades ?? (async () => [{}, {}, {}]),
    listarCarteira: c.carteira ?? (async () => [{}]),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CredoraContextStore, useValue: store },
      { provide: CredoraMobileService, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(CredoraHomeComponent);
  // Aguarda o carregamento assincrono (presenca + contagens) de forma deterministica antes de
  // renderizar; o detectChanges seguinte tambem dispara ngOnInit (recarga redundante inofensiva).
  await fixture.componentInstance.carregar();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CredoraHomeComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('presente: razao social, tipo e status/elegibilidade', async () => {
    const el = await setup();
    expect(el.querySelector('[data-testid="sep-credora-razao"]')?.textContent).toContain(
      'Credora Alfa LTDA',
    );
    expect(el.querySelector('[data-testid="sep-credora-tipo"]')?.textContent).toContain('Empresa');
    expect(el.querySelector('[data-testid="sep-credora-status-cadastral"]')?.textContent).toContain(
      'Ativa',
    );
    expect(
      el.querySelector('[data-testid="sep-credora-status-elegibilidade"]')?.textContent,
    ).toContain('Elegivel');
  });

  it('presente: atalhos para perfil, oportunidades e carteira', async () => {
    const el = await setup();
    expect(el.querySelector('[data-testid="sep-credora-atalho-perfil"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-atalho-oportunidades"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-atalho-carteira"]')).not.toBeNull();
  });

  it('contagens refletem o tamanho das listas', async () => {
    const el = await setup();
    expect(
      el.querySelector('[data-testid="sep-credora-oportunidades-count"]')?.textContent,
    ).toContain('3 oportunidades');
    expect(el.querySelector('[data-testid="sep-credora-carteira-count"]')?.textContent).toContain(
      '1 operacoes',
    );
  });

  it('falha parcial de uma lista nao apaga o perfil nem a outra contagem', async () => {
    const el = await setup({
      carteira: async () => {
        throw new Error('erro carteira');
      },
    });
    // perfil segue visivel
    expect(el.querySelector('[data-testid="sep-credora-razao"]')).not.toBeNull();
    // oportunidades ainda conta; carteira cai no texto de fallback
    expect(
      el.querySelector('[data-testid="sep-credora-oportunidades-count"]')?.textContent,
    ).toContain('3 oportunidades');
    expect(el.querySelector('[data-testid="sep-credora-carteira-count"]')?.textContent).toContain(
      'Ver operacoes',
    );
  });

  it('erro tecnico mostra retry, nao dashboard', async () => {
    const el = await setup({ estado: 'erro', credora: null });
    expect(el.querySelector('[data-testid="sep-credora-retry"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-razao"]')).toBeNull();
  });

  it('ausente (404) nao vira dashboard vazio', async () => {
    const el = await setup({ estado: 'ausente', credora: null });
    expect(el.querySelector('[data-testid="sep-credora-ausente"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-razao"]')).toBeNull();
  });

  it('nao expoe identificadores internos (usuarioId/onboardingId) no DOM', async () => {
    const el = await setup();
    expect(el.innerHTML).not.toContain('usuario-secreto-123');
    expect(el.innerHTML).not.toContain('onboarding-secreto-456');
  });
});
