import { DOCUMENT, Location } from '@angular/common';
import { Injectable, Injector, OnDestroy, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Platform } from '@ionic/angular/standalone';
import type { Subscription } from 'rxjs';

import { ThemeService } from '../theme/theme.service';
import { PlatformService } from './platform.service';

/**
 * Prioridade minima: roda somente depois dos handlers do Ionic (overlays em
 * prioridade alta; navegacao do IonRouterOutlet em 0) declinarem o evento.
 */
const BACK_BUTTON_FALLBACK_PRIORITY = -1;

/** Rotas onde o botao voltar do Android encerra o app de forma previsivel. */
const EXIT_ROUTES = new Set(['/', '/welcome', '/login', '/app/inicio', '/app/credora/inicio']);

/** Scheme oficial do deep link Android (AndroidManifest.xml). */
const DEEP_LINK_SCHEME = 'com.dynamis.sep.mobile:';

/** Prefixos de rota aceitos via deep link; o resto e rejeitado em silencio. */
const DEEP_LINK_ALLOWED_PREFIXES = ['/welcome', '/login', '/register', '/app'];

/**
 * Integracao do runtime nativo Android (M-Sprint 13).
 *
 * No web/PWA {@link init} e no-op: nenhum listener registrado, nenhum plugin
 * chamado — o comportamento das jornadas existentes permanece intacto. No
 * runtime nativo:
 *
 * - status bar segue o tema claro/escuro do {@link ThemeService};
 * - botao voltar fisico ganha fallback previsivel (sai do app somente nas
 *   raizes conhecidas; fora delas volta ao ponto de entrada `/`);
 * - deep links `com.dynamis.sep.mobile://` navegam pelo Router — e portanto
 *   pelos guards — somente para rotas da allowlist; URL desconhecida e
 *   descartada sem log (pode conter token/PII).
 *
 * Falha de plugin nunca derruba sessao nem navegacao: toda chamada nativa e
 * isolada em try/catch.
 */
@Injectable({ providedIn: 'root' })
export class NativeRuntimeService implements OnDestroy {
  private readonly platformService = inject(PlatformService);
  private readonly themeService = inject(ThemeService);
  private readonly ionicPlatform = inject(Platform);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  private initialized = false;
  private appUrlOpenHandle: PluginListenerHandle | null = null;
  private backButtonSubscription: Subscription | null = null;

  async init(): Promise<void> {
    if (this.initialized || !this.platformService.isNative()) {
      return;
    }
    this.initialized = true;

    this.syncStatusBarWithTheme();
    this.registerBackButtonFallback();
    await this.registerDeepLinkListener();
  }

  ngOnDestroy(): void {
    void this.appUrlOpenHandle?.remove();
    this.appUrlOpenHandle = null;
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = null;
  }

  /** Aplica o estilo atual e reaplica a cada troca de tema. */
  private syncStatusBarWithTheme(): void {
    effect(
      () => {
        const dark = this.themeService.isDark();
        void this.applyStatusBarStyle(dark);
      },
      { injector: this.injector },
    );
  }

  private async applyStatusBarStyle(dark: boolean): Promise<void> {
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    } catch {
      // Status bar e cosmetica; falha do plugin nao pode afetar o app.
    }
  }

  private registerBackButtonFallback(): void {
    this.backButtonSubscription = this.ionicPlatform.backButton.subscribeWithPriority(
      BACK_BUTTON_FALLBACK_PRIORITY,
      () => {
        void this.handleBackButtonFallback();
      },
    );
  }

  private async handleBackButtonFallback(): Promise<void> {
    const path = this.stripQueryAndFragment(this.router.url);
    if (EXIT_ROUTES.has(path)) {
      try {
        await App.exitApp();
      } catch {
        // Sem exitApp (ex.: plugin indisponivel), permanecer na tela e seguro.
      }
      return;
    }
    // Fora das raizes, volta uma entrada do historico. Se o destino for tela
    // publica com sessao ativa, o redirectAuthenticatedGuard devolve o usuario
    // a home autenticada — a fronteira de autenticacao permanece intacta.
    // Historico vazio (cold start direto em rota interna): Location.back()
    // seria no-op e deixaria o usuario preso; volta ao ponto de entrada.
    const historyLength = this.document.defaultView?.history.length ?? 0;
    if (historyLength > 1) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl('/');
  }

  private async registerDeepLinkListener(): Promise<void> {
    try {
      this.appUrlOpenHandle = await App.addListener('appUrlOpen', ({ url }) => {
        this.handleDeepLink(url);
      });
    } catch {
      // Sem listener o app segue utilizavel; deep links apenas nao abrem.
    }
  }

  private handleDeepLink(url: string): void {
    const path = this.extractAllowedPath(url);
    if (path !== null) {
      void this.router.navigateByUrl(path);
    }
  }

  /**
   * Traduz a URL externa para uma rota interna permitida. Retorna `null`
   * (rejeicao silenciosa) para scheme errado, URL malformada ou rota fora da
   * allowlist. Nunca registra a URL bruta em log.
   */
  private extractAllowedPath(rawUrl: string): string | null {
    if (this.contemDotSegment(rawUrl)) {
      return null;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== DEEP_LINK_SCHEME) {
      return null;
    }
    const path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, '') || '/';
    const allowed = DEEP_LINK_ALLOWED_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    return allowed ? `${path}${parsed.search}` : null;
  }

  private stripQueryAndFragment(url: string): string {
    return url.split(/[?#]/, 1)[0];
  }

  /**
   * Rejeicao conservadora de path traversal: nenhuma rota legitima do app
   * contem `..`, entao qualquer ocorrencia (inclusive percent-encoded, que a
   * normalizacao da URL nao cobre em path opaco) derruba o deep link inteiro.
   */
  private contemDotSegment(rawUrl: string): boolean {
    return rawUrl.toLowerCase().replace(/%2e/g, '.').includes('..');
  }
}
