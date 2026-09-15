import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';

/** Date-range control (from/to) with localized labels; emits on apply/reset. */
@Component({
  selector: 'st-date-range',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="st-dates">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.dateFrom') }}</span>
        <input type="date" class="st-input" [(ngModel)]="from" />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.dateTo') }}</span>
        <input type="date" class="st-input" [(ngModel)]="to" />
      </label>
      <div class="st-dates__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="apply.emit({ from, to })">
          {{ i18n.t('common.apply') }}
        </button>
        <button type="button" class="st-btn st-btn--text" (click)="onReset()">
          {{ i18n.t('common.reset') }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .st-dates {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        align-items: flex-end;
      }
      .st-field {
        display: grid;
        gap: 0.25rem;
        font-size: 0.78rem;
        color: var(--text-secondary);
      }
      .st-dates__actions {
        display: flex;
        gap: 0.4rem;
      }
    `,
  ],
})
export class DateRangeComponent {
  readonly i18n = inject(I18nService);
  @Input() from = '';
  @Input() to = '';
  @Output() apply = new EventEmitter<{ from: string; to: string }>();
  @Output() reset = new EventEmitter<void>();

  onReset(): void {
    this.from = '';
    this.to = '';
    this.reset.emit();
  }
}
