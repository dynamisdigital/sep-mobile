import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { Platform } from '@ionic/angular/standalone';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeService } from '../theme/theme.service';
import { NativeRuntimeService } from './native-runtime.service';
import { PlatformService } from './platform.service';

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(async () => undefined),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn(async () => undefined),
  },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}));

describe('NativeRuntimeService', () => {
  let service: NativeRuntimeService;
  let themeService: ThemeService;

  const platformServiceMock = { isNative: vi.fn(() => true) };
  const routerMock = { url: '/app/inicio', navigateByUrl: vi.fn(async () => true) };
  const backButtonUnsubscribe = vi.fn();
  const ionicPlatformMock = {
    backButton: {
      subscribeWithPriority: vi.fn(() => ({ unsubscribe: backButtonUnsubscribe })),
    },
  };
  const listenerHandle = { remove: vi.fn(async () => undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('SEP_THEME');
    platformServiceMock.isNative.mockReturnValue(true);
    routerMock.url = '/app/inicio';
    vi.mocked(App.addListener).mockResolvedValue(
      listenerHandle as unknown as Awaited<ReturnType<typeof App.addListener>>,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformService, useValue: platformServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: Platform, useValue: ionicPlatformMock },
      ],
    });
    themeService = TestBed.inject(ThemeService);
    service = TestBed.inject(NativeRuntimeService);
  });

  function capturarDeepLinkCallback(): (event: { url: string }) => void {
    const chamada = vi.mocked(App.addListener).mock.calls.at(0);
    expect(chamada?.[0]).toBe('appUrlOpen');
    return chamada?.[1] as (event: { url: string }) => void;
  }

  function capturarBackButtonHandler(): () => void {
    const chamada = ionicPlatformMock.backButton.subscribeWithPriority.mock.calls.at(0) as
      | [number, () => void]
      | undefined;
    return chamada?.[1] as () => void;
  }

  it('no web nao registra listener nem toca status bar', async () => {
    platformServiceMock.isNative.mockReturnValue(false);
    await service.init();
    TestBed.tick();

    expect(App.addListener).not.toHaveBeenCalled();
    expect(ionicPlatformMock.backButton.subscribeWithPriority).not.toHaveBeenCalled();
    expect(StatusBar.setStyle).not.toHaveBeenCalled();
  });

  it('no nativo registra deep link, back button e status bar conforme tema', async () => {
    await service.init();
    TestBed.tick();

    expect(App.addListener).toHaveBeenCalledTimes(1);
    expect(ionicPlatformMock.backButton.subscribeWithPriority).toHaveBeenCalledWith(
      -1,
      expect.any(Function),
    );
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('reaplica estilo da status bar quando o tema muda', async () => {
    await service.init();
    TestBed.tick();
    vi.mocked(StatusBar.setStyle).mockClear();

    themeService.setTheme('dark');
    TestBed.tick();

    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: 'DARK' });
  });

  it('init duplicado nao registra listeners duas vezes', async () => {
    await service.init();
    await service.init();

    expect(App.addListener).toHaveBeenCalledTimes(1);
    expect(ionicPlatformMock.backButton.subscribeWithPriority).toHaveBeenCalledTimes(1);
  });

  it('falha do plugin de status bar nao derruba o init', async () => {
    vi.mocked(StatusBar.setStyle).mockRejectedValue(new Error('plugin indisponivel'));

    await expect(service.init()).resolves.toBeUndefined();
    TestBed.tick();
    expect(App.addListener).toHaveBeenCalledTimes(1);
  });

  describe('deep links', () => {
    it('navega para rota da allowlist preservando query', async () => {
      await service.init();
      const callback = capturarDeepLinkCallback();

      callback({ url: 'com.dynamis.sep.mobile://app/propostas/123?origem=push' });

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/app/propostas/123?origem=push');
    });

    it('aceita raiz exata da allowlist com barra final', async () => {
      await service.init();
      const callback = capturarDeepLinkCallback();

      callback({ url: 'com.dynamis.sep.mobile://welcome/' });

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/welcome');
    });

    it('rejeita scheme desconhecido', async () => {
      await service.init();
      const callback = capturarDeepLinkCallback();

      callback({ url: 'https://evil.example/app/inicio' });

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('rejeita rota fora da allowlist', async () => {
      await service.init();
      const callback = capturarDeepLinkCallback();

      callback({ url: 'com.dynamis.sep.mobile://design-system' });

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('ignora URL malformada sem lancar erro', async () => {
      await service.init();
      const callback = capturarDeepLinkCallback();

      expect(() => callback({ url: 'nao-e-uma-url' })).not.toThrow();
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('botao voltar (fallback)', () => {
    it('sai do app nas rotas raiz', async () => {
      await service.init();
      routerMock.url = '/app/inicio';

      capturarBackButtonHandler()();
      await vi.waitFor(() => expect(App.exitApp).toHaveBeenCalledTimes(1));

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('fora da raiz volta ao ponto de entrada sem sair do app', async () => {
      await service.init();
      routerMock.url = '/app/perfil?aba=dados';

      capturarBackButtonHandler()();
      await vi.waitFor(() => expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/'));

      expect(App.exitApp).not.toHaveBeenCalled();
    });
  });

  it('destroy remove listener e cancela assinatura do back button', async () => {
    await service.init();

    service.ngOnDestroy();

    expect(listenerHandle.remove).toHaveBeenCalledTimes(1);
    expect(backButtonUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
