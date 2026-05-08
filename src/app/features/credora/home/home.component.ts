import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/auth/auth.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

interface PlaceholderCard {
  label: string;
  description: string;
  testid: string;
}

const CARDS: readonly PlaceholderCard[] = [
  {
    label: 'Status do cadastro / KYB',
    description: 'Acompanhe a validacao do cadastro da empresa.',
    testid: 'sep-credora-card-kyb',
  },
  {
    label: 'Resumo de oportunidades',
    description: 'Veja propostas disponiveis para aporte.',
    testid: 'sep-credora-card-oportunidades',
  },
  {
    label: 'Operacoes financiadas',
    description: 'Resumo de operacoes em andamento.',
    testid: 'sep-credora-card-operacoes',
  },
  {
    label: 'Carteira',
    description: 'Visao consolidada da carteira.',
    testid: 'sep-credora-card-carteira',
  },
];

@Component({
  selector: 'sep-credora-home',
  standalone: true,
  imports: [IonContent, HeaderMobileComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredoraHomeComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly cards = CARDS;
}
