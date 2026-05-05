import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-ds-typography',
  standalone: true,
  imports: [IonContent],
  template: `
    <ion-content class="ion-padding">
      <h1 class="t-h1">Heading 1 - 30px / Bold</h1>
      <h2 class="t-h2">Heading 2 - 24px / SemiBold</h2>
      <h3 class="t-h3">Heading 3 - 20px / SemiBold</h3>
      <p class="t-base">Texto base - 16px / Regular. Corpo legivel em mobile.</p>
      <p class="t-secondary">Texto secundario - 14px / Regular. Cor reduzida.</p>
      <p class="t-caption">Caption - 12px / Regular. Para metadados.</p>
      <p class="t-label">LABEL - 14px / Medium</p>
      <p class="t-mono">Mono - 14px / monospace</p>
    </ion-content>
  `,
  styleUrl: './typography.component.scss',
})
export class TypographyComponent {}
