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

  /**
   * FMF-4.1: fiacao com `core/format/data`. Antes, `null` virava `31/12/1969` na tela (em -03) e
   * texto invalido lancava `RangeError` dentro do template, derrubando a pagina. O contrato completo
   * esta em `core/format/data.spec.ts`; aqui se prova que **este** componente passa por ele.
   */
  it('data invalida nao vira 1969 nem derruba a tela', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const component = runInInjectionContext(injector, () => new ContratoContentComponent());
    const view = component as unknown as { dataFormatada(iso: string): string };

    expect(view.dataFormatada(null as unknown as string)).toBe('');
    expect(() => view.dataFormatada('lixo')).not.toThrow();
  });
});
