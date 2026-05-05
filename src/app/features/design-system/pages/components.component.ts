import { Component } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonToast,
} from '@ionic/angular/standalone';

@Component({
  selector: 'sep-ds-components',
  standalone: true,
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonInput,
    IonItem,
    IonList,
    IonToast,
  ],
  template: `
    <ion-content class="ion-padding">
      <h2>Botoes</h2>
      <ion-button color="primary">Primary</ion-button>
      <ion-button color="medium" class="notion-secondary">Secondary</ion-button>
      <ion-button fill="clear">Ghost</ion-button>

      <h2>Inputs</h2>
      <ion-list>
        <ion-item>
          <ion-input label="E-mail" labelPlacement="floating" placeholder="seu@email.com" />
        </ion-item>
        <ion-item>
          <ion-input label="Senha" labelPlacement="floating" type="password" />
        </ion-item>
      </ion-list>

      <h2>Cards</h2>
      <ion-card>
        <ion-card-header>
          <ion-card-title>Titulo do Card</ion-card-title>
          <ion-card-subtitle>Subtitulo</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          Notion mobile card com sombra multilayer e radius 12px.
        </ion-card-content>
      </ion-card>

      <h2>Toasts</h2>
      <ion-button (click)="toastSuccessAberto = true">Toast success</ion-button>
      <ion-button (click)="toastErrorAberto = true">Toast error</ion-button>

      <ion-toast
        [isOpen]="toastSuccessAberto"
        message="Operacao concluida"
        duration="2000"
        cssClass="toast-success"
        (didDismiss)="toastSuccessAberto = false"
      />
      <ion-toast
        [isOpen]="toastErrorAberto"
        message="Erro ao processar"
        duration="2000"
        cssClass="toast-error"
        (didDismiss)="toastErrorAberto = false"
      />
    </ion-content>
  `,
})
export class ComponentsComponent {
  toastSuccessAberto = false;
  toastErrorAberto = false;
}
