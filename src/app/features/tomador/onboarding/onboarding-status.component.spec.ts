import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ResultadoOnboardingResponse, StatusOnboarding } from '../../../core/api/api.models';
import { OnboardingStatusComponent } from './onboarding-status.component';

// Componente Ionic-free: pode renderizar no happy-dom.
function setup(status: StatusOnboarding, resultado: ResultadoOnboardingResponse | null = null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(OnboardingStatusComponent);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('resultado', resultado);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function variante(el: HTMLElement): string {
  return el.querySelector('[data-testid="sep-onboarding-status-badge"]')?.className ?? '';
}

describe('OnboardingStatusComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('aprovado final usa variante aprovado', () => {
    expect(variante(setup('APROVADO_FINAL'))).toContain('is-aprovado');
  });

  it('reprovado por PLD usa variante reprovado', () => {
    expect(variante(setup('REPROVADO_PLD'))).toContain('is-reprovado');
  });

  it('pendencia usa variante pendente', () => {
    expect(variante(setup('PENDENCIA'))).toContain('is-pendente');
  });

  it('em verificacao usa variante andamento', () => {
    expect(variante(setup('EM_VERIFICACAO'))).toContain('is-andamento');
  });

  it('exibe resultado com motivo quando presente', () => {
    const el = setup('REPROVADO', {
      statusFinal: 'REPROVADO',
      motivo: 'Documento ilegivel',
      dataResultado: '2026-06-18T10:00:00-03:00',
    });
    expect(el.querySelector('[data-testid="sep-onboarding-status-result"]')?.textContent).toContain(
      'Documento ilegivel',
    );
  });

  it('omite linha de resultado quando ausente', () => {
    const el = setup('EM_VERIFICACAO');
    expect(el.querySelector('[data-testid="sep-onboarding-status-result"]')).toBeNull();
  });
});
