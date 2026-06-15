import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  swapHorizontalOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/auth/auth.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

interface PlaceholderCard {
  label: string;
  description: string;
  testid: string;
  icon: string;
  tone: string;
}

const CARDS: readonly PlaceholderCard[] = [
  {
    label: 'Status do cadastro / KYB',
    description: 'Acompanhe a validacao do cadastro da empresa.',
    testid: 'sep-credora-card-kyb',
    icon: 'business-outline',
    tone: 'var(--primary)',
  },
  {
    label: 'Resumo de oportunidades',
    description: 'Veja propostas disponiveis para aporte.',
    testid: 'sep-credora-card-oportunidades',
    icon: 'trending-up-outline',
    tone: 'var(--secondary)',
  },
  {
    label: 'Operacoes financiadas',
    description: 'Resumo de operacoes em andamento.',
    testid: 'sep-credora-card-operacoes',
    icon: 'swap-horizontal-outline',
    tone: 'var(--warning)',
  },
  {
    label: 'Carteira',
    description: 'Visao consolidada da carteira.',
    testid: 'sep-credora-card-carteira',
    icon: 'wallet-outline',
    tone: 'var(--primary)',
  },
];

@Component({
  selector: 'sep-credora-home',
  standalone: true,
  imports: [IonContent, IonIcon, HeaderMobileComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredoraHomeComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly cards = CARDS;

  constructor() {
    addIcons({ businessOutline, trendingUpOutline, swapHorizontalOutline, walletOutline });
  }
}
