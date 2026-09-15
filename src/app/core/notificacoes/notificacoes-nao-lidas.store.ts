import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { NotificacoesMobileService } from './notificacoes-mobile.service';

// `desatualizada` e um numero ja recebido do servidor cuja reconsulta seguinte falhou: continua
// sendo mostrado, porque apagar ou zerar seria afirmar algo que o app nao sabe.
export type ContagemNaoLidas =
  | { situacao: 'carregando' }
  | { situacao: 'indisponivel' }
  | { situacao: 'conhecida'; naoLidas: number }
  | { situacao: 'desatualizada'; naoLidas: number };

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
  // Avanca a cada contagem recebida do servidor. Uma leitura enviada ANTES de um marco pode ja estar
  // descontada nele; por isso cada leitura guarda o marco vigente no seu PRIMEIRO envio.
  private marcoDaContagem = 0;
  private readonly marcoPorLeituraEnviada = new Map<string, number>();

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

  // Chamado antes de cada POST de leitura. O retry do mesmo aviso mantem o marco do PRIMEIRO envio: a
  // tentativa que caiu por timeout pode ter gravado, e uma contagem posterior ja a reflete.
  leituraEnviada(id: string): void {
    if (!this.marcoPorLeituraEnviada.has(id)) {
      this.marcoPorLeituraEnviada.set(id, this.marcoDaContagem);
    }
  }

  // Leitura confirmada pelo servidor de um aviso que estava nao lido na tela ("read your writes").
  //
  // A contagem em voo foi pedida ANTES da confirmacao e pode trazer o numero antigo: e invalidada. A
  // baixa local acontece uma vez, sem negativo, e SO quando nenhuma contagem chegou depois do primeiro
  // envio — ai o numero conhecido e anterior a leitura e nao a inclui. Se chegou, ela pode ja ter
  // descontado esta leitura (outra leitura concorrente, ou retry depois de timeout que gravou), e
  // descontar de novo esconderia aviso nao lido; entao so a reconsulta decide. Na duvida o contador
  // fica alto por um instante, nunca baixo. Contagem desconhecida segue desconhecida.
  registrarLeitura(id: string): Promise<void> {
    const baseAnteriorAoEnvio = this.marcoPorLeituraEnviada.get(id) === this.marcoDaContagem;
    this.marcoPorLeituraEnviada.delete(id);
    this.invalidarConsultaEmVoo();
    // O registro nao precisa conferir dono aqui: `contagem` so expoe o do usuario atual, e o `carregar`
    // abaixo substitui registro de outro dono antes de qualquer numero dele aparecer.
    const atual = this.registro();
    if (baseAnteriorAoEnvio && atual && temNumero(atual.contagem)) {
      const naoLidas = Math.max(0, atual.contagem.naoLidas - 1);
      this.registro.set({ dono: atual.dono, contagem: { ...atual.contagem, naoLidas } });
    }
    return this.carregar();
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
        this.marcoDaContagem += 1;
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

  // Falha nao afirma zero; e reconsulta que falha nao apaga o numero ja recebido, so o marca como
  // desatualizado.
  private registrarFalha(dono: string): void {
    const atual = this.registro()?.contagem;
    this.registro.set({
      dono,
      contagem:
        atual && temNumero(atual)
          ? { situacao: 'desatualizada', naoLidas: atual.naoLidas }
          : { situacao: 'indisponivel' },
    });
  }

  private invalidarConsultaEmVoo(): void {
    this.geracao += 1;
    this.emVoo = null;
  }

  private descartar(): void {
    this.invalidarConsultaEmVoo();
    // Higiene de memoria, nao guarda: o marco so avanca, entao uma entrada velha so casaria se nenhuma
    // contagem tivesse chegado na sessao nova — e ai nao ha numero para baixar.
    this.marcoPorLeituraEnviada.clear();
    this.registro.set(null);
  }
}

function temNumero(
  contagem: ContagemNaoLidas,
): contagem is Extract<ContagemNaoLidas, { naoLidas: number }> {
  return contagem.situacao === 'conhecida' || contagem.situacao === 'desatualizada';
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
