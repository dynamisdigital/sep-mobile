import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  documentTextOutline,
  personOutline,
  settingsOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/auth/auth.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

interface HomeShortcut {
  label: string;
  description: string;
  link: string;
  testid: string;
  icon: string;
  tone: string;
}

@Component({
  selector: 'sep-home',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink, HeaderMobileComponent],
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
        icon: 'person-outline',
        tone: 'var(--primary)',
      },
    ];
    if (role === 'CLIENTE') {
      list.push(
        {
          label: 'Propostas',
          description: 'Acompanhe suas propostas de credito.',
          link: '/app/propostas',
          testid: 'sep-home-shortcut-propostas',
          icon: 'document-text-outline',
          tone: 'var(--secondary)',
        },
        {
          label: 'Parcelas',
          description: 'Confira o calendario de pagamento.',
          link: '/app/parcelas',
          testid: 'sep-home-shortcut-parcelas',
          icon: 'calendar-outline',
          tone: 'var(--warning)',
        },
      );
    }
    if (role === 'ADMIN') {
      list.push({
        label: 'Administracao',
        description: 'Acesse o painel administrativo.',
        link: '/app/admin',
        testid: 'sep-home-shortcut-admin',
        icon: 'settings-outline',
        tone: 'var(--primary)',
      });
    }
    return list;
  });

  constructor() {
    addIcons({ personOutline, documentTextOutline, calendarOutline, settingsOutline });
  }
}
