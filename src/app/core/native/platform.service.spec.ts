import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlatformService } from './platform.service';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformService);
  });

  it('delegar platform() ao Capacitor', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(service.platform()).toBe('android');
  });

  it('delegar isNative() ao Capacitor', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(service.isNative()).toBe(true);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    expect(service.isNative()).toBe(false);
  });

  it('isAndroid() true somente na plataforma android', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    expect(service.isAndroid()).toBe(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    expect(service.isAndroid()).toBe(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    expect(service.isAndroid()).toBe(false);
  });
});
