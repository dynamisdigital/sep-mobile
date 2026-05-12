import { Injectable, signal } from '@angular/core';

/**
 * Armazena o step-up token em memoria (follow-up 5F-FIX-05 da Sprint 5).
 *
 * - Uso unico: {@link consume} devolve e zera o token.
 * - Sem persistencia: token efemero (5 min TTL no backend); reload da app
 *   exige novo step-up. Isso reduz superficie em comparacao com Capacitor
 *   Preferences ou localStorage, alinhado a recomendacao do plano.
 */
@Injectable({ providedIn: 'root' })
export class StepUpTokenStore {
  private readonly tokenState = signal<string | null>(null);

  readonly hasToken = () => this.tokenState() !== null;

  set(token: string): void {
    this.tokenState.set(token);
  }

  /** Devolve o token e zera o store; apos consume, hasToken() retorna false. */
  consume(): string | null {
    const token = this.tokenState();
    this.tokenState.set(null);
    return token;
  }

  clear(): void {
    this.tokenState.set(null);
  }
}
