import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
  {
    path: 'design-system',
    loadChildren: () =>
      import('./features/design-system/design-system.routes').then((m) => m.DESIGN_SYSTEM_ROUTES),
  },
  {
    path: 'app',
    loadChildren: () =>
      import('./features/authenticated/authenticated.routes').then((m) => m.AUTHENTICATED_ROUTES),
  },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./features/error/access-denied.component').then((m) => m.AccessDeniedComponent),
  },
  {
    path: 'session-expired',
    loadComponent: () =>
      import('./features/error/session-expired.component').then((m) => m.SessionExpiredComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
