import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Ponto unico de deteccao do runtime (M-Sprint 13).
 *
 * Todo codigo que precisa distinguir web/PWA de plataforma nativa deve passar
 * por aqui em vez de chamar {@link Capacitor} estaticamente — mantem a
 * deteccao testavel (mock por injecao) e evita espalhar dependencia direta do
 * plugin pelos componentes.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  /** Nome da plataforma: `web`, `android` ou `ios`. */
  platform(): string {
    return Capacitor.getPlatform();
  }

  /** `true` quando o app roda empacotado (Android/iOS), `false` no web/PWA. */
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  isAndroid(): boolean {
    return this.platform() === 'android';
  }
}
