import { Component, Input } from '@angular/core';
import { StIconComponent } from './icon.component';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'restricted';

/** Status badge: label + semantic color + icon. Never color-only (text always present). */
@Component({
  selector: 'st-badge',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <span class="st-badge st-badge--{{ tone }}">
      @if (icon) {
        <st-icon [name]="icon" [size]="13" />
      }
      <span>{{ label }}</span>
    </span>
  `,
  styles: [
    `
      .st-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.7rem;
        font-weight: 600;
        line-height: 1.35;
        padding: 0.24rem 0.55rem;
        border-radius: 999px;
        border: 1px solid var(--border-default);
        background: var(--bg-subtle);
        color: var(--text-secondary);
        white-space: nowrap;
        max-inline-size: 100%;
      }
      .st-badge--info {
        background: var(--brand-primary-soft);
        color: var(--brand-primary-strong);
        border-color: color-mix(in srgb, var(--brand-primary) 30%, transparent);
      }
      .st-badge--success {
        background: color-mix(in srgb, var(--status-success) 12%, var(--bg-surface));
        color: var(--status-success);
        border-color: color-mix(in srgb, var(--status-success) 32%, transparent);
      }
      .st-badge--warning {
        background: color-mix(in srgb, var(--status-warning) 12%, var(--bg-surface));
        color: var(--status-warning);
        border-color: color-mix(in srgb, var(--status-warning) 32%, transparent);
      }
      .st-badge--error {
        background: color-mix(in srgb, var(--brand-red-soft) 60%, var(--bg-surface));
        color: var(--status-error);
        border-color: color-mix(in srgb, var(--status-error) 32%, transparent);
      }
      .st-badge--restricted {
        background: color-mix(in srgb, var(--brand-red) 10%, var(--bg-surface));
        color: var(--brand-red-strong);
        border-color: color-mix(in srgb, var(--brand-red) 38%, transparent);
      }
    `,
  ],
})
export class BadgeComponent {
  @Input() label = '';
  @Input() tone: BadgeTone = 'neutral';
  @Input() icon?: string;
}
