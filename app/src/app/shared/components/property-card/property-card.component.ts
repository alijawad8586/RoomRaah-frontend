import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PropertyCardItem } from './property-card.model';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [CommonModule, RouterLink, BadgeComponent, SkeletonComponent],
  templateUrl: './property-card.component.html',
  styleUrls: ['./property-card.component.scss'],
})
export class PropertyCardComponent {
  @Input() property: PropertyCardItem | null = null;
  @Input() loading: boolean = false;
  @Input() isSaved: boolean = false;

  @Output() saveToggled = new EventEmitter<number>();

  imageLoaded: boolean = false;
  imageFailed: boolean = false;

  onImageLoad(): void {
    this.imageLoaded = true;
  }

  onImageError(): void {
    this.imageFailed = true;
  }

  onSaveClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.property) {
      this.saveToggled.emit(this.property.id);
    }
  }

  get formattedRent(): string {
    if (!this.property) return '';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(this.property.monthlyRent);
  }

  get distanceLabel(): string | null {
    if (!this.property || this.property.distanceKm === null || this.property.distanceKm === undefined) {
      return null;
    }
    // Brief §8.3 & Rule 13: "Distance is straight-line. Label it that way."
    return `${this.property.distanceKm.toFixed(1)} km (straight-line)`;
  }
}
