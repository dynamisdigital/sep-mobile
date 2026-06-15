import { Component } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonToast,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { briefcaseOutline, cardOutline, trendingUpOutline, walletOutline } from 'ionicons/icons';

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
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonToast,
  ],
  template: `
    <ion-content class="ion-padding">
      <h2>Botoes</h2>
      <ion-button color="primary">Primary</ion-button>
      <ion-button color="secondary">Secondary</ion-button>
      <ion-button fill="outline">Outline</ion-button>
      <ion-button fill="clear">Ghost</ion-button>
      <ion-button class="demo-cta" expand="block">CTA gradiente</ion-button>

      <h2>Chips de icone (sep-mobile-icon-chip)</h2>
      <div class="demo-chips">
        <span class="demo-chip demo-chip--primary"><ion-icon name="briefcase-outline" /></span>
        <span class="demo-chip demo-chip--secondary"><ion-icon name="wallet-outline" /></span>
        <span class="demo-chip demo-chip--warning"><ion-icon name="trending-up-outline" /></span>
        <span class="demo-chip demo-chip--success"><ion-icon name="card-outline" /></span>
      </div>

      <h2>Tiles de acesso rapido (sep-mobile-quick-tile)</h2>
      <div class="demo-tiles">
        <span class="demo-tile demo-tile--primary">
          <ion-icon class="sep-tile-icon" name="briefcase-outline" />
          Tomador
        </span>
        <span class="demo-tile demo-tile--secondary">
          <ion-icon class="sep-tile-icon" name="wallet-outline" />
          Credora
        </span>
      </div>

      <h2>Painel de marca (sep-mobile-auth-brand-panel)</h2>
      <div class="demo-brand">
        <span class="demo-brand-mark">SEP</span>
        <strong>Credito empresarial</strong>
      </div>

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
          Card do design system com superficie, borda e sombra dos tokens DS.
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
  styleUrl: './components.component.scss',
})
export class ComponentsComponent {
  toastSuccessAberto = false;
  toastErrorAberto = false;

  constructor() {
    addIcons({ briefcaseOutline, walletOutline, trendingUpOutline, cardOutline });
  }
}
