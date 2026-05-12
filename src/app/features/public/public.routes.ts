import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./splash/splash.component').then((m) => m.SplashComponent),
  },
  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome.component').then((m) => m.WelcomeComponent),
  },
  {
    path: 'login',
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
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
  },
];
