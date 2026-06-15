import { Component } from '@angular/core';
import { IonContent, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

interface Cor {
  nome: string;
  token: string;
}

@Component({
  selector: 'sep-ds-colors',
  standalone: true,
  imports: [IonContent, IonItem, IonLabel, IonList],
  template: `
    <ion-content class="ion-padding">
      <h2>Paleta New Design System SEP</h2>
      <p class="hint">Amostras vivas via tokens HSL; adaptam ao tema claro/escuro.</p>
      <ion-list>
        @for (c of cores; track c.token) {
          <ion-item>
            <div class="swatch" [style.background]="'hsl(var(' + c.token + '))'"></div>
            <ion-label>
              <h3>{{ c.nome }}</h3>
              <p>
                <code>{{ c.token }}</code>
              </p>
            </ion-label>
          </ion-item>
        }
      </ion-list>
    </ion-content>
  `,
  styles: [
    `
      .hint {
        margin: 0 0 16px;
        font-size: 0.875rem;
        color: hsl(var(--muted-foreground));
      }

      .swatch {
        width: 44px;
        height: 44px;
        margin-right: 16px;
        border: 1px solid hsl(var(--border));
        border-radius: var(--sep-radius-md);
      }
    `,
  ],
})
export class ColorsComponent {
  cores: Cor[] = [
    { nome: 'Primary', token: '--primary' },
    { nome: 'Secondary', token: '--secondary' },
    { nome: 'Success', token: '--success' },
    { nome: 'Warning', token: '--warning' },
    { nome: 'Destructive', token: '--destructive' },
    { nome: 'Background', token: '--background' },
    { nome: 'Card', token: '--card' },
    { nome: 'Muted', token: '--muted' },
    { nome: 'Foreground (texto)', token: '--foreground' },
    { nome: 'Border', token: '--border' },
  ];
}
