import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusParcela } from '../../../core/api/api.models';
import { ParcelaStatusComponent } from './parcela-status.component';

// O componente renderiza apenas um <span> (sem Ionic), entao monta no happy-dom.
function badgeCom(status: StatusParcela): HTMLElement {
  const fixture = TestBed.createComponent(ParcelaStatusComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="sep-parcela-status"]',
  ) as HTMLElement;
}

describe('ParcelaStatusComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  // Mapa exaustivo do union StatusParcela: cada estado tem rotulo textual e tom proprio.
  const casos: { status: StatusParcela; rotulo: string; tone: string }[] = [
    { status: 'PENDENTE', rotulo: 'Pendente', tone: 'neutral' },
    { status: 'PARCIALMENTE_PAGA', rotulo: 'Parcialmente paga', tone: 'info' },
    { status: 'PAGA', rotulo: 'Paga', tone: 'success' },
    { status: 'ATRASADA', rotulo: 'Atrasada', tone: 'warning' },
    { status: 'INADIMPLENTE', rotulo: 'Inadimplente', tone: 'danger' },
    { status: 'EM_NEGOCIACAO', rotulo: 'Em negociacao', tone: 'info' },
    { status: 'RENEGOCIADA', rotulo: 'Renegociada', tone: 'neutral' },
  ];

  for (const caso of casos) {
    it(`mapeia ${caso.status} para "${caso.rotulo}" / tom "${caso.tone}"`, () => {
      const badge = badgeCom(caso.status);
      // Texto sempre presente: a cor nunca e a unica informacao.
      expect(badge.textContent?.trim()).toBe(caso.rotulo);
      expect(badge.getAttribute('data-tone')).toBe(caso.tone);
    });
  }
});
