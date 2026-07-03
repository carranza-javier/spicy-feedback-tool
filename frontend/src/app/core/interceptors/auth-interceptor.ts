// JWT interceptor — attaches the admin Bearer token to every outgoing request
// when one is present in sessionStorage.
//
// SessionStorage is intentional (spec § 9.1): the admin does not need
// the token to survive a browser restart or tab close.

import { HttpInterceptorFn } from '@angular/common/http';

export const JWT_STORAGE_KEY = 'spicy_admin_jwt';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem(JWT_STORAGE_KEY);

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
