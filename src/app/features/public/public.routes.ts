import { Routes } from '@angular/router';

import { redirectAuthenticatedGuard } from '../../core/guards/redirect-authenticated.guard';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./splash/splash.component').then((m) => m.SplashComponent),
  },
  {
    path: 'welcome',
    canActivate: [redirectAuthenticatedGuard],
    loadComponent: () => import('./welcome/welcome.component').then((m) => m.WelcomeComponent),
  },
  {
    path: 'login',
    canActivate: [redirectAuthenticatedGuard],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'login/verify-totp',
    loadComponent: () =>
      import('./login/verify-totp/verify-totp.component').then((m) => m.VerifyTotpComponent),
  },
  {
    path: 'account-locked',
    loadComponent: () =>
      import('./account-locked/account-locked.component').then((m) => m.AccountLockedComponent),
  },
  {
    path: 'register',
    canActivate: [redirectAuthenticatedGuard],
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
  },
];
