import { Component, Input, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';

/** Skeleton loader for content areas (never a blank page while loading). */
@Component({
  selector: 'st-skeleton',
  standalone: true,
  template: `
    <div class="st-skel" role="status" [attr.aria-label]="i18n.t('common.loading')">
      @for (row of rowsArray(); track $index) {
        <div class="st-skel__row" [style.inline-size]="width"></div>
      }
      <span class="st-sr-only">{{ i18n.t('common.loading') }}</span>
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
  readonly i18n = inject(I18nService);
  @Input() rows = 3;
  @Input() width = '100%';
  rowsArray(): number[] {
    return Array.from({ length: Math.max(1, this.rows) }, (_, i) => i);
  }
}
