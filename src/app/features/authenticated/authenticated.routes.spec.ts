import { describe, expect, it } from 'vitest';

import { authGuard } from '../../core/guards/auth.guard';
import { AUTHENTICATED_ROUTES } from './authenticated.routes';

describe('AUTHENTICATED_ROUTES', () => {
  const parent = AUTHENTICATED_ROUTES[0];
  const children = parent.children ?? [];

  it('protege a area autenticada com authGuard', () => {
    expect(parent.canActivate).toContain(authGuard);
  });

  it('registra a rota onboarding sob o shell autenticado, com lazy load', () => {
    const onboarding = children.find((route) => route.path === 'onboarding');
    expect(onboarding).toBeDefined();
    expect(onboarding?.loadComponent).toBeTypeOf('function');
  });
});
