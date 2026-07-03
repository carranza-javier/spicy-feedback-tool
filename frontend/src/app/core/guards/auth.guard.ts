import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { JWT_STORAGE_KEY } from '../interceptors/auth-interceptor';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return sessionStorage.getItem(JWT_STORAGE_KEY)
    ? true
    : router.createUrlTree(['/admin/login']);
};
