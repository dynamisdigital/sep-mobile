import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonContent, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

interface Cor {
  nome: string;
  variavel: string;
  hex: string;
}

@Component({
  selector: 'sep-ds-colors',
  standalone: true,
  imports: [CommonModule, IonContent, IonItem, IonLabel, IonList],
  template: `
    <ion-content class="ion-padding">
      <h2>Paleta Notion Mobile</h2>
      <ion-list>
        <ion-item *ngFor="let c of cores">
          <div class="swatch" [style.background]="c.hex"></div>
          <ion-label>
            <h3>{{ c.nome }}</h3>
            <p>
              <code>{{ c.variavel }}</code> - {{ c.hex }}
            </p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [
    `
      .swatch {
        width: 44px;
        height: 44px;
        border-radius: 4px;
        margin-right: 16px;
        border: 1px solid var(--notion-border, rgba(55, 53, 47, 0.16));
      }
    `,
  ],
})
export class ColorsComponent {
  cores: Cor[] = [
    { nome: 'Primary (Notion blue)', variavel: '--ion-color-primary', hex: '#2383E2' },
    { nome: 'Success', variavel: '--ion-color-success', hex: '#448361' },
    { nome: 'Warning', variavel: '--ion-color-warning', hex: '#D9730D' },
    { nome: 'Danger', variavel: '--ion-color-danger', hex: '#D44C47' },
    { nome: 'Background primary', variavel: '--ion-background-color', hex: '#FFFFFF' },
    {
      nome: 'Background secondary (warm)',
      variavel: '--notion-bg-secondary',
      hex: '#F7F6F3',
    },
    { nome: 'Text primary', variavel: '--ion-text-color', hex: '#37352F' },
    { nome: 'Text secondary', variavel: '--notion-text-secondary', hex: '#373d2fa6' },
  ];
}
