import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  settingsOutline,
} from 'ionicons/icons';

import { UsuarioRole } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';

interface MobileTab {
  label: string;
  icon: string;
  tab: string;
  href: string;
  roles: UsuarioRole[];
}

const ALL_TABS: readonly MobileTab[] = [
  {
    label: 'Inicio',
    icon: 'home-outline',
    tab: 'inicio',
    href: '/app/inicio',
    roles: ['ADMIN', 'CLIENTE'],
  },
  {
    label: 'Propostas',
    icon: 'document-text-outline',
    tab: 'propostas',
    href: '/app/propostas',
    roles: ['CLIENTE'],
  },
  {
    label: 'Parcelas',
    icon: 'calendar-outline',
    tab: 'parcelas',
    href: '/app/parcelas',
    roles: ['CLIENTE'],
  },
  {
    label: 'Perfil',
    icon: 'person-outline',
    tab: 'perfil',
    href: '/app/perfil',
    roles: ['ADMIN', 'CLIENTE'],
  },
  {
    label: 'Admin',
    icon: 'settings-outline',
    tab: 'admin',
    href: '/app/admin',
    roles: ['ADMIN'],
  },
];

@Component({
  selector: 'sep-tabs',
  standalone: true,
  imports: [IonTabBar, IonTabButton, IonIcon, IonLabel],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  private readonly auth = inject(AuthService);

  readonly tabs = computed<MobileTab[]>(() => {
    const role = this.auth.currentUser()?.role;
    if (!role) {
      return [];
    }
    return ALL_TABS.filter((tab) => tab.roles.includes(role));
  });

  constructor() {
    addIcons({
      homeOutline,
      documentTextOutline,
      calendarOutline,
      personOutline,
      settingsOutline,
    });
  }
}
