import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'sep-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    // Instancia o ThemeService no startup para aplicar o tema (claro/escuro)
    // antes de qualquer tela montar.
    inject(ThemeService);
  }
}
