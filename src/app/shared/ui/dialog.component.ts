import { Component, Input, Output, EventEmitter } from '@angular/core';

/** Accessible modal dialog with focus trap-lite (autofocus + Escape + labelled). */
@Component({
  selector: 'st-dialog',
  standalone: true,
  template: `
    @if (open) {
      <div class="st-dialog-backdrop" (click)="onBackdrop($event)">
        <div
          class="st-dialog"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="labelledBy"
          (keydown.escape)="close.emit()"
        >
          <div class="st-dialog__head">
            <h2 class="st-dialog__title" [id]="labelledBy">{{ title }}</h2>
            <button
              type="button"
              class="st-icon-btn"
              (click)="close.emit()"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
          <div class="st-dialog__body"><ng-content /></div>
          @if (showFooter) {
            <div class="st-dialog__foot"><ng-content select="[slot='footer']" /></div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .st-dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgb(2 12 24 / 0.5);
        display: grid;
        place-items: center;
        padding: 1rem;
        z-index: 150;
      }
      .st-dialog {
        background: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: 0.8rem;
        inline-size: min(34rem, 100%);
        max-block-size: min(85dvh, 50rem);
        overflow: auto;
        box-shadow: var(--shadow-md);
      }
      .st-dialog__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        border-block-end: 1px solid var(--border-subtle);
        position: sticky;
        inset-block-start: 0;
        background: var(--bg-elevated);
      }
      .st-dialog__title {
        margin: 0;
        font-size: 1rem;
      }
      .st-dialog__body {
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
      }
      .st-dialog__foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.9rem 1rem;
        border-block-start: 1px solid var(--border-subtle);
      }
    `,
  ],
})
export class DialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() showFooter = true;
  @Output() close = new EventEmitter<void>();
  readonly labelledBy = `st-dialog-${Math.floor(Math.random() * 100000)}`;

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}

/** Confirmation dialog for consequential actions (approve/reject/delete). */
@Component({
  selector: 'st-confirm-dialog',
  standalone: true,
  imports: [DialogComponent],
  template: `
    <st-dialog [open]="open" [title]="title" (close)="cancel.emit()">
      <p class="st-confirm__body">{{ body }}</p>
      @if (consequence) {
        <p class="st-confirm__consequence">{{ consequence }}</p>
      }
      <div slot="footer" class="st-confirm__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="cancel.emit()">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--danger"
          [disabled]="busy"
          (click)="confirmed.emit()"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </st-dialog>
  `,
  styles: [
    `
      .st-confirm__body {
        margin: 0;
      }
      .st-confirm__consequence {
        margin: 0;
        font-size: 0.82rem;
        color: var(--text-secondary);
      }
      .st-confirm__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() body = '';
  @Input() consequence = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() busy = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
