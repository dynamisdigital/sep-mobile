import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ContratoContentComponent } from './contrato-content.component';

// Componente apresentacional: a unica logica propria e a formatacao de data; renderizacao e
// wiring de eventos sao validados no detalhe (instance-based) e no smoke Playwright (M-8.5).
describe('ContratoContentComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('formata a data de geracao em pt-BR', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const component = runInInjectionContext(injector, () => new ContratoContentComponent());
    const view = component as unknown as { dataFormatada(iso: string): string };
    expect(view.dataFormatada('2026-06-30T09:00:00-03:00')).toBe('30/06/2026');
  });
});
