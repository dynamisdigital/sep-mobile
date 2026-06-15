import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { colorPaletteOutline, cubeOutline, navigateOutline, textOutline } from 'ionicons/icons';

@Component({
  selector: 'sep-design-system-showcase',
  standalone: true,
  imports: [
    RouterLink,
    IonHeader,
    IonIcon,
    IonLabel,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonTitle,
    IonToolbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>New Design System SEP</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="colors" routerLink="colors">
          <ion-icon name="color-palette-outline"></ion-icon>
          <ion-label>Cores</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="typography" routerLink="typography">
          <ion-icon name="text-outline"></ion-icon>
          <ion-label>Tipografia</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="components" routerLink="components">
          <ion-icon name="cube-outline"></ion-icon>
          <ion-label>Componentes</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="navigation" routerLink="navigation">
          <ion-icon name="navigate-outline"></ion-icon>
          <ion-label>Navegacao</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class ShowcaseComponent {
  constructor() {
    addIcons({ colorPaletteOutline, textOutline, cubeOutline, navigateOutline });
  }
}
