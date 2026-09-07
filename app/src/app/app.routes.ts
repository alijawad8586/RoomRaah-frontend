import { Routes } from '@angular/router';
import { authGuard, ownerGuard, adminGuard, verifiedGuard } from './core/auth/guards';

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
    path: 'compare',
    loadComponent: () =>
      import('./features/compare/compare.component').then((m) => m.CompareComponent),
    title: 'Compare rooms — RoomRaah',
  },
  {
    path: 'saved',
    canActivate: [verifiedGuard],
    loadComponent: () =>
      import('./features/seeker/saved/saved.component').then((m) => m.SavedComponent),
    title: 'Saved rooms — RoomRaah',
  },
  {
    path: 'visits',
    canActivate: [verifiedGuard],
    loadComponent: () =>
      import('./features/seeker/visits/visits.component').then((m) => m.VisitsComponent),
    title: 'My visits — RoomRaah',
  },
  {
    path: 'property/:id/visit',
    canActivate: [verifiedGuard],
    loadComponent: () =>
      import('./features/seeker/visit-request/visit-request.component').then(
        (m) => m.VisitRequestComponent
      ),
    title: 'Request a visit — RoomRaah',
  },
  {
    path: 'property/:id/review',
    canActivate: [verifiedGuard],
    loadComponent: () =>
      import('./features/seeker/write-review/write-review.component').then(
        (m) => m.WriteReviewComponent
      ),
    title: 'Write a review — RoomRaah',
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
    path: 'messages',
    canActivate: [verifiedGuard],
    loadComponent: () =>
      import('./features/messages/messages.component').then((m) => m.MessagesComponent),
    title: 'Messages — RoomRaah',
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Your account — RoomRaah',
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
      import('./features/owner/owner-dashboard.component').then((m) => m.OwnerDashboardComponent),
    title: 'My listings — RoomRaah',
  },
  {
    path: 'owner/listing/:id',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./features/owner/listing-form.component').then((m) => m.ListingFormComponent),
    title: 'Listing — RoomRaah',
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
