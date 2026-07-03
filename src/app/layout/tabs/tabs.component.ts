import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton } from '@ionic/angular/standalone';
import { filter, map, startWith } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  calendarOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  settingsOutline,
} from 'ionicons/icons';

import { UsuarioRole } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { CredoraContextStore } from '../../core/credores/credora-context.store';

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

// Tab da jornada credora. Nao ha role `CREDORA`: e exibida apenas quando a presenca de credora
// foi confirmada (`GET /credores/me` 200), para qualquer usuario autenticado. Inserida antes de
// Perfil, mantendo no maximo 5 tabs para um CLIENTE que tambem possui credora.
const CREDORA_TAB: MobileTab = {
  label: 'Credora',
  icon: 'business-outline',
  tab: 'credora',
  href: '/app/credora/inicio',
  roles: ['ADMIN', 'CLIENTE'],
};

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
  private readonly credoraStore = inject(CredoraContextStore);
  private readonly router = inject(Router);

  readonly tabs = computed<MobileTab[]>(() => {
    const role = this.auth.currentUser()?.role;
    if (!role) {
      return [];
    }
    const base = ALL_TABS.filter((tab) => tab.roles.includes(role));
    // A tab Credora so aparece apos a presenca confirmada; enquanto desconhecida/ausente/erro
    // ela nao e exibida (evita piscar tab indevida).
    if (!this.credoraStore.presente() || !CREDORA_TAB.roles.includes(role)) {
      return base;
    }
    const indicePerfil = base.findIndex((tab) => tab.tab === 'perfil');
    const comCredora = [...base];
    comCredora.splice(indicePerfil < 0 ? base.length : indicePerfil, 0, CREDORA_TAB);
    return comCredora;
  });

  // URL atual reativa para o destaque da tab ativa. Necessaria porque a navegacao das tabs passa
  // pelo router (sem `[href]`), entao o `ion-tabs` nao gerencia mais o estado selecionado sozinho.
  private readonly urlAtual = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    addIcons({
      homeOutline,
      documentTextOutline,
      calendarOutline,
      personOutline,
      settingsOutline,
      businessOutline,
    });
    // Carrega a presenca de credora uma vez (dedup no store) para decidir a tab. O authGuard ja
    // garantiu o usuario autenticado antes do shell montar. Fire-and-forget: nao bloqueia as tabs.
    void this.credoraStore.carregar();
  }

  protected estaAtiva(tab: MobileTab): boolean {
    return this.urlAtual().startsWith(tab.href);
  }

  // Navega sempre pelo router (SPA). O `ion-tab-button` nao usa mais `[href]`: para a tab Credora
  // (adicionada apos a presenca async, fora do registro do `ion-tabs` no init) o comportamento de
  // ancora do `[href]` fazia um reload de pagina inteira que destruia o app. Sem `[href]`, o
  // roteamento e deterministico para todas as tabs e o destaque vem de `estaAtiva`.
  irPara(href: string): void {
    void this.router.navigateByUrl(href);
  }
}
