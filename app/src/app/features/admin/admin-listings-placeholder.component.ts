import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BadgeComponent, ButtonComponent, EmptyStateComponent } from '../../shared/components';

@Component({
  selector: 'app-admin-listings-placeholder',
  standalone: true,
  imports: [RouterLink, BadgeComponent, ButtonComponent, EmptyStateComponent],
  template: `
    <div class="container-centered placeholder-container">
      <div class="placeholder-card">
        <div class="placeholder-header">
          <h2>Admin Listings Management</h2>
          <app-badge variant="inspection" size="sm">Admin</app-badge>
        </div>
        <app-empty-state
          title="Admin Control Panel"
          [description]="'Welcome, ' + (auth.currentUser()?.fullName || 'Admin') + '! Listing approvals, revision review, and verification queue will be available here.'"
          icon="shield"
        >
          <a routerLink="/design-system">
            <app-button variant="outline">View Design System</app-button>
          </a>
        </app-empty-state>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'tokens' as *;

      .placeholder-container {
        padding: $space-8 $space-4;
        display: flex;
        justify-content: center;
      }

      .placeholder-card {
        width: 100%;
        max-width: 640px;
        background-color: $color-surface;
        border: 1px solid $color-slate-200;
        border-radius: $radius-lg;
        padding: $space-8;
        box-shadow: $shadow-sm;
      }

      .placeholder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: $space-6;
        padding-bottom: $space-4;
        border-bottom: 1px solid $color-slate-100;

        h2 {
          font-size: $font-size-xl;
          font-weight: $font-weight-bold;
          color: $color-navy;
          margin: 0;
        }
      }
    `,
  ],
})
export class AdminListingsPlaceholderComponent {
  readonly auth = inject(AuthService);
}
