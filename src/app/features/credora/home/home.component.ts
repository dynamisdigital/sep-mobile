import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronForwardOutline,
  personCircleOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';

import { TipoCredora } from '../../../core/api/api.models';
import { CredoraContextStore } from '../../../core/credores/credora-context.store';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { CredoraStatusComponent } from '../shared/credora-status.component';

const ROTULO_TIPO: Record<TipoCredora, string> = {
  EMPRESA: 'Empresa',
  INSTITUICAO_FINANCEIRA: 'Instituicao financeira',
};

// Dashboard da empresa credora. Substitui a casca "Em breve" por uma visao real: razao social,
// tipo, status/elegibilidade e atalhos para perfil, oportunidades e carteira. Contagens sao
// apenas o tamanho das listas retornadas — nao calcula total aportado, rentabilidade ou exposicao.
// Perfil/status vem do contexto (/me); as contagens carregam em paralelo e uma falha nao apaga a
// outra nem o perfil.
@Component({
  selector: 'sep-credora-home',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonSpinner,
    IonButton,
    RouterLink,
    HeaderMobileComponent,
    CredoraStatusComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredoraHomeComponent implements OnInit {
  private readonly store = inject(CredoraContextStore);
  private readonly service = inject(CredoraMobileService);

  readonly estado = this.store.estado;
  readonly credora = this.store.credora;

  readonly oportunidadesCount = signal<number | null>(null);
  readonly carteiraCount = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.carregar();
  }

  async carregar(): Promise<void> {
    const presenca = await this.store.carregar();
    if (presenca === 'presente') {
      await this.carregarContagens();
    }
  }

  // Contagens sao acessorias: as duas listas carregam em paralelo e a falha de uma nao apaga o
  // perfil nem a outra contagem (cada uma vira null e cai no texto de fallback).
  private async carregarContagens(): Promise<void> {
    const oportunidades = this.contar(() => this.service.listarOportunidades());
    const carteira = this.contar(() => this.service.listarCarteira());
    this.oportunidadesCount.set(await oportunidades);
    this.carteiraCount.set(await carteira);
  }

  private async contar(carregar: () => Promise<unknown[]>): Promise<number | null> {
    try {
      return (await carregar()).length;
    } catch {
      return null;
    }
  }

  protected rotuloTipo(tipo: TipoCredora): string {
    return ROTULO_TIPO[tipo];
  }

  constructor() {
    addIcons({ personCircleOutline, trendingUpOutline, walletOutline, chevronForwardOutline });
  }
}
