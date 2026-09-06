import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OwnerDashboardPlaceholderComponent } from './owner-dashboard-placeholder.component';

describe('OwnerDashboardPlaceholderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnerDashboardPlaceholderComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OwnerDashboardPlaceholderComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
