import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, ButtonComponent } from '../../shared/components';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, ButtonComponent],
  template: `
    <div class="container-centered not-found-page">
      <app-empty-state
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        icon="search"
      >
        <a routerLink="/design-system">
          <app-button variant="primary">Return Home</app-button>
        </a>
      </app-empty-state>
    </div>
  `,
  styles: [
    `
      .not-found-page {
        padding: 4rem 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    `,
  ],
})
export class NotFoundComponent {}
