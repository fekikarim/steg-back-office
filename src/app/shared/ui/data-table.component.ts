import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StIconComponent } from './icon.component';
import { I18nService } from '../../core/i18n.service';

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly sortable?: boolean;
  readonly priority?: 'high' | 'medium' | 'low';
}

export interface SortState {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * Institutional DataTable. Server-side pagination/sorting/filtering only —
 * never load huge datasets client-side. Responsive: low-priority columns
 * hide on narrow screens; horizontal scroll is contained with sticky first col.
 */
@Component({
  selector: 'st-data-table',
  standalone: true,
  imports: [FormsModule, StIconComponent],
  template: `
    <div class="st-table-wrap">
      <table class="st-table">
        <thead>
          <tr>
            @for (col of columns; track col.key) {
              <th
                scope="col"
                [attr.data-priority]="col.priority ?? 'high'"
                [attr.aria-sort]="ariaSort(col.key)"
              >
                @if (col.sortable) {
                  <button
                    type="button"
                    class="st-th-sort"
                    (click)="toggleSort(col.key)"
                    [attr.aria-label]="
                      (isAsc(col.key) ? i18n.t('table.sortDesc') : i18n.t('table.sortAsc')) +
                      ': ' +
                      col.label
                    "
                  >
                    <span>{{ col.label }}</span>
                    <st-icon [name]="sortIcon(col.key)" [size]="13" />
                  </button>
                } @else {
                  {{ col.label }}
                }
              </th>
            }
            @if (hasActions) {
              <th scope="col" class="st-table__actions-head">
                <span class="st-sr-only">{{ i18n.t('page.actions') }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          <ng-content />
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      .st-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        background: var(--bg-surface);
      }
      .st-table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: 0.83rem;
        min-inline-size: 40rem;
      }
      thead th {
        text-align: start;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        padding: 0.65rem 0.8rem;
        border-block-end: 1px solid var(--border-subtle);
        background: var(--bg-surface);
        white-space: nowrap;
      }
      tbody td {
        padding: 0.65rem 0.8rem;
        border-block-end: 1px solid var(--border-subtle);
        color: var(--text-primary);
        vertical-align: middle;
      }
      tbody tr:last-child td {
        border-block-end: 0;
      }
      tbody tr:hover td {
        background: color-mix(in srgb, var(--action-primary) 4%, transparent);
      }
      .st-th-sort {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 0;
      }
      .st-th-sort:focus-visible {
        outline: 2px solid var(--action-primary);
        outline-offset: 2px;
        border-radius: 0.25rem;
      }
      .st-table__actions-head {
        inline-size: 3rem;
      }
      @media (max-width: 767px) {
        th[data-priority='low'],
        td[data-priority='low'] {
          display: none;
        }
      }
      @media (max-width: 480px) {
        th[data-priority='medium'],
        td[data-priority='medium'] {
          display: none;
        }
      }
    `,
  ],
})
export class DataTableComponent {
  readonly i18n = inject(I18nService);
  @Input() columns: readonly TableColumn[] = [];
  @Input() sort: SortState | null = null;
  @Input() hasActions = false;
  @Output() sortChange = new EventEmitter<SortState>();

  isAsc(key: string): boolean {
    return this.sort?.key === key && this.sort.direction === 'asc';
  }

  sortIcon(key: string): string {
    if (this.sort?.key !== key) return 'chevronDown';
    return this.sort.direction === 'asc' ? 'chevronDown' : 'chevronDown';
  }

  ariaSort(key: string): string | null {
    if (this.sort?.key !== key) return null;
    return this.sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  toggleSort(key: string): void {
    if (this.sort?.key === key) {
      this.sortChange.emit({ key, direction: this.sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      this.sortChange.emit({ key, direction: 'asc' });
    }
  }
}
