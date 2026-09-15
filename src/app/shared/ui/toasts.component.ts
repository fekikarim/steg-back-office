import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { StIconComponent } from './icon.component';

@Component({
  selector: 'st-toasts',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <div class="st-toasts" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="st-toast st-toast--{{ toast.kind }}">
          <st-icon
            [name]="toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'"
            [size]="16"
          />
          <span class="st-toast__msg">{{ toast.message }}</span>
          <button
            type="button"
            class="st-toast__close"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            <st-icon name="close" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .st-toasts {
        position: fixed;
        inset-block-end: 1rem;
        inset-inline-end: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 200;
        max-inline-size: min(22rem, calc(100vw - 2rem));
      }
      .st-toast {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 0.8rem;
        border-radius: 0.6rem;
        border: 1px solid var(--border-default);
        background: var(--bg-elevated);
        color: var(--text-primary);
        box-shadow: var(--shadow-md);
        font-size: 0.85rem;
      }
      .st-toast--success {
        border-inline-start: 3px solid var(--status-success);
      }
      .st-toast--error {
        border-inline-start: 3px solid var(--status-error);
      }
      .st-toast--warning {
        border-inline-start: 3px solid var(--status-warning);
      }
      .st-toast--info {
        border-inline-start: 3px solid var(--status-info);
      }
      .st-toast__msg {
        flex: 1;
      }
      .st-toast__close {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        display: inline-flex;
        padding: 0.25rem;
        border-radius: 0.4rem;
        min-block-size: 2rem;
        min-inline-size: 2rem;
        align-items: center;
        justify-content: center;
      }
      .st-toast__close:focus-visible {
        outline: 2px solid var(--action-primary);
        outline-offset: 2px;
      }
    `,
  ],
})
export class ToastsComponent {
  readonly toasts = inject(ToastService);
}
