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
        <h2>Tentativas excessivas</h2>
        <p>
          Detectamos varias tentativas de login com credenciais invalidas. Sua conta esta
          temporariamente bloqueada. Tente novamente em alguns minutos.
        </p>
        <p>
          Se voce nao reconhece essas tentativas, troque sua senha assim que o acesso for
          restabelecido e revise os dispositivos conectados.
        </p>
      </ion-text>
      <ion-button expand="block" fill="solid" color="primary" routerLink="/login">
        Voltar ao login
      </ion-button>
    </ion-content>
  `,
})
export class AccountLockedComponent {}
