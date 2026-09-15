import { Component, Input, Output, EventEmitter } from '@angular/core';
import { StIconComponent } from './icon.component';

@Component({
  selector: 'st-empty-state',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <div class="st-state">
      <st-icon name="folder" [size]="28" />
      <h3 class="st-state__title">{{ title }}</h3>
      <p class="st-state__body">{{ body }}</p>
      @if (actionLabel) {
        <button type="button" class="st-btn st-btn--secondary" (click)="action.emit()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .st-state {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--text-secondary);
        display: grid;
        gap: 0.5rem;
        justify-items: center;
      }
      .st-state__title {
        margin: 0;
        font-size: 1rem;
        color: var(--text-primary);
      }
      .st-state__body {
        margin: 0;
        font-size: 0.85rem;
        max-inline-size: 32rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() body = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}

@Component({
  selector: 'st-error-state',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <div class="st-state" role="alert">
      <st-icon name="alert" [size]="28" />
      <h3 class="st-state__title">{{ title }}</h3>
      <p class="st-state__body">{{ body }}</p>
      <button type="button" class="st-btn st-btn--secondary" (click)="retry.emit()">
        <st-icon name="refresh" [size]="15" /> {{ retryLabel }}
      </button>
    </div>
  `,
  styles: [
    `
      .st-state {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--text-secondary);
        display: grid;
        gap: 0.5rem;
        justify-items: center;
      }
      .st-state__title {
        margin: 0;
        font-size: 1rem;
        color: var(--text-primary);
      }
      .st-state__body {
        margin: 0;
        font-size: 0.85rem;
        max-inline-size: 32rem;
      }
    `,
  ],
})
export class ErrorStateComponent {
  @Input() title = '';
  @Input() body = '';
  @Input() retryLabel = 'Retry';
  @Output() retry = new EventEmitter<void>();
}
