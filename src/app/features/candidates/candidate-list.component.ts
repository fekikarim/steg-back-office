import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ApiClient } from '../../core/api-client.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DataTableComponent, type SortState } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import type { CandidateSummary } from '../../core/api-models';

/**
 * Staff candidate list (ADMIN/HR). Uses CandidateSummary only — nationalId
 * is absent from the contract, so CIN cannot leak through this screen.
 */
@Component({
  selector: 'st-candidate-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    DataTableComponent,
    PaginationComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('candidates.title')" [subtitle]="i18n.t('candidates.subtitle')">
      <st-live-status />
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="page.set(0)"
          [placeholder]="i18n.t('candidates.searchPlaceholder')"
          dir="auto"
        />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('applications.university') }}</span>
        <select class="st-input" [(ngModel)]="university" (change)="page.set(0)">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (u of universities(); track u) {
            <option [value]="u">{{ u }}</option>
          }
        </select>
      </label>
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (paged().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <st-data-table
        [columns]="columns"
        [sort]="sort()"
        [hasActions]="true"
        (sortChange)="onSort($event)"
      >
        @for (row of paged(); track row.id) {
          <tr>
            <td dir="auto">
              <a [routerLink]="['/candidates', row.id]" class="st-ref"
                >{{ row.firstName }} {{ row.lastName }}</a
              >
            </td>
            <td dir="ltr" data-priority="medium">{{ row.email }}</td>
            <td dir="auto" data-priority="medium">{{ row.universityName }}</td>
            <td data-priority="low" dir="auto">{{ row.speciality || '—' }}</td>
            <td>
              <button type="button" class="st-btn st-btn--text" (click)="open(row.id)">
                {{ i18n.t('common.view') }}
              </button>
            </td>
          </tr>
        }
      </st-data-table>
      <st-pagination
        [page]="page()"
        [size]="size()"
        [totalPages]="totalPages()"
        (prev)="page.set(page() - 1)"
        (next)="page.set(page() + 1)"
        (sizeChange)="size.set($event); page.set(0)"
      />
    }
  `,
  styles: [
    `
      .st-filters {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        align-items: flex-end;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.8rem;
        margin-block-end: 0.8rem;
      }
      .st-field--grow {
        flex: 1;
        min-inline-size: 12rem;
      }
      .st-ref {
        font-weight: 600;
        color: var(--action-primary);
        text-decoration: none;
      }
      .st-ref:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class CandidateListComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly columns = [
    { key: 'name', label: 'Name', sortable: true, priority: 'high' as const },
    { key: 'email', label: 'Email', sortable: true, priority: 'medium' as const },
    { key: 'universityName', label: 'University', sortable: true, priority: 'medium' as const },
    { key: 'speciality', label: 'Speciality', sortable: false, priority: 'low' as const },
  ];

  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly all = signal<readonly CandidateSummary[]>([]);
  readonly universities = signal<readonly string[]>([]);
  readonly search = signal('');
  readonly university = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'name', direction: 'asc' });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const uni = this.university();
    let rows = [...this.all()];
    if (q) {
      rows = rows.filter((r) =>
        `${r.firstName} ${r.lastName} ${r.email} ${r.universityName}`.toLowerCase().includes(q),
      );
    }
    if (uni) rows = rows.filter((r) => r.universityName === uni);
    const sort = this.sort();
    if (sort) {
      const dir = sort.direction === 'desc' ? -1 : 1;
      const value = (r: CandidateSummary): string =>
        sort.key === 'name'
          ? `${r.firstName} ${r.lastName}`
          : String(r.universityName ?? r.email ?? '');
      rows.sort((a, b) => value(a).localeCompare(value(b)) * dir);
    }
    return rows;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.size())),
  );
  readonly paged = computed(() => {
    const page = Math.min(this.page(), this.totalPages() - 1);
    return this.filtered().slice(page * this.size(), page * this.size() + this.size());
  });

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.candidates', labelFallback: 'Candidates' }]);
    this.load();
    this.realtime.candidateUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  ngOnDestroy(): void {}

  onSort(sort: SortState): void {
    this.sort.set(sort);
    this.page.set(0);
  }

  open(id: string): void {
    void this.router.navigate(['/candidates', id]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.listCandidates().subscribe({
      next: (rows) => {
        this.all.set(rows);
        this.universities.set([...new Set(rows.map((r) => r.universityName))].sort());
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
