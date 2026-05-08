import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UsuarioRole } from '../api/api.models';
import { AuthService } from '../auth/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] ?? []) as UsuarioRole[];
  const user = auth.currentUser();

  if (!allowedRoles.length) {
    return true;
  }

  if (user && allowedRoles.includes(user.role)) {
    return true;
  }

  return router.parseUrl('/access-denied');
};
