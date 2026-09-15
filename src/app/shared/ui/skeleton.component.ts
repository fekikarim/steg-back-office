import { Component, Input } from '@angular/core';

/** Skeleton loader for content areas (never a blank page while loading). */
@Component({
  selector: 'st-skeleton',
  standalone: true,
  template: `
    <div class="st-skel" role="status" aria-label="Loading">
      @for (row of rowsArray(); track $index) {
        <div class="st-skel__row" [style.inline-size]="width"></div>
      }
      <span class="st-sr-only">Loading…</span>
    </div>
  `,
  styles: [
    `
      .st-skel {
        display: grid;
        gap: 0.5rem;
      }
      .st-skel__row {
        block-size: 0.9rem;
        border-radius: 0.35rem;
        background: linear-gradient(
          90deg,
          var(--border-subtle),
          var(--border-default),
          var(--border-subtle)
        );
        background-size: 200% 100%;
        animation: st-shimmer 1.2s infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .st-skel__row {
          animation: none;
        }
      }
      @keyframes st-shimmer {
        to {
          background-position: -200% 0;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  @Input() rows = 3;
  @Input() width = '100%';
  rowsArray(): number[] {
    return Array.from({ length: Math.max(1, this.rows) }, (_, i) => i);
  }
}
