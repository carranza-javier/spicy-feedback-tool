import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: 'exhibitions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./exhibitions-list/exhibitions-list').then((m) => m.ExhibitionsList),
  },
  {
    path: 'exhibitions/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./exhibition-edit/exhibition-edit').then((m) => m.ExhibitionEdit),
  },
  {
    path: 'exhibitions/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./exhibition-edit/exhibition-edit').then((m) => m.ExhibitionEdit),
  },
  {
    path: 'exhibitions/:id/dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
];
