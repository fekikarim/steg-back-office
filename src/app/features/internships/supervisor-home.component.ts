import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError, map } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { RealtimeService } from '../../core/realtime.service';
import { InternshipService, activeAssignment } from './internship.service';
import { readRememberedSupervisor, rememberSupervisor } from './supervisor-scope';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DistBarsComponent } from '../dashboard/dist-bars.component';
import type { GroupCountDto, InternshipDetail } from '../../core/api-models';

interface DashRow extends InternshipDetail {
  supervisorName: string;
  departmentName: string;
  tasksDone: number;
  tasksTotal: number;
  journalOk: number;
  journalTotal: number;
  hasFinalEvaluation: boolean;
  financeStatus: string | null;
  receiptReference: string | null;
  endsSoon: boolean;
}

const ENDS_SOON_DAYS = 14;
const DETAIL_CAP = 30;

/**
 * Supervisor home dashboard: aggregated stats across the internships,
 * supervision and finance pages for the scoped assignments — status and
 * type breakdowns, task/journal completion rates, evaluation coverage and
 * receipt tracking. ADMIN sees every scope; SUPERVISOR sees assigned
 * internships only (supervisor name remembered per device). Every figure
 * is computed live from backend reads and refreshes on realtime domain
 * events; links drill into the operational pages.
 */
