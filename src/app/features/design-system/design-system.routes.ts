import { Routes } from '@angular/router';

export const DESIGN_SYSTEM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./showcase.component').then((m) => m.ShowcaseComponent),
    children: [
      {
        path: '',
        redirectTo: 'colors',
        pathMatch: 'full',
      },
      {
        path: 'colors',
        loadComponent: () => import('./pages/colors.component').then((m) => m.ColorsComponent),
      },
      {
        path: 'typography',
        loadComponent: () =>
          import('./pages/typography.component').then((m) => m.TypographyComponent),
      },
      {
        path: 'components',
        loadComponent: () =>
          import('./pages/components.component').then((m) => m.ComponentsComponent),
      },
      {
        path: 'navigation',
        loadComponent: () =>
          import('./pages/navigation.component').then((m) => m.NavigationComponent),
      },
    ],
  },
];
