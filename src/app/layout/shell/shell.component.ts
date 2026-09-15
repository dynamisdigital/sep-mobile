import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonRouterOutlet, IonTabs } from '@ionic/angular/standalone';

import { NotificacoesNaoLidasStore } from '../../core/notificacoes/notificacoes-nao-lidas.store';
import { TabsComponent } from '../tabs/tabs.component';

@Component({
  selector: 'sep-shell',
  standalone: true,
  imports: [IonRouterOutlet, IonTabs, TabsComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly naoLidas = inject(NotificacoesNaoLidasStore);

  // Uma consulta por montagem do shell (entrada na area autenticada), e nao uma por pagina: cada
  // pagina tem o proprio header, e todos leem o mesmo store. O authGuard ja garantiu o usuario.
  // Fire-and-forget: a contagem nao bloqueia a navegacao.
  constructor() {
    void this.naoLidas.carregar();
  }
}
