import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonHeader, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, moonOutline, sunnyOutline } from 'ionicons/icons';

import { AuthService } from '../../core/auth/auth.service';
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

  readonly user = this.auth.currentUser;
  readonly userEmail = computed(() => this.user()?.username ?? '');
  readonly userRole = computed(() => this.user()?.role ?? null);
  readonly isDark = this.themeService.isDark;

  constructor() {
    addIcons({ logOutOutline, sunnyOutline, moonOutline });
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/welcome');
  }
}
