import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { NativeRuntimeService } from './core/native/native-runtime.service';
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
    // Integracao nativa (status bar, back button, deep links); no web e no-op.
    void inject(NativeRuntimeService).init();
  }
}
