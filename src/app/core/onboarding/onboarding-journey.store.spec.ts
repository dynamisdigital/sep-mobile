import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(({ key }: { key: string }) => Promise.resolve({ value: mem.get(key) ?? null })),
    set: vi.fn(({ key, value }: { key: string; value: string }) => {
      mem.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn(({ key }: { key: string }) => {
      mem.delete(key);
      return Promise.resolve();
    }),
  },
}));

import { OnboardingJourneyStore } from './onboarding-journey.store';

describe('OnboardingJourneyStore', () => {
  let store: OnboardingJourneyStore;

  beforeEach(() => {
    mem.clear();
    store = new OnboardingJourneyStore();
  });

  it('salva e recupera a jornada', async () => {
    await store.salvar({ tipo: 'PF', onboardingId: 'abc' });
    expect(await store.carregar()).toEqual({ tipo: 'PF', onboardingId: 'abc' });
  });

  it('carregar retorna null sem jornada salva', async () => {
    expect(await store.carregar()).toBeNull();
  });

  it('limpar remove a jornada', async () => {
    await store.salvar({ tipo: 'PJ', onboardingId: 'xyz' });
    await store.limpar();
    expect(await store.carregar()).toBeNull();
  });

  it('carregar retorna null com conteudo corrompido', async () => {
    mem.set('sep.onboarding.journey', '{corrompido');
    expect(await store.carregar()).toBeNull();
  });
});
