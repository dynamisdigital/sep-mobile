import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusProposta } from '../../../core/api/api.models';
import { PropostaStatusComponent } from './proposta-status.component';

// O componente renderiza apenas um <span> (sem Ionic), entao monta no happy-dom.
function badgeCom(status: StatusProposta): HTMLElement {
  const fixture = TestBed.createComponent(PropostaStatusComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="sep-proposta-status"]',
  ) as HTMLElement;
}

describe('PropostaStatusComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const casos: { status: StatusProposta; rotulo: string; variante: string }[] = [
    { status: 'EM_ANALISE', rotulo: 'Em analise', variante: 'andamento' },
    { status: 'PRE_APROVADA', rotulo: 'Pre-aprovada', variante: 'andamento' },
    { status: 'PENDENCIA', rotulo: 'Pendencia', variante: 'pendente' },
    { status: 'APROVADA', rotulo: 'Aprovada', variante: 'aprovado' },
    { status: 'REJEITADA', rotulo: 'Rejeitada', variante: 'reprovado' },
  ];

  for (const caso of casos) {
    it(`mapeia ${caso.status} para "${caso.rotulo}" / variante "${caso.variante}"`, () => {
      const badge = badgeCom(caso.status);
      expect(badge.textContent?.trim()).toBe(caso.rotulo);
      expect(badge.getAttribute('data-variante')).toBe(caso.variante);
    });
  }

  it('PRE_APROVADA nao usa o tom de aprovacao final', () => {
    expect(badgeCom('PRE_APROVADA').getAttribute('data-variante')).not.toBe('aprovado');
  });
});
