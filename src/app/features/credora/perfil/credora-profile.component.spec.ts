import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmpresaCredoraResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CredoraContextStore, CredoraPresenca } from '../../../core/credores/credora-context.store';
import { CredoraProfileComponent } from './credora-profile.component';

// HeaderMobileComponent (usado pelo perfil) injeta AuthService; stub minimo.
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

async function setup(estado: CredoraPresenca, credora: EmpresaCredoraResponse | null) {
  const store = {
    estado: signal<CredoraPresenca>(estado),
    credora: signal<EmpresaCredoraResponse | null>(credora),
    carregar: async () => estado,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authStub },
      { provide: CredoraContextStore, useValue: store },
    ],
  });
  const fixture = TestBed.createComponent(CredoraProfileComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CredoraProfileComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('exibe CNPJ formatado, tipo, capacidade, datas e status', async () => {
    const el = await setup('presente', credoraFixture());
    expect(el.querySelector('[data-testid="sep-credora-perfil-cnpj"]')?.textContent).toContain(
      '11.222.333/0001-81',
    );
    expect(el.querySelector('[data-testid="sep-credora-perfil-tipo"]')?.textContent).toContain(
      'Empresa',
    );
    expect(
      el.querySelector('[data-testid="sep-credora-perfil-capacidade"]')?.textContent,
    ).toContain('R$');
    expect(
      el.querySelector('[data-testid="sep-credora-status-elegibilidade"]')?.textContent,
    ).toContain('Elegivel');
  });

  it('omite capacidade quando nula (sem zero inventado)', async () => {
    const el = await setup('presente', credoraFixture({ capacidadeAporte: null }));
    expect(el.querySelector('[data-testid="sep-credora-perfil-capacidade"]')).toBeNull();
  });

  it('mostra motivo apenas quando inelegivel com motivo', async () => {
    const el = await setup(
      'presente',
      credoraFixture({
        status: 'SUSPENSA',
        elegibilidade: 'INELEGIVEL',
        motivoInelegibilidade: 'Pendencia documental',
      }),
    );
    expect(el.querySelector('[data-testid="sep-credora-perfil-motivo"]')?.textContent).toContain(
      'Pendencia documental',
    );
    // copy neutra do status
    expect(el.querySelector('[data-testid="sep-credora-status-cadastral"]')?.textContent).toContain(
      'Suspensa',
    );
  });

  it('sem motivo quando nao ha motivoInelegibilidade', async () => {
    const el = await setup('presente', credoraFixture());
    expect(el.querySelector('[data-testid="sep-credora-perfil-motivo"]')).toBeNull();
  });

  it('nao expoe usuarioId nem onboardingId', async () => {
    const el = await setup('presente', credoraFixture());
    expect(el.innerHTML).not.toContain('usuario-secreto-123');
    expect(el.innerHTML).not.toContain('onboarding-secreto-456');
  });

  it('erro mostra retry; ausente mostra copy neutra', async () => {
    const erro = await setup('erro', null);
    expect(erro.querySelector('[data-testid="sep-credora-perfil-retry"]')).not.toBeNull();

    const ausente = await setup('ausente', null);
    expect(ausente.querySelector('[data-testid="sep-credora-perfil-ausente"]')).not.toBeNull();
    expect(ausente.querySelector('[data-testid="sep-credora-perfil-razao"]')).toBeNull();
  });
});
