import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

export const adminGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.ready()) {
    await authStore.bootstrap();
  }

  if (authStore.user()?.role === 'ADMIN') {
    return true;
  }

  return router.createUrlTree(['/app/chats']);
};
