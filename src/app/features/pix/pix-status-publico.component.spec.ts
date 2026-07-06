import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusPixPublico } from '../../core/api/api.models';
import { PixStatusPublicoComponent } from './pix-status-publico.component';

// O componente renderiza apenas um <span> (sem Ionic), entao monta no happy-dom.
function badgeCom(status: StatusPixPublico): HTMLElement {
  const fixture = TestBed.createComponent(PixStatusPublicoComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="sep-pix-status-publico"]',
  ) as HTMLElement;
}

describe('PixStatusPublicoComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  // Mapa exaustivo do union StatusPixPublico: cada estado tem rotulo textual e tom proprio.
  const casos: { status: StatusPixPublico; rotulo: string; tone: string }[] = [
    { status: 'EM_PROCESSAMENTO', rotulo: 'Em processamento', tone: 'info' },
    { status: 'LIQUIDADO', rotulo: 'Liquidado', tone: 'success' },
    { status: 'FALHOU', rotulo: 'Falhou', tone: 'danger' },
    { status: 'CANCELADO', rotulo: 'Cancelado', tone: 'neutral' },
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
