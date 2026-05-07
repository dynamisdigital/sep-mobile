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
    path: '**',
    redirectTo: '',
  },
];
