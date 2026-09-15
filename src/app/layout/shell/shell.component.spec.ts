import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { NotificacoesNaoLidasStore } from '../../core/notificacoes/notificacoes-nao-lidas.store';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  it('class is defined', () => {
    expect(ShellComponent).toBeDefined();
  });

  // O shell e o unico gatilho de montagem: os headers das paginas so leem o store.
  it('pede a contagem de nao lidas uma vez ao montar', () => {
    const carregar = vi.fn().mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: NotificacoesNaoLidasStore, useValue: { carregar } }],
    });

    TestBed.runInInjectionContext(() => new ShellComponent());

    expect(carregar).toHaveBeenCalledTimes(1);
  });
});
