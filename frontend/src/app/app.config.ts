// Routing decision: hash routing (URLs like /#/survey) rather than the
// 404.html redirect trick. Rationale:
//  - Visitors arrive via QR code → always land at root, never a deep link.
//  - Admins bookmark /#/admin/login, which works fine as a hash URL.
//  - Zero configuration needed; the 404.html approach is a visible redirect hack.
//  - No SEO requirement for a mobile feedback form.

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
