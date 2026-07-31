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

  // `ionViewDidEnter`, e nao `ngAfterViewInit`: no `ngAfterViewInit` a pagina ainda esta sendo
  // animada para dentro do outlet e `focus()` em elemento invisivel e no-op. Ver o comentario
  // equivalente em `account-locked.component.ts`.
  ionViewDidEnter(): void {
    // Destino de redirect do `roleGuard` e do 403 no `errorInterceptor`. Mesmo motivo do
    // account-locked: o Angular nao move foco na navegacao, nao ha live region de rota e o
    // `focusManagerPriority` do Ionic esta desligado — sem isto quem usa leitor de tela nao
    // percebe que o acesso foi negado nem que a tela mudou.
    this.titulo().nativeElement.focus();
  }
}
