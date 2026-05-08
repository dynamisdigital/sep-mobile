import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/auth/auth.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

@Component({
  selector: 'sep-profile',
  standalone: true,
  imports: [IonContent, RouterLink, HeaderMobileComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly loading = this.auth.loadingUser;
  readonly shortId = computed(() => {
    const id = this.user()?.id;
    if (!id) {
      return '';
    }
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  });

  async reload(): Promise<void> {
    await this.auth.loadCurrentUser();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/welcome');
  }
}
