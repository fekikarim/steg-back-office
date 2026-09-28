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
import { DialogComponent } from '../../shared/ui/dialog.component';
import type { CandidateDetail, InternshipDetail } from '../../core/api-models';

interface SupervisedRow extends InternshipDetail {
  supervisorName: string;
  departmentName: string;
  tasksDone: number;
  tasksPending: number;
  journalPending: number;
  journalTotal: number;
  hasFinalEvaluation: boolean;
  /** Finance case id for receipt tracking (null = no case opened yet). */
  financeCaseId: string | null;
  financeStatus: string | null;
  receiptReference: string | null;
  endsSoon: boolean;
  needsAttention: boolean;
}

const ENDS_SOON_DAYS = 14;

/**
 * Supervisor dashboard: assigned interns (candidates) with live progress —
 * tasks done/pending, journal reviews, evaluation state, validation status
 * and third-party receipt status. Scope is the explicitly chosen supervisor
 * name (remembered per device); ADMIN sees every assignment with attention
 * flags. All figures come from backend reads and refresh on realtime
 * domain events — nothing is invented client-side.
 */
@Component({
  selector: 'st-supervisor-dashboard',
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
    DialogComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('supervisor.title')" [subtitle]="i18n.t('supervisor.subtitle')">
      <st-live-status />
      <a routerLink="/internships" class="st-btn st-btn--secondary">{{
        i18n.t('supervisor.allInternships')
      }}</a>
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
      @if (isSupervisorOnly()) {
        <p class="st-hint">{{ i18n.t('internships.myInternsHint') }}</p>
      }
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
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <section class="st-kpis" aria-label="kpis">
        <div class="st-kpi">
          <span class="st-kpi__n">{{ rows().length }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.assigned') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ activeCount() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.active') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ pendingTasks() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.tasksPending') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ pendingJournal() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.journalPending') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ awaitingEvaluation() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.awaitingEvaluation') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ endingSoon() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.endingSoon') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ receiptsIssued() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.receiptsIssued') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ receiptsPending() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.receiptsPending') }}</span>
        </div>
      </section>

      @if (attention().length > 0) {
        <st-alert tone="warning" [title]="i18n.t('supervisor.attentionTitle')">
          <ul class="st-attn">
            @for (row of attention(); track row.id) {
              <li dir="auto">
                <a [routerLink]="['/internships', row.id]" class="st-ref">{{
                  row.candidateFullName
                }}</a>
                — {{ attentionReason(row) }}
              </li>
            }
          </ul>
        </st-alert>
      }

      <div class="st-table-wrap">
        <table class="st-table">
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('supervisor.intern') }}</th>
              <th scope="col">{{ i18n.t('table.status') }}</th>
              <th scope="col">{{ i18n.t('internshipDetail.period') }}</th>
              <th scope="col">{{ i18n.t('supervisor.tasks') }}</th>
              <th scope="col">{{ i18n.t('supervisor.journal') }}</th>
              <th scope="col">{{ i18n.t('supervisor.evaluation') }}</th>
              <th scope="col">{{ i18n.t('supervisor.receipt') }}</th>
              <th scope="col">
                <span class="st-sr">{{ i18n.t('common.view') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr [class.st-row--attn]="row.needsAttention">
                <td dir="auto">
                  <button type="button" class="st-ref st-ref--btn" (click)="openCandidate(row)">
                    {{ row.candidateFullName }}
                  </button>
                  <span class="st-sub2" dir="auto">{{ row.reference }} · {{ row.type }}</span>
                </td>
                <td><st-badge [label]="row.status" [tone]="statusTone(row.status)" /></td>
                <td dir="ltr">{{ row.startDate }} → {{ row.endDate }}</td>
                <td>{{ row.tasksDone }} / {{ row.tasksDone + row.tasksPending }}</td>
                <td>
                  {{ row.journalTotal - row.journalPending }} / {{ row.journalTotal }}
                  @if (row.journalPending > 0) {
                    <st-badge [label]="reviewLabel(row.journalPending)" tone="warning" />
                  }
                </td>
                <td>
                  @if (row.hasFinalEvaluation) {
                    <st-badge [label]="i18n.t('common.yes')" tone="success" />
                  } @else {
                    <st-badge [label]="i18n.t('common.no')" tone="neutral" />
                  }
                </td>
                <td>
                  @if (row.financeCaseId; as caseId) {
                    @if (row.receiptReference) {
                      <a [routerLink]="['/finance', caseId]" class="st-ref" dir="ltr">
                        {{ row.receiptReference }}
                      </a>
                      @if (row.financeStatus; as fs) {
                        <span class="st-sub2">
                          <st-badge [label]="fs" [tone]="financeTone(fs)" />
                        </span>
                      }
                    } @else {
                      @if (row.financeStatus; as fs) {
                        <a [routerLink]="['/finance', caseId]" class="st-ref" dir="ltr">
                          <st-badge [label]="fs" [tone]="financeTone(fs)" />
                        </a>
                      }
                    }
                  } @else {
                    <span class="st-sub2">{{ i18n.t('supervisor.noReceipt') }}</span>
                  }
                </td>
                <td>
                  <a [routerLink]="['/internships', row.id]" class="st-btn st-btn--text">{{
                    i18n.t('common.view')
                  }}</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Candidate info (read-only supporting info for validation) -->
      <st-dialog
        [open]="candidateOpen()"
        [title]="i18n.t('supervisor.candidateInfo')"
        (close)="candidateOpen.set(false)"
      >
        @if (candidateLoading()) {
          <st-skeleton [rows]="5" />
        } @else if (candidate(); as c) {
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('candidateDetail.identity') }}</dt>
              <dd dir="auto">{{ c.firstName }} {{ c.lastName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.email') }}</dt>
              <dd dir="ltr">{{ c.email }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.phone') }}</dt>
              <dd dir="ltr">{{ c.phone || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.birthDate') }}</dt>
              <dd dir="ltr">{{ c.birthDate || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.university') }}</dt>
              <dd dir="auto">{{ c.universityName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.speciality') }}</dt>
              <dd dir="auto">{{ c.speciality || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.diploma') }}</dt>
              <dd dir="auto">{{ c.diploma || '—' }}</dd>
            </div>
            @if (c.skills) {
              <div>
                <dt>{{ i18n.t('candidateDetail.skills') }}</dt>
                <dd dir="auto">{{ c.skills }}</dd>
              </div>
            }
            @if (c.languages) {
              <div>
                <dt>{{ i18n.t('candidateDetail.languages') }}</dt>
                <dd dir="auto">{{ c.languages }}</dd>
              </div>
            }
          </dl>
          <p class="st-hint">{{ i18n.t('supervisor.candidateReadOnly') }}</p>
        } @else {
          <st-empty-state
            [title]="i18n.t('common.empty.title')"
            [body]="i18n.t('common.empty.body')"
          />
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="candidateOpen.set(false)">
            {{ i18n.t('common.close') }}
          </button>
        </div>
      </st-dialog>
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
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        flex-basis: 100%;
        margin: 0;
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
      }
      .st-kpi__l {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-attn {
        margin: 0.4rem 0 0;
        padding-inline-start: 1.1rem;
        display: grid;
        gap: 0.25rem;
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
      .st-ref--btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
        text-align: start;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 9rem 1fr;
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
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .st-sub2 {
        display: block;
        font-size: 0.72rem;
        color: var(--text-muted);
      }
      .st-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        background: var(--bg-surface);
      }
      .st-table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: 0.83rem;
        min-inline-size: 44rem;
      }
      thead th {
        text-align: start;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        padding: 0.6rem 0.75rem;
        border-block-end: 1px solid var(--border-subtle);
      }
      tbody td {
        padding: 0.55rem 0.75rem;
        border-block-end: 1px solid var(--border-subtle);
        vertical-align: middle;
      }
      tbody tr:last-child td {
        border-block-end: 0;
      }
      .st-row--attn {
        background: color-mix(in srgb, var(--action-warning) 7%, transparent);
      }
      .st-sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
    `,
  ],
})
export class SupervisorDashboardComponent implements OnInit {
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
  private readonly all = signal<readonly SupervisedRow[]>([]);
  private readonly candidateCache = new Map<string, CandidateDetail>();

  /** Candidate info dialog (read-only; CIN never rendered here). */
  readonly candidateOpen = signal(false);
  readonly candidateLoading = signal(false);
  readonly candidate = signal<CandidateDetail | null>(null);

  readonly rows = computed(() => {
    const scope = this.scope();
    const rows = [...this.all()];
    if (scope) return rows.filter((r) => r.supervisorName === scope);
    return rows;
  });
  readonly activeCount = computed(() => this.rows().filter((r) => r.status === 'ACTIVE').length);
  readonly pendingTasks = computed(() => this.rows().reduce((n, r) => n + r.tasksPending, 0));
  readonly pendingJournal = computed(() => this.rows().reduce((n, r) => n + r.journalPending, 0));
  readonly awaitingEvaluation = computed(
    () => this.rows().filter((r) => r.status === 'COMPLETED' && !r.hasFinalEvaluation).length,
  );
  readonly endingSoon = computed(() => this.rows().filter((r) => r.endsSoon).length);
  readonly receiptsIssued = computed(() => this.rows().filter((r) => r.receiptReference).length);
  readonly receiptsPending = computed(
    () => this.rows().filter((r) => r.financeCaseId && !r.receiptReference).length,
  );
  readonly attention = computed(() => this.rows().filter((r) => r.needsAttention));

  isSupervisorOnly(): boolean {
    return this.auth.role() === 'SUPERVISOR';
  }

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.supervisor', labelFallback: 'Supervision' }]);
    if (this.isSupervisorOnly()) this.scope.set(readRememberedSupervisor());
    this.load();
    this.realtime.internshipUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    // Receipt decisions land through finance events — refresh without interaction.
    this.realtime.financeUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  onScopeChange(): void {
    if (this.isSupervisorOnly()) rememberSupervisor(this.scope());
    this.loadSupervision();
  }

  attentionReason(row: SupervisedRow): string {
    const parts: string[] = [];
    if (row.journalPending > 0)
      parts.push(this.i18n.t('supervisor.reasonJournal', { n: String(row.journalPending) }));
    if (row.status === 'COMPLETED' && !row.hasFinalEvaluation)
      parts.push(this.i18n.t('supervisor.reasonEvaluation'));
    if (row.endsSoon && row.status === 'ACTIVE') parts.push(this.i18n.t('supervisor.reasonEnding'));
    if (row.tasksPending > 0 && row.status === 'ACTIVE')
      parts.push(this.i18n.t('supervisor.reasonTasks', { n: String(row.tasksPending) }));
    return parts.join(' · ') || row.status;
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

  financeTone(status: string): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'CLOSED':
        return 'error';
      case 'READY_FOR_DECISION':
        return 'warning';
      default:
        return 'info';
    }
  }

  /** Opens the candidate info dialog; details are cached per session. */
  openCandidate(row: SupervisedRow): void {
    const cached = this.candidateCache.get(row.candidateId);
    this.candidate.set(cached ?? null);
    this.candidateOpen.set(true);
    if (cached) return;
    this.candidateLoading.set(true);
    this.api.getCandidate(row.candidateId).subscribe({
      next: (c) => {
        this.candidateCache.set(row.candidateId, c);
        this.candidate.set(c);
        this.candidateLoading.set(false);
      },
      error: () => {
        this.candidate.set(null);
        this.candidateLoading.set(false);
      },
    });
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
            // Receipt tracking: one bounded read, backend-scoped for supervisors.
            this.api.listFinanceCases('', 0, 100).subscribe({
              next: (page) => {
                const byInternship = new Map(
                  page.content.map((c) => [
                    c.internshipId,
                    {
                      caseId: c.id,
                      status: c.status,
                      receipt: c.receiptReference,
                    },
                  ]),
                );
                this.all.set(
                  joined.map((r) => {
                    const fin = byInternship.get(r.id);
                    return {
                      ...r,
                      tasksDone: 0,
                      tasksPending: 0,
                      journalPending: 0,
                      journalTotal: 0,
                      hasFinalEvaluation: false,
                      financeCaseId: fin?.caseId ?? null,
                      financeStatus: fin?.status ?? null,
                      receiptReference: fin?.receipt ?? null,
                      endsSoon: endsSoon(r.status, r.endDate),
                      needsAttention: false,
                    };
                  }),
                );
                this.loadSupervision();
              },
              error: () => {
                this.all.set(
                  joined.map((r) => ({
                    ...r,
                    tasksDone: 0,
                    tasksPending: 0,
                    journalPending: 0,
                    journalTotal: 0,
                    hasFinalEvaluation: false,
                    financeCaseId: null,
                    financeStatus: null,
                    receiptReference: null,
                    endsSoon: endsSoon(r.status, r.endDate),
                    needsAttention: false,
                  })),
                );
                this.loadSupervision();
              },
            });
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

  private loadSupervision(): void {
    const scoped = this.scopedIds();
    if (scoped.length === 0) {
      this.loading.set(false);
      return;
    }
    const capped = scoped.slice(0, 30);
    forkJoin(
      capped.map((id) =>
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
            const tasksDone = s.tasks.filter((t) => t.status === 'COMPLETED').length;
            const tasksPending = s.tasks.filter(
              (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS',
            ).length;
            const journalPending = s.journal.filter((j) => j.status === 'SUBMITTED').length;
            const hasFinalEvaluation = s.evaluations.some((e) => e.type === 'FINAL');
            const needsAttention =
              journalPending > 0 ||
              (row.status === 'COMPLETED' && !hasFinalEvaluation) ||
              (row.endsSoon && row.status === 'ACTIVE');
            return {
              ...row,
              tasksDone,
              tasksPending,
              journalPending,
              journalTotal: s.journal.length,
              hasFinalEvaluation,
              needsAttention,
            };
          }),
        );
        this.loading.set(false);
      },
      error: () => {
        // Supervision reads are best-effort: assignments still render.
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

function endsSoon(status: string, endDate: string): boolean {
  if (!endDate) return false;
  const end = new Date(endDate + 'T23:59:59');
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return days >= 0 && days <= ENDS_SOON_DAYS && status === 'ACTIVE';
}
