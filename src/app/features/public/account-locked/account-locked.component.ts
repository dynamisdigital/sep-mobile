import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
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
 *   janela, entao o prazo corre desde a tentativa, nao desde a abertura desta tela. Como nenhuma
 *   falha e gravada durante o bloqueio (`LockoutService.verificar` lanca antes do registro), o prazo
 *   nunca se estende. "Alguns minutos" convidava a tentar de novo aos 5 e falhar. O 30 vem de
 *   `app.security.lockout.lockout-minutes`, sobrescrevivel por ambiente: se ops mudar, esta pagina
 *   desalinha (follow-up: expor o valor no contrato — escopo da Sprint 34).
 * - "credenciais invalidas" -> "senha ou codigo de verificacao": `LockoutService.STATUSES_FALHA`
 *   conta SENHA_INVALIDA e TOTP_INVALIDO no mesmo contador, e `VerificarTotpUseCase` chama o mesmo
 *   `lockoutService.verificar`, entao quem errou o TOTP tambem cai aqui.
 *
 * Acrescentado: o desbloqueio e so por expiracao. Conferido que nao ha endpoint de unlock, acao de
 * backoffice, job ou delete em `LoginAttemptRepository` — a unica saida e o prazo vencer.
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
        <h2 data-testid="sep-account-locked-title">Tentativas excessivas</h2>
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
export class AccountLockedComponent {}
