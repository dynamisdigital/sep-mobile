import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonHeader, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, moonOutline, notificationsOutline, sunnyOutline } from 'ionicons/icons';

import { AuthService } from '../../core/auth/auth.service';
import {
  ContagemNaoLidas,
  NotificacoesNaoLidasStore,
} from '../../core/notificacoes/notificacoes-nao-lidas.store';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'sep-header-mobile',
  standalone: true,
  imports: [IonHeader, IonIcon],
  templateUrl: './header-mobile.component.html',
  styleUrl: './header-mobile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderMobileComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly naoLidas = inject(NotificacoesNaoLidasStore);

  readonly user = this.auth.currentUser;
  readonly userEmail = computed(() => this.user()?.username ?? '');
  readonly userRole = computed(() => this.user()?.role ?? null);
  readonly isDark = this.themeService.isDark;
  // O numero visivel e decorativo (aria-hidden); o rotulo do botao diz a mesma coisa por extenso,
  // inclusive quando a contagem ainda nao chegou ou falhou — situacoes que nao podem soar como zero.
  readonly rotuloNotificacoes = computed(() => rotuloDaContagem(this.naoLidas.contagem()));
  readonly marcadorNotificacoes = computed(() => marcadorDaContagem(this.naoLidas.contagem()));
  readonly situacaoNotificacoes = computed(
    () => this.naoLidas.contagem()?.situacao ?? 'carregando',
  );

  constructor() {
    addIcons({ logOutOutline, sunnyOutline, moonOutline, notificationsOutline });
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  abrirNotificacoes(): void {
    void this.router.navigateByUrl('/app/notificacoes');
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/welcome');
  }
}

// `null` e a contagem ainda nao pedida para este usuario: para quem usa leitor de tela e o mesmo que
// carregando, e nenhum dos dois pode ser anunciado como "nenhuma nao lida".
function rotuloDaContagem(contagem: ContagemNaoLidas | null): string {
  if (contagem === null || contagem.situacao === 'carregando') {
    return 'Notificacoes, carregando contagem';
  }
  if (contagem.situacao === 'indisponivel') {
    return 'Notificacoes, contagem indisponivel';
  }
  const quantidade =
    contagem.naoLidas === 0
      ? 'nenhuma nao lida'
      : contagem.naoLidas === 1
        ? '1 nao lida'
        : `${contagem.naoLidas} nao lidas`;
  // Numero de uma consulta anterior cuja atualizacao falhou: o marcador segue igual, o rotulo avisa.
  return contagem.situacao === 'desatualizada'
    ? `Notificacoes, ${quantidade}, pode estar desatualizado`
    : `Notificacoes, ${quantidade}`;
}

// Zero e carregando nao tem marcador; indisponivel tem um proprio, para nao se confundir com zero.
function marcadorDaContagem(contagem: ContagemNaoLidas | null): string | null {
  if (contagem?.situacao === 'indisponivel') {
    return '?';
  }
  if (!contagem || contagem.situacao === 'carregando' || contagem.naoLidas === 0) {
    return null;
  }
  return contagem.naoLidas > 99 ? '99+' : String(contagem.naoLidas);
}
