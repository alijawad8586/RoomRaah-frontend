import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BadgeComponent, ButtonComponent } from '../../shared/components';
import { ReportDialogComponent } from './report-dialog.component';
import { EngagementService } from '../../core/services/engagement.service';
import { PropertyService } from '../../core/services/property.service';
import { toFailure } from '../../core/http/api-error';
import {
  PropertyDetail,
  Review,
  VerificationCheck,
  VerificationCheckType,
} from '../../core/models/catalog.model';

/** The five checks, in the order the product talks about them. */
const CHECK_LABELS: Record<VerificationCheckType, string> = {
  OwnerIdentity: 'Owner identity',
  Address: 'Address',
  Photos: 'Photographs',
  Facilities: 'Facilities',
  Availability: 'Availability',
};

/**
 * One listing.
 *
 * The thing to know before changing anything here: no direct line to the owner appears on
 * this page, and none is missing. `owner` is a display name and whether their identity was
 * checked - that is the entire shape the API returns to a seeker. Reaching them happens
 * through messaging and visit requests, which is why both features exist. A button
 * promising anything faster would have nothing to put in it.
 */
@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, BadgeComponent, ButtonComponent, ReportDialogComponent],
  templateUrl: './property-detail.component.html',
  styleUrls: ['./property-detail.component.scss'],
})
export class PropertyDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly properties = inject(PropertyService);
  private readonly engagement = inject(EngagementService);

  readonly listing = signal<PropertyDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly reviews = signal<Review[]>([]);
  readonly averageRating = signal(0);
  readonly reviewCount = signal(0);

  readonly activePhoto = signal(0);
  readonly reportOpen = signal(false);

  readonly photos = computed(() => this.listing()?.photos ?? []);
  readonly hasBeds = computed(() => (this.listing()?.availableBeds ?? 0) > 0);

  /** The one photograph every card shows. Rule 15: exactly one is primary. */
  readonly primaryPhoto = computed(
    () => this.photos().find((photo) => photo.isPrimary) ?? this.photos()[0] ?? null,
  );

  readonly monthlyTotal = computed(() => {
    const listing = this.listing();
    if (!listing) return 0;
    return listing.monthlyRent + listing.utilitiesCharge + listing.messCharge;
  });

  constructor() {
    // So the save button knows which way round it is before anybody presses it.
    this.engagement.primeShortlist();

    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isFinite(id) || id <= 0) {
        this.loading.set(false);
        this.error.set('That listing does not exist.');
        return;
      }
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.activePhoto.set(0);

    this.properties.detail(id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);
      },
      error: (err) => {
        // A 404 here means unpublished as well as absent, and the message says which.
        this.error.set(toFailure(err).message);
        this.loading.set(false);
      },
    });

    // The first few reviews sit on this page; the rest have their own. A failure to load
    // them must not take the listing down with it, so it is swallowed into an empty list.
    this.properties.reviews(id, 1, 3).subscribe({
      next: (page) => {
        this.reviews.set(page.items ?? []);
        this.averageRating.set(page.averageRating ?? 0);
        this.reviewCount.set(page.totalCount ?? 0);
      },
      error: () => this.reviews.set([]),
    });
  }

  checkLabel(check: VerificationCheck): string {
    return CHECK_LABELS[check.checkType] ?? check.checkType;
  }

  checkVariant(check: VerificationCheck): 'confirmed' | 'danger' | 'neutral' {
    if (check.status === 'Checked') return 'confirmed';
    if (check.status === 'Failed') return 'danger';
    return 'neutral';
  }

  money(value: number): string {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  isSaved(id: number): boolean {
    return this.engagement.isSaved(id);
  }

  toggleSave(id: number): void {
    this.engagement.toggle(id, `/property/${id}`);
  }

  showPhoto(index: number): void {
    const count = this.photos().length;
    if (count === 0) return;
    this.activePhoto.set(((index % count) + count) % count);
  }
}
