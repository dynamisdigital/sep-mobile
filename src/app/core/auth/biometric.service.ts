import { Injectable, inject, signal } from '@angular/core';

import { PlatformService } from '../native/platform.service';
import { TokenStorageService } from './token-storage.service';

/**
 * M-Sprint 5: wrapper sobre biometria nativa do dispositivo.
 *
 * <p>No PWA/dev-local nao ha API nativa de biometria; este service expoe a
 * mesma superficie do plugin real (@capacitor-community/biometric-auth) com
 * implementacao no-op. A instalacao do plugin e ativacao real entram na fase
 * Android/iOS (Epic 14 Fase Mobile 2). Para hoje, o usuario opta por "confiar
 * neste dispositivo" e a biometria fica como simulacao.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly platformService = inject(PlatformService);

  /** Disponibilidade da biometria nativa no dispositivo. */
  private readonly availableState = signal<boolean>(false);

  readonly available = this.availableState.asReadonly();

  /**
   * Verifica disponibilidade. Em plataforma nativa, vai consultar o plugin
   * Capacitor real (quando instalado em fase posterior). No web/PWA, retorna
   * {@code false} para forcar fallback TOTP.
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.platformService.isNative()) {
      this.availableState.set(false);
      return false;
    }
    // Quando plugin nativo estiver disponivel, verificar via:
    // const result = await NativeBiometric.isAvailable();
    // this.availableState.set(result.isAvailable);
    this.availableState.set(false);
    return false;
  }

  /**
   * Solicita autenticacao biometrica. Retorna {@code true} se confirmada,
   * {@code false} se cancelada/indisponivel.
   */
  async authenticate(motivo: string): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }
    // Plugin nativo (em fase posterior):
    // try { await NativeBiometric.verifyIdentity({ reason: motivo, title: 'SEP' }); return true; }
    // catch { return false; }
    void motivo;
    return false;
  }

  async trustDevice(): Promise<void> {
    await this.tokenStorage.setTrustDevice(true);
  }

  async forgetDevice(): Promise<void> {
    await this.tokenStorage.clearTrustDevice();
  }

  async isTrustedDevice(): Promise<boolean> {
    return this.tokenStorage.getTrustDevice();
  }
}
