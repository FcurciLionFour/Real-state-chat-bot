import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../services/auth.store';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.ready()) {
    await authStore.bootstrap();
  }

  if (authStore.isAuthenticated()) {
    return true;
  }

  const refreshed = await authStore.refreshAccessToken();

  if (refreshed) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: {
      redirectTo: state.url,
    },
  });
};
