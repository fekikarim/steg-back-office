import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { ApplicationQueueStore } from './application-queue-store';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DataTableComponent, type SortState } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { DateRangeComponent } from '../../shared/ui/date-range.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { ApplicationDetail } from '../../core/api-models';

interface QueueRow extends ApplicationDetail {
  universityName: string;
}

/**
 * Staff application queue (ADMIN/HR). Backend exposes the full list without
 * paging or department data, so filtering/sorting/pagination run locally over
 * the fetched staff list; rendering stays page-capped. Department filtering
 * lands with internship assignment data (Phase C3).
 */
@Component({
  selector: 'st-applications',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    DataTableComponent,
    PaginationComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    DateRangeComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('applications.queueTitle')"
      [subtitle]="i18n.t('applications.queueSubtitle')"
    >
      <st-live-status />
      @if (canReview()) {
        <a routerLink="/applications/new" class="st-btn st-btn--primary">
          <st-icon name="plus" [size]="15" /> {{ i18n.t('applications.newManual') }}
        </a>
      }
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="onFilter()"
          [placeholder]="i18n.t('applications.searchPlaceholder')"
          dir="auto"
        />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.status') }}</span>
        <select class="st-input" [(ngModel)]="status" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('applications.university') }}</span>
        <select class="st-input" [(ngModel)]="university" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (u of universities(); track u) {
            <option [value]="u">{{ u }}</option>
          }
        </select>
      </label>
      <st-date-range (apply)="onDates($event)" (reset)="onDates({ from: '', to: '' })" />
      <button type="button" class="st-btn st-btn--primary" (click)="onFilter()">
        {{ i18n.t('common.apply') }}
      </button>
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="serverMessage() || i18n.t('common.error.body')"
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
            <td dir="ltr">
              <a [routerLink]="['/applications', row.id]" class="st-ref">{{ row.reference }}</a>
            </td>
            <td dir="auto">{{ row.candidateName }}</td>
            <td dir="auto" data-priority="medium">{{ row.universityName || '—' }}</td>
            <td><st-badge [label]="row.status" [tone]="tone(row.status)" /></td>
            <td data-priority="low">{{ row.calculatedType ?? '—' }}</td>
            <td data-priority="low">
              <st-badge
                [label]="
                  row.submittedOnline
                    ? i18n.t('applications.online')
                    : i18n.t('applications.manual')
                "
                tone="neutral"
              />
            </td>
            <td data-priority="low" dir="ltr">
              {{ (row.submissionDate ?? '').slice(0, 10) || '—' }}
            </td>
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
        (prev)="setPage(page() - 1)"
        (next)="setPage(page() + 1)"
        (sizeChange)="size.set($event); setPage(0)"
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
export class ApplicationsComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(ApplicationQueueStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly columns = [
    { key: 'reference', label: 'Reference', sortable: true, priority: 'high' as const },
    { key: 'candidateName', label: 'Candidate', sortable: true, priority: 'high' as const },
    { key: 'universityName', label: 'University', sortable: true, priority: 'medium' as const },
    { key: 'status', label: 'Status', sortable: true, priority: 'high' as const },
    { key: 'calculatedType', label: 'Type', sortable: false, priority: 'low' as const },
    { key: 'source', label: 'Source', sortable: false, priority: 'low' as const },
    { key: 'submissionDate', label: 'Submitted', sortable: true, priority: 'low' as const },
  ];
  readonly statuses = [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_CORRECTION',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ];

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  private readonly all = signal<readonly QueueRow[]>([]);
  readonly universities = signal<readonly string[]>([]);

  readonly search = signal('');
  readonly status = signal('');
  readonly university = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'submissionDate', direction: 'desc' });
  private dates = { from: '', to: '' };

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    const uni = this.university();
    let rows = [...this.all()];
    if (q) {
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.candidateName.toLowerCase().includes(q) ||
          r.universityName.toLowerCase().includes(q),
      );
    }
    if (st) rows = rows.filter((r) => r.status === st);
    if (uni) rows = rows.filter((r) => r.universityName === uni);
    if (this.dates.from) rows = rows.filter((r) => (r.submissionDate ?? '') >= this.dates.from);
    if (this.dates.to)
      rows = rows.filter((r) => (r.submissionDate ?? '').slice(0, 10) <= this.dates.to);
    const sort = this.sort();
    if (sort) {
      const dir = sort.direction === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sort.key] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sort.key] ?? '');
        return av.localeCompare(bv) * dir;
      });
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

  canReview(): boolean {
    return this.auth.hasPermission('APPLICATION_REVIEW');
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.operations', labelFallback: 'Operations' },
      { labelKey: 'nav.applications', labelFallback: 'Applications' },
    ]);
    const saved = this.store.get();
    this.search.set(saved.search);
    this.status.set(saved.status);
    this.university.set('');
    this.page.set(saved.page);
    this.size.set(saved.size);
    this.sort.set({ key: saved.sortKey, direction: saved.sortDirection });
    this.dates = { from: saved.from, to: saved.to };
    // Dashboard drill-down wins over preserved state: /applications?status=NEEDS_CORRECTION
    const preset = this.route.snapshot.queryParamMap.get('status');
    if (preset && this.statuses.includes(preset)) {
      this.status.set(preset);
      this.page.set(0);
    }
    this.load();
    this.realtime.applicationUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  onFilter(): void {
    this.page.set(0);
    this.persist();
  }

  onDates(range: { from: string; to: string }): void {
    this.dates = range;
    this.page.set(0);
    this.persist();
  }

  onSort(sort: SortState): void {
    this.sort.set(sort);
    this.page.set(0);
    this.persist();
  }

  setPage(page: number): void {
    this.page.set(Math.max(0, page));
    this.persist();
  }

  open(id: string): void {
    this.persist();
    void this.router.navigate(['/applications', id]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.serverMessage.set('');
    forkJoin({
      applications: this.api.listApplications(),
      candidates: this.api.listCandidates().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ applications, candidates }) => {
        const uniByCandidate = new Map(candidates.map((c) => [c.id, c.universityName] as const));
        this.all.set(
          applications.map((a) => ({
            ...a,
            universityName: uniByCandidate.get(a.candidateId) ?? '',
          })),
        );
        this.universities.set([...new Set(candidates.map((c) => c.universityName))].sort());
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.serverMessage.set(userMessage(e));
        this.loading.set(false);
      },
    });
  }

  private persist(): void {
    this.store.set({
      search: this.search(),
      status: this.status(),
      from: this.dates.from,
      to: this.dates.to,
      page: this.page(),
      size: this.size(),
      sortKey: this.sort()?.key ?? 'submissionDate',
      sortDirection: this.sort()?.direction ?? 'desc',
    });
  }

  tone(status: string): BadgeTone {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'error';
      case 'NEEDS_CORRECTION':
      case 'DRAFT':
        return 'warning';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'info';
      default:
        return 'neutral';
    }
  }
}

function userMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}
