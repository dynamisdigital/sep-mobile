import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
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
export class AccessDeniedComponent {
  private readonly auth = inject(AuthService);

  readonly fallbackLink = computed(() => (this.auth.currentUser() ? '/app/inicio' : '/welcome'));
  readonly fallbackLabel = computed(() =>
    this.auth.currentUser() ? 'Voltar ao inicio' : 'Voltar ao welcome',
  );
}
