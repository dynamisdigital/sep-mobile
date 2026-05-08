import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser()) {
    return true;
  }

  if (!(await auth.hasToken())) {
    return router.parseUrl('/welcome');
  }

  const usuario = await auth.loadCurrentUser();
  if (usuario) {
    return true;
  }

  await auth.clearSession();
  return router.parseUrl('/welcome');
};
