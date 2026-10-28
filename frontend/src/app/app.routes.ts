import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { LoginPageComponent } from './features/auth/login-page.component';
import { RegisterPageComponent } from './features/auth/register-page.component';
import { HomePageComponent } from './features/home/home-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
  },
  {
    path: 'login',
    component: LoginPageComponent,
  },
  {
    path: 'register',
    component: RegisterPageComponent,
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./features/blog/blog-shell.component').then((module) => module.BlogShellComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./features/blog/blog-detail-page.component').then((module) => module.BlogDetailPageComponent),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/workspace/workspace-page.component').then((module) => module.WorkspacePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./features/workspace/workspace-page.component').then((module) => module.WorkspacePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/chats',
    loadComponent: () =>
      import('./features/workspace/workspace-page.component').then((module) => module.WorkspacePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/chats/:id',
    loadComponent: () =>
      import('./features/workspace/workspace-page.component').then((module) => module.WorkspacePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/favorites',
    loadComponent: () =>
      import('./features/favorites/favorites-page.component').then((module) => module.FavoritesPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/compare',
    loadComponent: () =>
      import('./features/favorites/favorites-page.component').then((module) => module.FavoritesPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/profile',
    loadComponent: () => import('./features/profile/profile-page.component').then((module) => module.ProfilePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/map',
    loadComponent: () => import('./features/map/map-page.component').then((module) => module.MapPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/publish-property',
    loadComponent: () =>
      import('./features/owner-properties/owner-property-form-page.component').then(
        (module) => module.OwnerPropertyFormPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'app/my-properties',
    loadComponent: () =>
      import('./features/owner-properties/my-properties-page.component').then((module) => module.MyPropertiesPageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'app/my-properties/:id/edit',
    loadComponent: () =>
      import('./features/owner-properties/owner-property-form-page.component').then(
        (module) => module.OwnerPropertyFormPageComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'app/admin',
    loadComponent: () =>
      import('./features/admin/admin-page.component').then((module) => module.AdminPageComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
