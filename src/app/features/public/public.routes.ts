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
    path: 'register',
    loadComponent: () => import('./register/register.component').then((m) => m.RegisterComponent),
  },
];
