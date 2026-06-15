import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  calendarOutline,
  cloudUploadOutline,
  documentTextOutline,
  searchOutline,
  shieldCheckmarkOutline,
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

interface PlaceholderShortcut {
  label: string;
  description: string;
  testid: string;
  icon: string;
  tone: string;
}

const CARDS: readonly PlaceholderCard[] = [
  {
    label: 'Status do cadastro',
    description: 'Verifique se seu cadastro esta completo.',
    testid: 'sep-tomador-card-cadastro',
    icon: 'shield-checkmark-outline',
    tone: 'var(--primary)',
  },
  {
    label: 'Proposta ativa',
    description: 'Acompanhe a analise da proposta atual.',
    testid: 'sep-tomador-card-proposta',
    icon: 'document-text-outline',
    tone: 'var(--secondary)',
  },
  {
    label: 'Proximas parcelas',
    description: 'Visualize parcelas a vencer.',
    testid: 'sep-tomador-card-parcelas',
    icon: 'calendar-outline',
    tone: 'var(--warning)',
  },
];

const SHORTCUTS: readonly PlaceholderShortcut[] = [
  {
    label: 'Onboarding',
    description: 'Envie documentos para o onboarding.',
    testid: 'sep-tomador-shortcut-onboarding',
    icon: 'cloud-upload-outline',
    tone: 'var(--primary)',
  },
  {
    label: 'Solicitar emprestimo',
    description: 'Inicie uma nova proposta de credito.',
    testid: 'sep-tomador-shortcut-solicitar',
    icon: 'add-circle-outline',
    tone: 'var(--secondary)',
  },
  {
    label: 'Acompanhar proposta',
    description: 'Veja status detalhado da analise.',
    testid: 'sep-tomador-shortcut-acompanhar',
    icon: 'search-outline',
    tone: 'var(--warning)',
  },
];

@Component({
  selector: 'sep-tomador-home',
  standalone: true,
  imports: [IonContent, IonIcon, HeaderMobileComponent],
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

  constructor() {
    addIcons({
      shieldCheckmarkOutline,
      documentTextOutline,
      calendarOutline,
      cloudUploadOutline,
      addCircleOutline,
      searchOutline,
    });
  }

  showSoon(): void {
    this.soonMessage.set('Funcionalidade em breve.');
    setTimeout(() => this.soonMessage.set(null), 2500);
  }
}
