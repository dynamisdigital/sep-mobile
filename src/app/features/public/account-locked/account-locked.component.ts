import { Component, ElementRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ViewDidEnter } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

/**
 * Destino do redirect de 423 (`errorInterceptor`, `login.component`, `verify-totp.component`),
 * tambem alcancavel por URL direta.
 *
 * Copy estatica de proposito: quem navega para ca descarta o `HttpErrorResponse`, entao a `message`
 * do servidor nao chega ate aqui — e a pagina tambem responde a um 423 de qualquer endpoint, onde
 * nao ha mensagem alguma.
 *
 * M-Sprint 17: cada afirmacao foi conferida contra o `sep-api`, como a F-Sprint 21 fez no `sep-app`.
 * Tres estavam erradas ou incompletas e foram corrigidas:
 * - "revise os dispositivos conectados" REMOVIDO: mandava fazer algo que o produto nao oferece. Nao
 *   existe tela de sessoes no `sep-mobile` nem endpoint que liste dispositivos no backend — o
 *   `AuthController` so expoe `/logout` e `/logout-all`, que encerram sem listar.
 * - "tente novamente em alguns minutos" -> "ate 30 minutos, contados a partir da ultima tentativa":
 *   `PoliticaLockout.eventoDeBloqueio` compara `agora - duracaoBloqueio` com a falha que fecha a
 *   janela, entao o prazo corre desde a tentativa, nao desde a abertura desta tela. Dentro de um
 *   episodio o prazo nao se estende, porque nenhuma falha e gravada enquanto a conta esta bloqueada
 *   (`LockoutService.verificar` lanca antes do registro). "Alguns minutos" convidava a tentar de
 *   novo aos 5 e falhar. O 30 vem de `app.security.lockout.lockout-minutes`, sobrescrevivel por
 *   ambiente, hoje sem override em nenhum perfil.
 * - "credenciais invalidas" -> "senha ou codigo de verificacao": `LockoutService.STATUSES_FALHA`
 *   conta SENHA_INVALIDA e TOTP_INVALIDO no mesmo contador, e `VerificarTotpUseCase` chama o mesmo
 *   `lockoutService.verificar`, entao quem errou o TOTP tambem cai aqui.
 *
 * O heading e `h1`, e nao `h2`: o `ion-title` do header nao e exposto como heading, entao este e o
 * unico da pagina — como `h2` ela ficava sem nivel 1. Alem disso o Ionic so neutraliza o outline de
 * foco de `h1[tabindex="-1"]:focus` (regra propria em `styles.css`), entao com `h2` o heading
 * ganhava um anel azul do `:focus-visible` de `global.scss` ao ser focado por deep link.
 *
 * Acrescentado: o desbloqueio e so por expiracao. Conferido que nao ha endpoint de unlock, acao de
 * backoffice, job ou delete em `LoginAttemptRepository` — a unica saida e o prazo vencer. A frase
 * nao e cruel porque tambem nao existe fluxo de recuperacao de senha para quem nao esta
 * autenticado: nao ha o que a pessoa pudesse fazer alem de esperar.
 *
 * LIMITE CONHECIDO: o contador e por `username`, sem distinguir quem tentou. Vencido o bloqueio,
 * cinco novas falhas o renovam — entao sob ataque sustentado o usuario legitimo fica sem entrada e
 * esta tela nao oferece saida. E a lacuna do 3o paragrafo, compartilhada com o `sep-app`; fechar
 * exige controle compensatorio no backend (follow-up aberto desde a Sprint 33, exige ADR).
 *
 * FOLLOW-UP do prazo fixo: o `sep-api` ja manda os minutos no corpo do 423
 * (`ContaBloqueadaException` -> `ApiExceptionHandler`), entao o que falta e local — carregar a
 * `message` atraves da navegacao, que hoje descarta o `HttpErrorResponse`. A Sprint 34 planeja
 * ainda um `GET /auth/politica-lockout` publico, util para o acesso por URL direta, onde nao houve
 * request nenhuma.
 */
@Component({
  selector: 'sep-account-locked',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonText, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Conta bloqueada</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-text>
        <h1 #titulo tabindex="-1" data-testid="sep-account-locked-title">Tentativas excessivas</h1>
        <p>
          Detectamos varias tentativas de acesso malsucedidas — senha ou codigo de verificacao. Por
          seguranca, sua conta fica bloqueada por ate 30 minutos, contados a partir da ultima
          tentativa.
        </p>
        <p>
          O desbloqueio e automatico e acontece so por expiracao desse prazo: nao existe liberacao
          manual. Depois disso, basta entrar de novo.
        </p>
        <p>
          Se voce nao reconhece essas tentativas, troque sua senha assim que o acesso for
          restabelecido.
        </p>
      </ion-text>
      <ion-button
        expand="block"
        fill="solid"
        color="primary"
        routerLink="/login"
        data-testid="sep-account-locked-back"
      >
        Voltar ao login
      </ion-button>
    </ion-content>
  `,
})
export class AccountLockedComponent implements ViewDidEnter {
  private readonly titulo = viewChild.required<ElementRef<HTMLHeadingElement>>('titulo');

  // `ionViewDidEnter`, e nao `ngAfterViewInit` como no `sep-app`. Medido em Chromium: no
  // `ngAfterViewInit` o heading esta no documento e visivel por estilo
  // (`display:block; visibility:visible; opacity:1`), mas SEM caixa de layout —
  // `offsetParent === null` e rect 0x0 —, porque os web components do Ionic ainda nao renderizaram,
  // e `focus()` em elemento sem caixa e no-op: o `activeElement` continuava em BODY mesmo com o
  // `tabindex` no lugar. Nao e a animacao nem opacidade: no `ionViewDidEnter` a pagina ainda carrega
  // `.ion-page-invisible` (opacity 0) e o foco funciona.
  ionViewDidEnter(): void {
    // Destino de redirect automatico das tres camadas que tratam 423. O Angular nao move foco na
    // navegacao, o app nao tem live region de rota e o `focusManagerPriority` do Ionic esta
    // desligado (`provideIonicAngular()` sem config, decisao da sprint) — entao sem isto quem usa
    // leitor de tela cai em silencio numa tela nova, sem saber que a conta foi bloqueada, justo no
    // desfecho de um evento de seguranca.
    this.titulo().nativeElement.focus();
  }
}
