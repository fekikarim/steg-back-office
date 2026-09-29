import { Component, Input } from '@angular/core';
import { StIconComponent } from './icon.component';

/** Persistent inline alert for contextual problems (toast-only is not enough for critical ops). */
@Component({
  selector: 'st-alert',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <div class="st-alert st-alert--{{ tone }}" role="alert">
      <st-icon
        [name]="tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info'"
        [size]="16"
      />
      <div class="st-alert__body">
        @if (title) {
          <strong class="st-alert__title">{{ title }}</strong>
        }
        <span class="st-alert__msg"><ng-content /></span>
      </div>
    </div>
  `,
  styles: [
    `
      .st-alert {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
        padding: 0.7rem 0.85rem;
        border-radius: var(--radius);
        border: 1px solid var(--border-default);
        background: var(--bg-surface);
        font-size: 0.85rem;
      }
      .st-alert st-icon {
        margin-block-start: 0.1rem;
        flex: none;
      }
      .st-alert--info {
        border-inline-start: 3px solid var(--status-info);
        background: color-mix(in srgb, var(--status-info) 5%, var(--bg-surface));
      }
      .st-alert--success {
        border-inline-start: 3px solid var(--status-success);
        background: color-mix(in srgb, var(--status-success) 5%, var(--bg-surface));
      }
      .st-alert--warning {
        border-inline-start: 3px solid var(--status-warning);
        background: color-mix(in srgb, var(--status-warning) 5%, var(--bg-surface));
      }
      .st-alert--error {
        border-inline-start: 3px solid var(--status-error);
        background: color-mix(in srgb, var(--status-error) 5%, var(--bg-surface));
      }
      .st-alert__title {
        display: block;
        margin-block-end: 0.15rem;
      }
    `,
  ],
})
export class AlertComponent {
  @Input() tone: 'info' | 'success' | 'warning' | 'error' = 'info';
  @Input() title = '';
}
