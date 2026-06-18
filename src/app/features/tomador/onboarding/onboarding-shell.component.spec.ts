import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
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

function setup() {
  const authStub = { currentUser: signal<UsuarioResponse | null>(cliente) };
  const themeStub = { isDark: signal(false), toggle: () => undefined };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: ThemeService, useValue: themeStub },
    ],
  });
  const fixture = TestBed.createComponent(OnboardingShellComponent);
  fixture.detectChanges();
  return fixture;
}

describe('OnboardingShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renderiza o titulo da jornada de onboarding', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-onboarding-title"]')?.textContent).toContain(
      'Onboarding',
    );
  });

  it('oferece retorno para a home do tomador', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    const back = el.querySelector('[data-testid="sep-onboarding-back"]');
    expect(back?.getAttribute('href')).toBe('/app/inicio');
  });
});
