import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'survey', pathMatch: 'full' },
  {
    path: 'survey',
    loadComponent: () => import('./public/survey/survey').then((m) => m.Survey),
  },
  {
    path: 'thank-you',
    loadComponent: () => import('./public/thank-you/thank-you').then((m) => m.ThankYou),
  },
  {
    path: 'closed',
    loadComponent: () => import('./public/closed/closed').then((m) => m.Closed),
  },
  {
    path: 'admin',
    // Admin feature is lazy-loaded as a child routes array (standalone Angular,
    // no NgModule). Guard will be added here in step 4 when auth is implemented.
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', redirectTo: 'survey' },
];
