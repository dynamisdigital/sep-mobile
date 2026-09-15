import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { NotificacoesMobileService } from './notificacoes-mobile.service';

export type ContagemNaoLidas =
  | { situacao: 'carregando' }
  | { situacao: 'indisponivel' }
  | { situacao: 'conhecida'; naoLidas: number };

interface Registro {
  dono: string;
  contagem: ContagemNaoLidas;
}

// Contador de nao lidas compartilhado entre o header de todas as paginas autenticadas e a central
// (M-Sprint 19). Root porque o `ion-router-outlet` mantem varias paginas montadas ao mesmo tempo,
// cada uma com o proprio header: todas precisam do MESMO numero.
//
// Sem polling nem timer, por decisao da spec 219: atualiza ao montar o shell, ao entrar na central e
// depois de confirmar leitura. Entre esses momentos pode estar desatualizado.
//
// Por ser root, destruir paginas nao limpa nada, e o `firstValueFrom` do service nao deixa cancelar a
// requisicao. O vinculo com a sessao vem de tres guardas:
// - `contagem` so expoe o registro do usuario logado agora: logout e troca de conta somem na hora;
// - toda consulta carrega a propria geracao, e resposta de geracao vencida e descartada;
// - sessao encerrada (logout, 401, 423 — todos passam por `clearSession`) avanca a geracao e apaga o
//   registro, para o proximo login do mesmo usuario nao herdar o numero nem a resposta da anterior.
@Injectable({ providedIn: 'root' })
export class NotificacoesNaoLidasStore {
  private readonly auth = inject(AuthService);
  private readonly service = inject(NotificacoesMobileService);

  private readonly registro = signal<Registro | null>(null);
  private emVoo: { dono: string; promessa: Promise<void> } | null = null;
  private geracao = 0;

  readonly contagem = computed<ContagemNaoLidas | null>(() => {
    const registro = this.registro();
    const dono = this.auth.currentUser()?.id;
    return registro !== null && registro.dono === dono ? registro.contagem : null;
  });

  constructor() {
    effect(() => {
      if (this.auth.currentUser() === null) {
        untracked(() => this.descartar());
      }
    });
  }

  // Chamadas enquanto ha consulta do mesmo usuario em voo compartilham a mesma requisicao. Reconsulta
  // mantem o valor conhecido na tela ate a resposta chegar, em vez de piscar "carregando".
  carregar(): Promise<void> {
    const dono = this.auth.currentUser()?.id;
    if (!dono) {
      return Promise.resolve();
    }
    if (this.emVoo?.dono === dono) {
      return this.emVoo.promessa;
    }
    if (this.registro()?.dono !== dono) {
      this.registro.set({ dono, contagem: { situacao: 'carregando' } });
    }
    const geracao = ++this.geracao;
    const promessa = this.consultar(dono, geracao);
    this.emVoo = { dono, promessa };
    return promessa;
  }

  private async consultar(dono: string, geracao: number): Promise<void> {
    try {
      const resposta: unknown = await this.service.contarNaoLidas();
      if (geracao !== this.geracao) {
        return;
      }
      const naoLidas = naoLidasValida(resposta);
      if (naoLidas === undefined) {
        this.registrarFalha(dono);
      } else {
        this.registro.set({ dono, contagem: { situacao: 'conhecida', naoLidas } });
      }
    } catch {
      if (geracao === this.geracao) {
        this.registrarFalha(dono);
      }
    } finally {
      if (geracao === this.geracao) {
        this.emVoo = null;
      }
    }
  }

  // Falha nao afirma zero; e reconsulta que falha nao apaga o numero ja conhecido.
  private registrarFalha(dono: string): void {
    if (this.registro()?.contagem.situacao !== 'conhecida') {
      this.registro.set({ dono, contagem: { situacao: 'indisponivel' } });
    }
  }

  private descartar(): void {
    this.geracao += 1;
    this.emVoo = null;
    this.registro.set(null);
  }
}

// Corpo fora do contrato e falha, nao contagem: `-1`, `2.5`, `"3"` ou corpo nulo virariam marcador
// sem sentido no header, e uma baixa local sobre valor que nao e numero daria `NaN`.
function naoLidasValida(resposta: unknown): number | undefined {
  if (resposta === null || typeof resposta !== 'object') {
    return undefined;
  }
  const naoLidas: unknown = (resposta as Record<string, unknown>)['naoLidas'];
  return typeof naoLidas === 'number' && Number.isInteger(naoLidas) && naoLidas >= 0
    ? naoLidas
    : undefined;
}
