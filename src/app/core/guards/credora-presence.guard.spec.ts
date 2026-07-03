import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CredoraContextStore, CredoraPresenca } from '../credores/credora-context.store';
import { credoraPresenceGuard } from './credora-presence.guard';

function setup(presenca: CredoraPresenca) {
  const store = { carregar: vi.fn().mockResolvedValue(presenca) };
  const router = { parseUrl: vi.fn((url: string) => ({ url }) as unknown as UrlTree) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CredoraContextStore, useValue: store },
      { provide: Router, useValue: router },
    ],
  });
  return { store, router };
}

async function run() {
  return TestBed.runInInjectionContext(() =>
    credoraPresenceGuard({} as never, { url: '/app/credora/inicio' } as never),
  );
}

describe('credoraPresenceGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('presente libera o acesso', async () => {
    setup('presente');
    await expect(run()).resolves.toBe(true);
  });

  it('ausente redireciona para a home neutra do app', async () => {
    const { router } = setup('ausente');
    const resultado = await run();
    expect(router.parseUrl).toHaveBeenCalledWith('/app/inicio');
    expect(resultado).toMatchObject({ url: '/app/inicio' });
  });

  it('erro tecnico nao conclui "nao e credora": libera para a tela mostrar retry', async () => {
    const { router } = setup('erro');
    await expect(run()).resolves.toBe(true);
    expect(router.parseUrl).not.toHaveBeenCalled();
  });
});
