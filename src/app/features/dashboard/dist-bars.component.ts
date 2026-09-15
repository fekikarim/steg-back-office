import { Component, Input } from '@angular/core';
import { totalOf, type GroupCountDto } from '../../core/api-models';

/**
 * Restrained distribution display: labelled rows with proportional bars.
 * Data-driven only (backend GroupCountDto) — never decorative.
 * Bars are aria-hidden; label + count text carries the meaning (no color-only).
 * `inline-size` keeps fill direction correct in RTL.
 */
@Component({
  selector: 'st-dist-bars',
  standalone: true,
  template: `
    <ul class="st-bars" role="list" [attr.aria-label]="label">
      @for (g of groups; track g.groupName) {
        <li class="st-bars__row">
          <span class="st-bars__name" dir="auto">{{ g.groupName }}</span>
          <span class="st-bars__track" aria-hidden="true">
            <span class="st-bars__fill" [style.inline-size.%]="pct(g.count)"></span>
          </span>
          <strong class="st-bars__count">{{ g.count }}</strong>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .st-bars {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
      }
      .st-bars__row {
        display: grid;
        grid-template-columns: minmax(7rem, 11rem) 1fr auto;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.82rem;
      }
      .st-bars__name {
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .st-bars__track {
        display: block;
        block-size: 0.55rem;
        border-radius: 999px;
        background: var(--border-subtle);
        overflow: hidden;
      }
      .st-bars__fill {
        display: block;
        block-size: 100%;
        background: var(--action-primary);
        border-radius: inherit;
      }
      .st-bars__count {
        min-inline-size: 2.5rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 480px) {
        .st-bars__row {
          grid-template-columns: 1fr auto;
        }
        .st-bars__track {
          display: none;
        }
      }
    `,
  ],
})
export class DistBarsComponent {
  @Input() label = '';
  @Input() groups: readonly GroupCountDto[] = [];

  pct(count: number): number {
    const total = totalOf(this.groups);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (count / total) * 100));
  }
}
