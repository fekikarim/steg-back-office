import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { StIconComponent } from './icon.component';
import { I18nService } from '../../core/i18n.service';

/** Server-side pagination control. Emits page/size; parent fetches from backend. */
@Component({
  selector: 'st-pagination',
  standalone: true,
  imports: [StIconComponent],
  template: `
    <nav class="st-pager" [attr.aria-label]="i18n.t('table.rowsPerPage')">
      <label class="st-pager__size">
        <span>{{ i18n.t('table.rowsPerPage') }}</span>
        <select
          [value]="size"
          (change)="onSize($event)"
          aria-label="{{ i18n.t('table.rowsPerPage') }}"
        >
          @for (opt of [10, 20, 50]; track opt) {
            <option [value]="opt" [selected]="opt === size">{{ opt }}</option>
          }
        </select>
      </label>
      <span class="st-pager__info" aria-live="polite">{{
        i18n.t('table.pageOf', { page: page + 1, pages: totalPages })
      }}</span>
      <div class="st-pager__btns">
        <button
          type="button"
          class="st-icon-btn"
          (click)="prev.emit()"
          [disabled]="page <= 0"
          [attr.aria-label]="'Previous'"
        >
          <st-icon name="chevronLeft" [size]="16" [mirror]="true" />
        </button>
        <button
          type="button"
          class="st-icon-btn"
          (click)="next.emit()"
          [disabled]="page + 1 >= totalPages"
          [attr.aria-label]="'Next'"
        >
          <st-icon name="chevronRight" [size]="16" [mirror]="true" />
        </button>
      </div>
    </nav>
  `,
  styles: [
    `
      .st-pager {
        display: flex;
        align-items: center;
        gap: 1rem;
        justify-content: flex-end;
        flex-wrap: wrap;
        padding: 0.6rem 0;
        font-size: 0.82rem;
        color: var(--text-secondary);
      }
      .st-pager__size {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      select {
        background: var(--bg-surface);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: 0.45rem;
        padding: 0.3rem 0.5rem;
      }
    `,
  ],
})
export class PaginationComponent {
  readonly i18n = inject(I18nService);
  @Input() page = 0;
  @Input() size = 20;
  @Input() totalPages = 1;
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() sizeChange = new EventEmitter<number>();

  onSize(event: Event): void {
    const value = Number((event.target as HTMLSelectElement | null)?.value ?? this.size);
    this.sizeChange.emit(value);
  }
}
