import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/auth/auth.service';

interface HomeShortcut {
  label: string;
  description: string;
  link: string;
  testid: string;
}

@Component({
  selector: 'sep-home',
  standalone: true,
  imports: [IonContent, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly shortcuts = computed<HomeShortcut[]>(() => {
    const role = this.user()?.role;
    if (!role) {
      return [];
    }
    const list: HomeShortcut[] = [
      {
        label: 'Meu perfil',
        description: 'Veja seus dados de cadastro.',
        link: '/app/perfil',
        testid: 'sep-home-shortcut-perfil',
      },
    ];
    if (role === 'CLIENTE') {
      list.push(
        {
          label: 'Propostas',
          description: 'Acompanhe suas propostas de credito.',
          link: '/app/propostas',
          testid: 'sep-home-shortcut-propostas',
        },
        {
          label: 'Parcelas',
          description: 'Confira o calendario de pagamento.',
          link: '/app/parcelas',
          testid: 'sep-home-shortcut-parcelas',
        },
      );
    }
    if (role === 'ADMIN') {
      list.push({
        label: 'Administracao',
        description: 'Acesse o painel administrativo.',
        link: '/app/admin',
        testid: 'sep-home-shortcut-admin',
      });
    }
    return list;
  });
}
