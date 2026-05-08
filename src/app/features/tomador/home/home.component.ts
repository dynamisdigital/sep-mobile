import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/auth/auth.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

interface PlaceholderCard {
  label: string;
  description: string;
  testid: string;
}

interface PlaceholderShortcut {
  label: string;
  description: string;
  testid: string;
}

const CARDS: readonly PlaceholderCard[] = [
  {
    label: 'Status do cadastro',
    description: 'Verifique se seu cadastro esta completo.',
    testid: 'sep-tomador-card-cadastro',
  },
  {
    label: 'Proposta ativa',
    description: 'Acompanhe a analise da proposta atual.',
    testid: 'sep-tomador-card-proposta',
  },
  {
    label: 'Proximas parcelas',
    description: 'Visualize parcelas a vencer.',
    testid: 'sep-tomador-card-parcelas',
  },
];

const SHORTCUTS: readonly PlaceholderShortcut[] = [
  {
    label: 'Onboarding',
    description: 'Envie documentos para o onboarding.',
    testid: 'sep-tomador-shortcut-onboarding',
  },
  {
    label: 'Solicitar emprestimo',
    description: 'Inicie uma nova proposta de credito.',
    testid: 'sep-tomador-shortcut-solicitar',
  },
  {
    label: 'Acompanhar proposta',
    description: 'Veja status detalhado da analise.',
    testid: 'sep-tomador-shortcut-acompanhar',
  },
];

@Component({
  selector: 'sep-tomador-home',
  standalone: true,
  imports: [IonContent, HeaderMobileComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TomadorHomeComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly cards = CARDS;
  readonly shortcuts = SHORTCUTS;
  readonly soonMessage = signal<string | null>(null);

  showSoon(): void {
    this.soonMessage.set('Funcionalidade em breve.');
    setTimeout(() => this.soonMessage.set(null), 2500);
  }
}
