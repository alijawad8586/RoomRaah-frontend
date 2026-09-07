import { Routes } from '@angular/router';
import { ownerGuard, adminGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
    title: 'RoomRaah — rooms and hostels across Pakistan',
  },
  {
    path: 'how-it-works',
    loadComponent: () =>
      import('./features/how-it-works/how-it-works.component').then((m) => m.HowItWorksComponent),
    title: 'How it works — RoomRaah',
  },
  {
    path: 'design-system',
    loadComponent: () =>
      import('./features/design-system/design-system.component').then(
        (m) => m.DesignSystemComponent
      ),
    title: 'Design System — RoomRaah',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
    title: 'Search rooms — RoomRaah',
  },
  {
    path: 'property/:id/photos',
    loadComponent: () =>
      import('./features/property-detail/photos.component').then((m) => m.PropertyPhotosComponent),
    title: 'Photographs — RoomRaah',
  },
  {
    path: 'property/:id/reviews',
    loadComponent: () =>
      import('./features/property-detail/reviews.component').then(
        (m) => m.PropertyReviewsComponent
      ),
    title: 'Reviews — RoomRaah',
  },
  {
    path: 'property/:id',
    loadComponent: () =>
      import('./features/property-detail/property-detail.component').then(
        (m) => m.PropertyDetailComponent
      ),
    title: 'Listing — RoomRaah',
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then((m) => m.SignupComponent),
    title: 'Sign Up — RoomRaah',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign In — RoomRaah',
  },
  {
    path: 'verify',
    loadComponent: () =>
      import('./features/auth/verify/verify.component').then((m) => m.VerifyComponent),
    title: 'Verify Email — RoomRaah',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
    title: 'Reset Password — RoomRaah',
  },
  {
    path: 'owner',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./features/owner/owner-dashboard-placeholder.component').then(
        (m) => m.OwnerDashboardPlaceholderComponent
      ),
    title: 'Owner Dashboard — RoomRaah',
  },
  {
    path: 'admin/listings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-listings-placeholder.component').then(
        (m) => m.AdminListingsPlaceholderComponent
      ),
    title: 'Admin Listings — RoomRaah',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page Not Found — RoomRaah',
  },
];
