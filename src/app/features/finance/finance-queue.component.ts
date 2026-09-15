import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError, map } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ApiClient } from '../../core/api-client.service';
import { activeAssignment } from '../internships/internship.service';
import { FinanceQueueStore } from './finance-queue-store';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import type { FinanceCaseQueueItem, FinanceCaseStatus } from '../../core/api-models';

interface FinanceRow extends FinanceCaseQueueItem {
  candidateName: string;
  departmentName: string;
  /** From the internship requirement; null when the join failed. */
  eligible: boolean | null;
}

/**
 * Finance work queue (FINANCE/ADMIN). Status filter, pagination and sort are
 * server-side; period/department/eligibility refine the loaded page via a
 * bounded per-row internship join (failures isolated per row).
 */
@Component({
  selector: 'st-finance-queue',
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
  ],
  template: `
    <st-page-header
      [title]="i18n.t('finance.queueTitle')"
      [subtitle]="i18n.t('finance.queueSubtitle')"
    >
      <st-live-status />
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.status') }}</span>
        <select class="st-input" [(ngModel)]="status" (change)="onServerFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('finance.openedFrom') }}</span>
        <input type="date" class="st-input" [(ngModel)]="openedFrom" (change)="onPageFilter()" />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('finance.openedTo') }}</span>
        <input type="date" class="st-input" [(ngModel)]="openedTo" (change)="onPageFilter()" />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('finance.department') }}</span>
        <select class="st-input" [(ngModel)]="department" (change)="onPageFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (d of departmentOptions(); track d) {
            <option [value]="d">{{ d }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('finance.eligibility') }}</span>
        <select class="st-input" [(ngModel)]="eligibility" (change)="onPageFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          <option value="eligible">{{ i18n.t('finance.eligible') }}</option>
          <option value="not-eligible">{{ i18n.t('finance.notEligible') }}</option>
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('finance.sortOpened') }}</span>
        <select class="st-input" [(ngModel)]="sortDir" (change)="onServerFilter()">
          <option value="desc">{{ i18n.t('finance.newestFirst') }}</option>
          <option value="asc">{{ i18n.t('finance.oldestFirst') }}</option>
        </select>
      </label>
    </section>
    <p class="st-hint">{{ i18n.t('finance.pageFilterNote') }}</p>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="serverMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (filtered().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <st-data-table [columns]="columns" [hasActions]="true">
        @for (row of filtered(); track row.id) {
          <tr>
            <td dir="ltr">
              <a [routerLink]="['/finance', row.id]" class="st-ref">{{ row.reference }}</a>
            </td>
            <td dir="ltr" data-priority="medium">{{ row.internshipReference }}</td>
            <td dir="auto">{{ row.candidateName || '—' }}</td>
            <td><st-badge [label]="row.status" [tone]="statusTone(row.status)" /></td>
            <td data-priority="medium">
              @if (row.eligible === null) {
                <span class="st-muted">—</span>
              } @else {
                <st-badge
                  [label]="
                    row.eligible ? i18n.t('finance.eligible') : i18n.t('finance.notEligible')
                  "
                  [tone]="row.eligible ? 'success' : 'neutral'"
                />
              }
            </td>
            <td dir="auto" data-priority="low">{{ row.departmentName || '—' }}</td>
            <td dir="ltr" data-priority="low">{{ row.openedAt.slice(0, 10) }}</td>
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
        (sizeChange)="size.set($event); setPage(0); reload()"
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
        margin-block-end: 0.4rem;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0 0 0.8rem;
      }
      .st-muted {
        color: var(--text-muted);
        font-size: 0.85rem;
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
export class FinanceQueueComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(FinanceQueueStore);
  private readonly router = inject(Router);

  readonly columns = [
    { key: 'reference', label: 'Reference', priority: 'high' as const },
    { key: 'internshipReference', label: 'Internship', priority: 'medium' as const },
    { key: 'candidateName', label: 'Candidate', priority: 'high' as const },
    { key: 'status', label: 'Status', priority: 'high' as const },
    { key: 'eligible', label: 'Eligibility', priority: 'medium' as const },
    { key: 'departmentName', label: 'Department', priority: 'low' as const },
    { key: 'openedAt', label: 'Opened', priority: 'low' as const },
  ];
  readonly statuses: FinanceCaseStatus[] = [
    'OPENED',
    'UNDER_REVIEW',
    'DOCUMENTS_MISSING',
    'READY_FOR_DECISION',
    'APPROVED',
    'REJECTED',
    'CLOSED',
  ];

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  private readonly rows = signal<readonly FinanceRow[]>([]);
  readonly departmentOptions = signal<readonly string[]>([]);

  readonly status = signal<FinanceCaseStatus | ''>('');
  readonly openedFrom = signal('');
  readonly openedTo = signal('');
  readonly department = signal('');
  readonly eligibility = signal<'' | 'eligible' | 'not-eligible'>('');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalPages = signal(1);

  readonly filtered = computed(() => {
    const from = this.openedFrom();
    const to = this.openedTo();
    const dept = this.department();
    const elig = this.eligibility();
    return this.rows().filter((r) => {
      const day = r.openedAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (dept && r.departmentName !== dept) return false;
      if (elig === 'eligible' && r.eligible !== true) return false;
      if (elig === 'not-eligible' && r.eligible !== false) return false;
      return true;
    });
  });

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.finance', labelFallback: 'Finance' }]);
    const saved = this.store.get();
    this.status.set(saved.status);
    this.page.set(saved.page);
    this.size.set(saved.size);
    this.sortDir.set(saved.sortDir);
    this.openedFrom.set(saved.openedFrom);
    this.openedTo.set(saved.openedTo);
    this.department.set(saved.department);
    this.eligibility.set(saved.eligibility);
    this.load();
    this.realtime.financeUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  /** Server-side change (status/sort): reset page and refetch. */
  onServerFilter(): void {
    this.page.set(0);
    this.persist();
    this.load();
  }

  /** Page-level refinement: no refetch needed. */
  onPageFilter(): void {
    this.persist();
  }

  setPage(page: number): void {
    this.page.set(Math.max(0, page));
    this.persist();
    this.load();
  }

  reload(): void {
    this.persist();
    this.load();
  }

  open(id: string): void {
    this.persist();
    void this.router.navigate(['/finance', id]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.serverMessage.set('');
    this.api
      .listFinanceCases(this.status(), this.page(), this.size(), `openedAt,${this.sortDir()}`)
      .subscribe({
        next: (page) => {
          this.page.set(page.number);
          this.totalPages.set(Math.max(1, page.totalPages));
          this.enrich(page.content);
        },
        error: (e: unknown) => {
          this.error.set(true);
          this.serverMessage.set(extractMessage(e));
          this.loading.set(false);
        },
      });
  }

  /** Bounded per-row join (page size only) for department/eligibility/candidate. */
  private enrich(cases: readonly FinanceCaseQueueItem[]): void {
    if (cases.length === 0) {
      this.rows.set([]);
      this.departmentOptions.set([]);
      this.loading.set(false);
      return;
    }
    forkJoin(
      cases.map((c) =>
        forkJoin({
          internship: this.api.getInternship(c.internshipId).pipe(catchError(() => of(null))),
          assignments: this.api.listAssignments(c.internshipId).pipe(catchError(() => of([]))),
        }).pipe(
          map(({ internship, assignments }): FinanceRow => {
            const current = activeAssignment(assignments);
            return {
              ...c,
              candidateName: internship?.candidateFullName ?? '',
              departmentName: current?.departmentName ?? '',
              eligible: internship ? internship.requirement === 'OBLIGATOIRE' : null,
            };
          }),
        ),
      ),
    ).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.departmentOptions.set(
          [...new Set(rows.map((r) => r.departmentName).filter(Boolean))].sort(),
        );
        if (this.department() && !this.departmentOptions().includes(this.department())) {
          this.department.set('');
        }
        this.loading.set(false);
      },
      error: () => {
        this.rows.set(
          cases.map((c) => ({ ...c, candidateName: '', departmentName: '', eligible: null })),
        );
        this.loading.set(false);
      },
    });
  }

  private persist(): void {
    this.store.set({
      status: this.status(),
      page: this.page(),
      size: this.size(),
      sortDir: this.sortDir(),
      openedFrom: this.openedFrom(),
      openedTo: this.openedTo(),
      department: this.department(),
      eligibility: this.eligibility(),
    });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'CLOSED':
        return 'error';
      case 'READY_FOR_DECISION':
        return 'info';
      case 'DOCUMENTS_MISSING':
        return 'warning';
      default:
        return 'neutral';
    }
  }
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}
