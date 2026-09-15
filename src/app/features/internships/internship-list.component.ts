import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { InternshipService, activeAssignment } from './internship.service';
import { InternshipQueueStore } from './internship-queue-store';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DataTableComponent, type SortState } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { InternshipDetail, InternshipAssignment } from '../../core/api-models';

interface InternshipRow extends InternshipDetail {
  supervisorName: string;
  departmentName: string;
}

const MY_SUPERVISOR_KEY = 'st-mine-supervisor';

/**
 * Staff internship list (ADMIN/HR/SUPERVISOR). The backend list carries no
 * assignment data, so current supervisor/department are joined from
 * per-internship assignment histories (failures isolated per row).
 * Supervisors get a "My interns" view keyed on an explicitly chosen,
 * remembered supervisor name — the backend exposes no staff-identity
 * endpoint, so nothing is guessed from the session.
 */
@Component({
  selector: 'st-internships',
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
    AlertComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('internships.queueTitle')"
      [subtitle]="i18n.t('internships.queueSubtitle')"
    >
      <st-live-status />
      @if (canManage()) {
        <a
          routerLink="/applications"
          [queryParams]="{ status: 'ACCEPTED' }"
          class="st-btn st-btn--secondary"
        >
          {{ i18n.t('internships.newFromApplication') }}
        </a>
        <a routerLink="/internships/new" class="st-btn st-btn--primary">
          <st-icon name="plus" [size]="15" /> {{ i18n.t('internships.newManual') }}
        </a>
      }
    </st-page-header>

    @if (isSupervisorView()) {
      <st-alert tone="info" [title]="i18n.t('internships.myInternsTitle')">
        {{ i18n.t('internships.myInternsHint') }}
      </st-alert>
    }

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="onFilter()"
          [placeholder]="i18n.t('internships.searchPlaceholder')"
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
        <span class="st-field__label">{{ i18n.t('internships.type') }}</span>
        <select class="st-input" [(ngModel)]="type" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('internships.supervisor') }}</span>
        <select class="st-input" [(ngModel)]="supervisor" (change)="onSupervisorChange()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (name of supervisorOptions(); track name) {
            <option [value]="name">{{ name }}</option>
          }
        </select>
      </label>
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
              <a [routerLink]="['/internships', row.id]" class="st-ref">{{ row.reference }}</a>
            </td>
            <td dir="auto">{{ row.candidateFullName }}</td>
            <td><st-badge [label]="row.type" tone="info" /></td>
            <td><st-badge [label]="row.status" [tone]="statusTone(row.status)" /></td>
            <td dir="ltr" data-priority="medium">{{ row.startDate }} → {{ row.endDate }}</td>
            <td dir="auto" data-priority="medium">{{ row.supervisorName || '—' }}</td>
            <td dir="auto" data-priority="low">{{ row.departmentName || '—' }}</td>
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
export class InternshipListComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(InternshipService);
  private readonly store = inject(InternshipQueueStore);
  private readonly router = inject(Router);

  readonly columns = [
    { key: 'reference', label: 'Reference', sortable: true, priority: 'high' as const },
    { key: 'candidateFullName', label: 'Candidate', sortable: true, priority: 'high' as const },
    { key: 'type', label: 'Type', sortable: true, priority: 'high' as const },
    { key: 'status', label: 'Status', sortable: true, priority: 'high' as const },
    { key: 'startDate', label: 'Period', sortable: true, priority: 'medium' as const },
    { key: 'supervisorName', label: 'Supervisor', sortable: true, priority: 'medium' as const },
    { key: 'departmentName', label: 'Department', sortable: false, priority: 'low' as const },
  ];
  readonly statuses = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
  readonly types = ['OBSERVATION', 'PERFECTIONNEMENT', 'PFE'];

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  private readonly all = signal<readonly InternshipRow[]>([]);
  readonly supervisorOptions = signal<readonly string[]>([]);

  readonly search = signal('');
  readonly status = signal('');
  readonly type = signal('');
  readonly supervisor = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'startDate', direction: 'desc' });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    const ty = this.type();
    const sup = this.supervisor();
    let rows = [...this.all()];
    if (q) {
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) || r.candidateFullName.toLowerCase().includes(q),
      );
    }
    if (st) rows = rows.filter((r) => r.status === st);
    if (ty) rows = rows.filter((r) => r.type === ty);
    if (sup) rows = rows.filter((r) => r.supervisorName === sup);
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

  canManage(): boolean {
    return this.auth.hasPermission('INTERNSHIP_ASSIGN');
  }

  isSupervisorView(): boolean {
    return this.auth.role() === 'SUPERVISOR';
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.internships', labelFallback: 'Internships' }]);
    const saved = this.store.get();
    this.search.set(saved.search);
    this.status.set(saved.status);
    this.type.set(saved.type);
    this.page.set(saved.page);
    this.size.set(saved.size);
    this.sort.set({ key: saved.sortKey, direction: saved.sortDirection });
    // Supervisor "my interns": reselect the explicitly remembered name, if any.
    const remembered = readRememberedSupervisor();
    this.supervisor.set(saved.supervisor || (this.isSupervisorView() ? remembered : ''));
    this.load();
    this.realtime.internshipUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  onFilter(): void {
    this.page.set(0);
    this.persist();
  }

  onSupervisorChange(): void {
    if (this.isSupervisorView()) rememberSupervisor(this.supervisor());
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
    void this.router.navigate(['/internships', id]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.serverMessage.set('');
    this.api.listInternships().subscribe({
      next: (rows) => {
        this.service.loadAssignmentMap(rows.map((r) => r.id)).subscribe({
          next: (map) => {
            this.all.set(rows.map((r) => withCurrent(map.get(r.id), r)));
            this.supervisorOptions.set(distinctSupervisors(map));
            // Drop a remembered supervisor that no longer exists.
            if (this.supervisor() && !this.supervisorOptions().includes(this.supervisor())) {
              this.supervisor.set('');
            }
            this.loading.set(false);
          },
          error: () => {
            this.all.set(rows.map((r) => withCurrent(undefined, r)));
            this.loading.set(false);
          },
        });
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.serverMessage.set(extractMessage(e));
        this.loading.set(false);
      },
    });
  }

  private persist(): void {
    this.store.set({
      search: this.search(),
      status: this.status(),
      type: this.type(),
      supervisor: this.supervisor(),
      page: this.page(),
      size: this.size(),
      sortKey: this.sort()?.key ?? 'startDate',
      sortDirection: this.sort()?.direction ?? 'desc',
    });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'COMPLETED':
        return 'info';
      case 'CANCELLED':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'warning';
    }
  }
}

function withCurrent(
  assignments: readonly InternshipAssignment[] | undefined,
  row: InternshipDetail,
): InternshipRow {
  const current = assignments ? activeAssignment(assignments) : null;
  return {
    ...row,
    supervisorName: current?.supervisorName ?? '',
    departmentName: current?.departmentName ?? '',
  };
}

function distinctSupervisors(map: Map<string, InternshipAssignment[]>): string[] {
  const names = new Set<string>();
  for (const rows of map.values()) {
    const current = activeAssignment(rows);
    if (current) names.add(current.supervisorName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function readRememberedSupervisor(): string {
  try {
    return localStorage.getItem(MY_SUPERVISOR_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberSupervisor(name: string): void {
  try {
    if (name) localStorage.setItem(MY_SUPERVISOR_KEY, name);
    else localStorage.removeItem(MY_SUPERVISOR_KEY);
  } catch {
    /* storage unavailable — filter still works for the session */
  }
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}
