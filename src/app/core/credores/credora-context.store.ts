import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { EmpresaCredoraResponse } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { CredoraMobileService } from './credora-mobile.service';

export type CredoraPresenca = 'desconhecido' | 'carregando' | 'presente' | 'ausente' | 'erro';

// Estado efemero (somente em memoria) da presenca de credora do usuario autenticado. Governa a
// exibicao da tab/rotas credora sem inventar role: 200 /me => presente; 404 => ausente; rede/5xx
// => erro (nunca concluir "nao e credora"). Deduplica chamadas concorrentes de tab/guard/home.
//
// Nao persiste em storage (LGPD + requisito da M-10). A presenca e a credora sao escopadas ao
// usuario que as carregou: se o usuario autenticado mudar (novo login) ou sair (logout => null),
// os signals derivados voltam a "sem credora" reativamente, sem exibir dados de outro usuario.
@Injectable({ providedIn: 'root' })
export class CredoraContextStore {
  private readonly service = inject(CredoraMobileService);
  private readonly auth = inject(AuthService);

  private readonly estadoState = signal<CredoraPresenca>('desconhecido');
  private readonly credoraState = signal<EmpresaCredoraResponse | null>(null);
  private readonly usuarioCarregadoState = signal<string | null>(null);
  private inFlight: Promise<CredoraPresenca> | null = null;

  readonly estado = this.estadoState.asReadonly();

  readonly presente = computed(() => this.estadoState() === 'presente' && this.usuarioCasado());
  readonly credora = computed(() => (this.usuarioCasado() ? this.credoraState() : null));

  // Carrega a presenca sob demanda. Chamadas concorrentes compartilham a mesma requisicao;
  // estados terminais conhecidos (presente/ausente) sao reaproveitados sem nova chamada.
  async carregar(): Promise<CredoraPresenca> {
    const usuarioId = this.usuarioAtual();
    if (usuarioId !== this.usuarioCarregadoState()) {
      this.resetar(usuarioId);
    }
    if (this.estadoState() === 'presente' || this.estadoState() === 'ausente') {
      return this.estadoState();
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    this.inFlight = this.buscar();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  // Retry explicito apos erro tecnico: descarta o estado atual e busca de novo.
  async recarregar(): Promise<CredoraPresenca> {
    this.inFlight = null;
    this.estadoState.set('desconhecido');
    return this.carregar();
  }

  private usuarioAtual(): string | null {
    return this.auth.currentUser()?.id ?? null;
  }

  private usuarioCasado(): boolean {
    return this.usuarioAtual() === this.usuarioCarregadoState();
  }

  private resetar(usuarioId: string | null): void {
    this.inFlight = null;
    this.estadoState.set('desconhecido');
    this.credoraState.set(null);
    this.usuarioCarregadoState.set(usuarioId);
  }

  private async buscar(): Promise<CredoraPresenca> {
    const alvo = this.usuarioAtual();
    this.estadoState.set('carregando');
    try {
      const credora = await this.service.consultarMinhaCredora();
      if (this.usuarioAtual() !== alvo) {
        return this.estadoState(); // usuario mudou durante a requisicao: descarta o resultado
      }
      this.credoraState.set(credora);
      this.estadoState.set('presente');
      return 'presente';
    } catch (erro) {
      if (this.usuarioAtual() !== alvo) {
        return this.estadoState();
      }
      this.credoraState.set(null);
      if (erro instanceof HttpErrorResponse && erro.status === 404) {
        this.estadoState.set('ausente');
        return 'ausente';
      }
      this.estadoState.set('erro');
      return 'erro';
    }
  }
}
