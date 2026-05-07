import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenStorageService } from './token-storage.service';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(async () => {
    await Preferences.clear();
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  it('retorna null quando nao ha token', async () => {
    expect(await service.getToken()).toBeNull();
  });

  it('persiste e recupera token', async () => {
    await service.setToken('tok-1');
    expect(await service.getToken()).toBe('tok-1');
    expect(Preferences.set).toHaveBeenCalledWith({
      key: 'sep.auth.accessToken',
      value: 'tok-1',
    });
  });

  it('remove token', async () => {
    await service.setToken('tok-2');
    await service.clearToken();
    expect(await service.getToken()).toBeNull();
  });
});
