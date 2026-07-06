import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusPixParcelaPublico } from '../../core/api/api.models';
import { PixStatusParcelaComponent } from './pix-status-parcela.component';

// O componente renderiza apenas um <span> (sem Ionic), entao monta no happy-dom.
function badgeCom(status: StatusPixParcelaPublico): HTMLElement {
  const fixture = TestBed.createComponent(PixStatusParcelaComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="sep-pix-status-parcela"]',
  ) as HTMLElement;
}

describe('PixStatusParcelaComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  // Mapa exaustivo do union StatusPixParcelaPublico.
  const casos: { status: StatusPixParcelaPublico; rotulo: string; tone: string }[] = [
    { status: 'AGUARDANDO', rotulo: 'Aguardando', tone: 'neutral' },
    { status: 'EM_PROCESSAMENTO', rotulo: 'Em processamento', tone: 'info' },
    { status: 'LIQUIDADO', rotulo: 'Liquidado', tone: 'success' },
    { status: 'DIVERGENTE', rotulo: 'Em verificacao', tone: 'warning' },
    { status: 'FALHOU', rotulo: 'Falhou', tone: 'danger' },
    { status: 'EXPIRADO', rotulo: 'Expirado', tone: 'neutral' },
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