@Component({
  selector: 'st-supervisor-home',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    DistBarsComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('supervisor.dashboardTitle')"
      [subtitle]="i18n.t('supervisor.subtitle')"
    >
      <st-live-status />
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('internships.supervisor') }}</span>
        <select class="st-input" [(ngModel)]="scope" (change)="onScopeChange()">
          @if (!isSupervisorOnly()) {
            <option value="">{{ i18n.t('table.all') }}</option>
          }
          @for (name of supervisorOptions(); track name) {
            <option [value]="name">{{ name }}</option>
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
      <st-skeleton [rows]="10" />
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <section class="st-kpis" aria-label="kpis">
        <div class="st-kpi">
          <span class="st-kpi__n">{{ rows().length }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.assigned') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ taskCompletion() }}%</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.taskCompletion') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ journalValidation() }}%</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.journalValidation') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ awaitingEvaluation() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.awaitingEvaluation') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ receiptsIssued() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.receiptsIssued') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ endingSoon() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.endingSoon') }}</span>
        </div>
      </section>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.internshipsOverview')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('supervisor.internshipsOverview') }}</h2>
            <a routerLink="/internships" class="st-btn st-btn--text">{{ i18n.t('common.view') }}</a>
          </div>
          <st-dist-bars
            [label]="i18n.t('supervisor.internshipsOverview')"
            [groups]="statusGroups()"
          />
          <st-dist-bars
            [label]="i18n.t('supervisor.internshipsOverview')"
            [groups]="typeGroups()"
          />
        </section>

        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.supervisionOverview')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('supervisor.supervisionOverview') }}</h2>
            <a routerLink="/supervisor" class="st-btn st-btn--text">{{ i18n.t('common.view') }}</a>
          </div>
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('supervisor.tasks') }}</dt>
              <dd dir="ltr">{{ totalTasksDone() }} / {{ totalTasks() }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('supervisor.journal') }}</dt>
              <dd dir="ltr">{{ totalJournalOk() }} / {{ totalJournal() }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('supervisor.evaluation') }}</dt>
              <dd dir="ltr">{{ evaluatedCount() }} / {{ rows().length }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('supervisor.journalPending') }}</dt>
              <dd dir="ltr">{{ pendingJournal() }}</dd>
            </div>
          </dl>
          @if (attention().length > 0) {
            <st-alert tone="warning" [title]="i18n.t('supervisor.attentionTitle')">
              <ul class="st-attn">
                @for (row of attention(); track row.id) {
                  <li dir="auto">
                    <a [routerLink]="['/internships', row.id]" class="st-ref">{{
                      row.candidateFullName
                    }}</a>
                  </li>
                }
              </ul>
            </st-alert>
          }
        </section>
      </div>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.financeOverview')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('supervisor.financeOverview') }}</h2>
            <a routerLink="/finance" class="st-btn st-btn--text">{{ i18n.t('common.view') }}</a>
          </div>
          @if (financeGroups().length === 0) {
            <p class="st-hint">{{ i18n.t('supervisor.noReceipt') }}</p>
          } @else {
            <st-dist-bars
              [label]="i18n.t('supervisor.financeOverview')"
              [groups]="financeGroups()"
            />
          }
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('supervisor.receiptsIssued') }}</dt>
              <dd dir="ltr">{{ receiptsIssued() }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('supervisor.receiptsPending') }}</dt>
              <dd dir="ltr">{{ receiptsPending() }}</dd>
            </div>
          </dl>
        </section>

        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.attentionTitle')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('supervisor.attentionTitle') }}</h2>
            <a routerLink="/supervisor" class="st-btn st-btn--text">{{ i18n.t('common.view') }}</a>
          </div>
          @if (attention().length === 0) {
            <p class="st-hint">{{ i18n.t('tasks.empty') }}</p>
          } @else {
            <ul class="st-attn">
              @for (row of attention(); track row.id) {
                <li dir="auto">
                  <a [routerLink]="['/internships', row.id]" class="st-ref">{{
                    row.candidateFullName
                  }}</a>
                  <span class="st-sub2">
                    <st-badge [label]="row.status" [tone]="statusTone(row.status)" />
                    @if (row.journalTotal - row.journalOk > 0) {
                      <st-badge
                        [label]="reviewLabel(row.journalTotal - row.journalOk)"
                        tone="warning"
                      />
                    }
                  </span>
                </li>
              }
            </ul>
          }
        </section>
      </div>
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
      .st-kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
        gap: 0.6rem;
        margin-block-end: 0.8rem;
      }
      .st-kpi {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.7rem 0.8rem;
        display: grid;
        gap: 0.15rem;
      }
      .st-kpi__n {
        font-size: 1.4rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .st-kpi__l {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        margin-block-end: 0.75rem;
      }
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        min-inline-size: 0;
      }
      .st-card__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-card__head .st-card__title {
        margin-block-end: 0;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0.6rem 0 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 10rem 1fr;
        gap: 0.5rem;
        font-size: 0.84rem;
      }
      .st-defs dt {
        color: var(--text-muted);
      }
      .st-defs dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
      }
      .st-attn {
        margin: 0.6rem 0 0;
        padding-inline-start: 1.1rem;
        display: grid;
        gap: 0.35rem;
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
      .st-sub2 {
        display: flex;
        gap: 0.35rem;
        margin-block-start: 0.2rem;
        flex-wrap: wrap;
      }
      @media (max-width: 1023px) {
        .st-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class SupervisorHomeComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly service = inject(InternshipService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly scope = signal('');
  readonly supervisorOptions = signal<readonly string[]>([]);
  private readonly all = signal<readonly DashRow[]>([]);

  readonly rows = computed(() => {
    const scope = this.scope();
    const rows = [...this.all()];
    if (scope) return rows.filter((r) => r.supervisorName === scope);
    return rows;
  });

  readonly statusGroups = computed((): readonly GroupCountDto[] =>
    groupBy(this.rows(), (r) => r.status),
  );
  readonly typeGroups = computed((): readonly GroupCountDto[] =>
    groupBy(this.rows(), (r) => r.type),
  );
  readonly financeGroups = computed((): readonly GroupCountDto[] =>
    groupBy(
      this.rows().filter((r) => r.financeStatus),
      (r) => r.financeStatus ?? '',
    ),
  );

  readonly totalTasks = computed(() => this.rows().reduce((n, r) => n + r.tasksTotal, 0));
  readonly totalTasksDone = computed(() => this.rows().reduce((n, r) => n + r.tasksDone, 0));
  readonly taskCompletion = computed(() => pct(this.totalTasksDone(), this.totalTasks()));
  readonly totalJournal = computed(() => this.rows().reduce((n, r) => n + r.journalTotal, 0));
  readonly totalJournalOk = computed(() => this.rows().reduce((n, r) => n + r.journalOk, 0));
  readonly journalValidation = computed(() => pct(this.totalJournalOk(), this.totalJournal()));
  readonly pendingJournal = computed(() =>
    this.rows().reduce((n, r) => n + Math.max(0, r.journalTotal - r.journalOk), 0),
  );
  readonly evaluatedCount = computed(() => this.rows().filter((r) => r.hasFinalEvaluation).length);
  readonly awaitingEvaluation = computed(
    () => this.rows().filter((r) => r.status === 'COMPLETED' && !r.hasFinalEvaluation).length,
  );
  readonly receiptsIssued = computed(() => this.rows().filter((r) => r.receiptReference).length);
  readonly receiptsPending = computed(
    () => this.rows().filter((r) => r.financeStatus && !r.receiptReference).length,
  );
  readonly endingSoon = computed(() => this.rows().filter((r) => r.endsSoon).length);
  readonly attention = computed(() =>
    this.rows().filter(
      (r) =>
        r.journalTotal - r.journalOk > 0 ||
        (r.status === 'COMPLETED' && !r.hasFinalEvaluation) ||
        (r.endsSoon && r.status === 'ACTIVE'),
    ),
  );

  isSupervisorOnly(): boolean {
    return this.auth.role() === 'SUPERVISOR';
  }

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.dashboard', labelFallback: 'Dashboard' }]);
    if (this.isSupervisorOnly()) this.scope.set(readRememberedSupervisor());
    this.load();
    this.realtime.internshipUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    this.realtime.financeUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  onScopeChange(): void {
    if (this.isSupervisorOnly()) rememberSupervisor(this.scope());
  }

  reviewLabel(n: number): string {
    return this.i18n.t('supervisor.toReview', { n: String(n) });
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

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.listInternships().subscribe({
      next: (rows) => {
        this.service.loadAssignmentMap(rows.map((r) => r.id)).subscribe({
          next: (map) => {
            const names = new Set<string>();
            const joined = rows.map((r) => {
              const current = map.get(r.id) ? activeAssignment(map.get(r.id) ?? []) : null;
              if (current) names.add(current.supervisorName);
              return {
                ...r,
                supervisorName: current?.supervisorName ?? '',
                departmentName: current?.departmentName ?? '',
              };
            });
            this.supervisorOptions.set([...names].sort((a, b) => a.localeCompare(b)));
            if (this.isSupervisorOnly()) {
              const remembered = this.scope() || readRememberedSupervisor();
              if (remembered && names.has(remembered)) this.scope.set(remembered);
              else if ([...names].length === 1) this.scope.set([...names][0] ?? '');
            }
            this.all.set(
              joined.map((r) => ({
                ...r,
                tasksDone: 0,
                tasksTotal: 0,
                journalOk: 0,
                journalTotal: 0,
                hasFinalEvaluation: false,
                financeStatus: null as string | null,
                receiptReference: null as string | null,
                endsSoon: endsSoon(r.status, r.endDate),
              })),
            );
            this.loadFinance();
          },
          error: () => {
            this.error.set(true);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Receipt tracking: one bounded read, backend-scoped for supervisors. */
  private loadFinance(): void {
    this.api.listFinanceCases('', 0, 100).subscribe({
      next: (page) => {
        const byInternship = new Map(page.content.map((c) => [c.internshipId, c]));
        this.all.set(
          this.all().map((row) => {
            const fin = byInternship.get(row.id);
            return {
              ...row,
              financeStatus: fin?.status ?? null,
              receiptReference: fin?.receiptReference ?? null,
            };
          }),
        );
        this.loadDetails();
      },
      error: () => this.loadDetails(),
    });
  }

  private loadDetails(): void {
    const ids = this.scopedIds().slice(0, DETAIL_CAP);
    if (ids.length === 0) {
      this.loading.set(false);
      return;
    }
    forkJoin(
      ids.map((id) =>
        forkJoin({
          tasks: this.api.listTasks(id, 0, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          journal: this.api.listJournalEntries(id, 0, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          evaluations: this.api.listEvaluations(id, 0, 20).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
        }).pipe(map((s) => ({ id, ...s }))),
      ),
    ).subscribe({
      next: (results) => {
        const byId = new Map(results.map((r) => [r.id, r]));
        this.all.set(
          this.all().map((row) => {
            const s = byId.get(row.id);
            if (!s) return row;
            return {
              ...row,
              tasksDone: s.tasks.filter((t) => t.status === 'COMPLETED').length,
              tasksTotal: s.tasks.length,
              journalOk: s.journal.filter((j) => j.status === 'VALIDATED').length,
              journalTotal: s.journal.length,
              hasFinalEvaluation: s.evaluations.some((e) => e.type === 'FINAL'),
            };
          }),
        );
        this.loading.set(false);
      },
      error: () => {
        // Detail reads are best-effort: aggregates still render.
        this.loading.set(false);
      },
    });
  }

  private scopedIds(): string[] {
    const scope = this.scope();
    return this.all()
      .filter((r) => !scope || r.supervisorName === scope)
      .map((r) => r.id);
  }
}

function groupBy(rows: readonly DashRow[], key: (r: DashRow) => string): GroupCountDto[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([groupName, count]) => ({ groupName, count }))
    .sort((a, b) => b.count - a.count);
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function endsSoon(status: string, endDate: string): boolean {
  if (!endDate) return false;
  const end = new Date(endDate + 'T23:59:59');
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return days >= 0 && days <= ENDS_SOON_DAYS && status === 'ACTIVE';
}
