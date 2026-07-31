import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ViewDidEnter } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'sep-access-denied',
  standalone: true,
  imports: [IonContent, RouterLink],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedComponent implements ViewDidEnter {
  private readonly auth = inject(AuthService);
  private readonly titulo = viewChild.required<ElementRef<HTMLHeadingElement>>('titulo');

  readonly fallbackLink = computed(() => (this.auth.currentUser() ? '/app/inicio' : '/welcome'));
  readonly fallbackLabel = computed(() =>
    this.auth.currentUser() ? 'Voltar ao inicio' : 'Voltar ao welcome',
  );

  // `ionViewDidEnter`, e nao `ngAfterViewInit`: naquele momento o heading ainda nao tem caixa de
  // layout (`offsetParent === null`) porque os web components do Ionic nao renderizaram, e
  // `focus()` vira no-op. Ver o comentario com a medicao em `account-locked.component.ts`.
  ionViewDidEnter(): void {
    // Destino de redirect do `roleGuard` e do 403 no `errorInterceptor`. Mesmo motivo do
    // account-locked: o Angular nao move foco na navegacao, nao ha live region de rota e o
    // `focusManagerPriority` do Ionic esta desligado — sem isto quem usa leitor de tela nao
    // percebe que o acesso foi negado nem que a tela mudou.
    this.titulo().nativeElement.focus();
  }
}
