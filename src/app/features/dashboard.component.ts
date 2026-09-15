import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../core/auth.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { DashboardService, type DashboardSnapshot } from './dashboard/dashboard.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { BadgeComponent } from '../shared/ui/badge.component';
import { SkeletonComponent } from '../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../shared/ui/states.component';
import { StIconComponent } from '../shared/ui/icon.component';
import { DistBarsComponent } from './dashboard/dist-bars.component';
import { sumGroups, countOf, totalOf, type GroupCountDto } from '../core/api-models';
import type { StaffRole } from '../core/roles';

/**
 * Operational home: role-specific KPI cards, distribution breakdowns and
 * actionable queues. Every figure traces to a Phase A13 `/api/reports/*`
 * endpoint (source shown per section); nothing is derived from partial
 * client lists and no decorative charts are used.
 */
@Component({
  selector: 'st-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    NgTemplateOutlet,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
    StIconComponent,
    DistBarsComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('dashboard.title')" [subtitle]="i18n.t('dashboard.subtitle')">
      <button
        type="button"
        class="st-btn st-btn--secondary"
        (click)="load()"
        [disabled]="loading()"
      >
        <st-icon name="refresh" [size]="15" /> {{ i18n.t('dashboard.refresh') }}
      </button>
    </st-page-header>

    @if (refreshedAt()) {
      <p class="st-updated" aria-live="polite">
        {{ i18n.t('dashboard.updatedAt', { time: refreshedAt() }) }}
      </p>
    }

    @if (loading()) {
      <div class="st-kpis" aria-busy="true">
        <st-skeleton [rows]="4" />
        <st-skeleton [rows]="4" />
      </div>
    } @else if (snapshot(); as snap) {
      <!-- Applications + internships KPIs (HR / SUPERVISOR / DIRECTOR / ADMIN) -->
      @if (showOperations()) {
        <section class="st-kpis" aria-label="Operations">
          <a routerLink="/applications" class="st-kpi">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.pendingApplications') }}</span>
            <strong class="st-kpi__value">{{ pendingApps(snap) }}</strong>
            <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
          </a>
          <a routerLink="/internships" class="st-kpi">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.activeInternships') }}</span>
            <strong class="st-kpi__value">{{ activeInternships(snap) }}</strong>
            <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
          </a>
          <a
            routerLink="/applications"
            [queryParams]="{ status: 'NEEDS_CORRECTION' }"
            class="st-kpi"
          >
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.corrections') }}</span>
            <strong class="st-kpi__value">{{ corrections(snap) }}</strong>
            <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
          </a>
          @if (showOverview()) {
            <div class="st-kpi st-kpi--static">
              <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.totalApplications') }}</span>
              <strong class="st-kpi__value">{{ totalOf(appGroups(snap)) }}</strong>
              <span class="st-kpi__src">{{
                i18n.t('dashboard.source', { source: snap.applicationsByStatus.source })
              }}</span>
            </div>
          }
        </section>

        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.applications')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.applications') }}</h2>
            <ng-container
              *ngTemplateOutlet="dataset; context: { $implicit: snap.applicationsByStatus }"
            />
            @if (
              snap.applicationsByStatus.state === 'ok' &&
              (snap.applicationsByStatus.data?.length ?? 0) > 0
            ) {
              <st-dist-bars
                [label]="i18n.t('dashboard.section.applications')"
                [groups]="snap.applicationsByStatus.data ?? []"
              />
            }
          </section>
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.internships')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.internships') }}</h2>
            <ng-container
              *ngTemplateOutlet="dataset; context: { $implicit: snap.internshipsByStatus }"
            />
            @if (
              snap.internshipsByStatus.state === 'ok' &&
              (snap.internshipsByStatus.data?.length ?? 0) > 0
            ) {
              <st-dist-bars
                [label]="i18n.t('dashboard.section.internships')"
                [groups]="snap.internshipsByStatus.data ?? []"
              />
            }
          </section>
        </div>
      }

      <!-- Finance KPIs + queue (FINANCE / DIRECTOR / ADMIN) -->
      @if (showFinance()) {
        <section class="st-kpis" aria-label="Finance">
          <a routerLink="/finance" [queryParams]="{ status: 'READY_FOR_DECISION' }" class="st-kpi">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.readyForDecision') }}</span>
            <strong class="st-kpi__value">{{ readyForDecision(snap) }}</strong>
            <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
          </a>
          <a routerLink="/finance" [queryParams]="{ status: 'DOCUMENTS_MISSING' }" class="st-kpi">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.documentsMissing') }}</span>
            <strong class="st-kpi__value">{{ docsMissing(snap) }}</strong>
            <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
          </a>
          <div class="st-kpi st-kpi--static">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.approvedAmount') }}</span>
            <strong class="st-kpi__value" dir="auto">{{ approvedAmount(snap) }} TND</strong>
            <span class="st-kpi__src">{{
              i18n.t('dashboard.source', { source: snap.paymentTotals.source })
            }}</span>
          </div>
          <div class="st-kpi st-kpi--static">
            <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.approvedReceipts') }}</span>
            <strong class="st-kpi__value">{{ approvedReceipts(snap) }}</strong>
            <span class="st-kpi__src">{{
              i18n.t('dashboard.source', { source: snap.paymentTotals.source })
            }}</span>
          </div>
        </section>

        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.finance')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.finance') }}</h2>
            <ng-container
              *ngTemplateOutlet="dataset; context: { $implicit: snap.financeByStatus }"
            />
            @if (
              snap.financeByStatus.state === 'ok' && (snap.financeByStatus.data?.length ?? 0) > 0
            ) {
              <st-dist-bars
                [label]="i18n.t('dashboard.section.finance')"
                [groups]="snap.financeByStatus.data ?? []"
              />
            }
          </section>
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.financeQueue')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.financeQueue') }}</h2>
            <ng-container *ngTemplateOutlet="dataset; context: { $implicit: snap.financeQueue }" />
            @if (snap.financeQueue.state === 'ok') {
              @if ((snap.financeQueue.data?.length ?? 0) === 0) {
                <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
              } @else {
                <ul class="st-queue">
                  @for (row of snap.financeQueue.data ?? []; track row.id) {
                    <li>
                      <a routerLink="/finance" class="st-queue__row">
                        <span dir="ltr">
                          <strong>{{ row.reference }}</strong>
                          <small class="st-muted"> · {{ row.internshipReference }}</small>
                        </span>
                        <st-badge [label]="row.status" tone="warning" />
                      </a>
                    </li>
                  }
                </ul>
              }
            }
          </section>
        </div>

        <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.payments')">
          <h2 class="st-card__title">{{ i18n.t('dashboard.section.payments') }}</h2>
          <ng-container *ngTemplateOutlet="dataset; context: { $implicit: snap.paymentTotals }" />
          @if (snap.paymentTotals.state === 'ok' && (snap.paymentTotals.data?.length ?? 0) > 0) {
            <div class="st-table-wrap">
              <table class="st-table">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Month</th>
                    <th scope="col">Department</th>
                    <th scope="col">Amount (TND)</th>
                    <th scope="col">Receipts</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    row of snap.paymentTotals.data ?? [];
                    track row.year + '-' + row.month + '-' + row.departmentCode
                  ) {
                    <tr>
                      <td>{{ row.year }}</td>
                      <td>{{ row.month }}</td>
                      <td dir="auto">{{ row.departmentCode }}</td>
                      <td dir="ltr">{{ row.totalAmount }}</td>
                      <td>{{ row.receiptCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }

      <!-- Director / Admin overview -->
      @if (showOverview()) {
        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.types')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.types') }}</h2>
            <ng-container
              *ngTemplateOutlet="dataset; context: { $implicit: snap.internshipsByType }"
            />
            @if (
              snap.internshipsByType.state === 'ok' &&
              (snap.internshipsByType.data?.length ?? 0) > 0
            ) {
              <st-dist-bars
                [label]="i18n.t('dashboard.section.types')"
                [groups]="snap.internshipsByType.data ?? []"
              />
            }
          </section>
          <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.departments')">
            <h2 class="st-card__title">{{ i18n.t('dashboard.section.departments') }}</h2>
            <ng-container
              *ngTemplateOutlet="dataset; context: { $implicit: snap.internshipsByDepartment }"
            />
            @if (
              snap.internshipsByDepartment.state === 'ok' &&
              (snap.internshipsByDepartment.data?.length ?? 0) > 0
            ) {
              <st-dist-bars
                [label]="i18n.t('dashboard.section.departments')"
                [groups]="snap.internshipsByDepartment.data ?? []"
              />
            }
          </section>
        </div>
      }

      <!-- Recent activity from backend notifications -->
      <section class="st-card" [attr.aria-label]="i18n.t('dashboard.activity.title')">
        <div class="st-card__head">
          <h2 class="st-card__title">{{ i18n.t('dashboard.activity.title') }}</h2>
          <a routerLink="/notifications" class="st-btn st-btn--text">{{
            i18n.t('dashboard.markAllRead')
          }}</a>
        </div>
        <ng-container *ngTemplateOutlet="dataset; context: { $implicit: snap.activity }" />
        @if (snap.activity.state === 'ok') {
          @if ((snap.activity.data?.length ?? 0) === 0) {
            <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
          } @else {
            <ul class="st-activity">
              @for (n of snap.activity.data ?? []; track n.id) {
                <li class="st-activity__row">
                  <strong dir="auto">{{ n.title }}</strong>
                  <span dir="auto">{{ n.message }}</span>
                  @if (!n.read) {
                    <st-badge [label]="i18n.t('dashboard.unread')" tone="info" />
                  }
                </li>
              }
            </ul>
          }
        }
      </section>

      <!-- Shared dataset state renderer -->
      <ng-template #dataset let-ds>
        @if (ds.state === 'unavailable') {
          <p class="st-muted">
            <strong>{{ i18n.t('dashboard.unavailable.title') }}</strong
            ><br />
            {{ i18n.t('dashboard.unavailable.body') }}
          </p>
        } @else if (ds.state === 'error') {
          <st-error-state
            [title]="i18n.t('common.error.title')"
            [body]="i18n.t('common.error.body') + ' (' + ds.source + ')'"
            [retryLabel]="i18n.t('common.retry')"
            (retry)="load()"
          />
        } @else if ((ds.data?.length ?? 1) === 0) {
          <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
        } @else {
          <p class="st-src">{{ i18n.t('dashboard.source', { source: ds.source }) }}</p>
        }
      </ng-template>
    }
  `,
  styles: [
    `
      .st-updated {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin: 0 0 0.75rem;
      }
      .st-kpis {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(4, 1fr);
        margin-block-end: 1rem;
      }
      .st-kpi {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.9rem;
        display: grid;
        gap: 0.25rem;
        text-decoration: none;
        color: inherit;
      }
      a.st-kpi:hover {
        border-color: var(--action-primary);
      }
      .st-kpi--static {
        cursor: default;
      }
      .st-kpi__label {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-kpi__value {
        font-size: 1.6rem;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
      }
      .st-kpi__link {
        font-size: 0.72rem;
        color: var(--action-primary);
      }
      .st-kpi__src {
        font-size: 0.68rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr 1fr;
        margin-block-end: 0.75rem;
      }
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-end: 0.75rem;
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
      .st-src {
        font-size: 0.7rem;
        color: var(--text-muted);
        margin: 0 0 0.6rem;
        overflow-wrap: anywhere;
      }
      .st-muted {
        font-size: 0.82rem;
        color: var(--text-secondary);
        margin: 0;
      }
      .st-queue,
      .st-activity {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .st-queue__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.65rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        text-decoration: none;
        color: inherit;
        font-size: 0.85rem;
      }
      .st-queue__row:hover {
        border-color: var(--action-primary);
      }
      .st-activity__row {
        display: grid;
        gap: 0.15rem;
        font-size: 0.82rem;
        color: var(--text-secondary);
        padding: 0.5rem 0.65rem;
        border-inline-start: 2px solid var(--border-default);
      }
      .st-activity__row strong {
        color: var(--text-primary);
      }
      .st-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        margin-block-start: 0.6rem;
      }
      .st-table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: 0.83rem;
        min-inline-size: 34rem;
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
        font-variant-numeric: tabular-nums;
      }
      tbody tr:last-child td {
        border-block-end: 0;
      }
      @media (max-width: 1023px) {
        .st-kpis {
          grid-template-columns: repeat(2, 1fr);
        }
        .st-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 480px) {
        .st-kpis {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(DashboardService);

  readonly loading = signal(true);
  readonly snapshot = signal<DashboardSnapshot | null>(null);
  readonly refreshedAt = signal<string>('');

  readonly role = computed(() => this.auth.role());
  readonly showOperations = computed(() => {
    const r = this.role();
    return r === 'HR' || r === 'SUPERVISOR' || r === 'DIRECTOR' || r === 'ADMIN';
  });
  readonly showFinance = computed(() => {
    const r = this.role();
    return r === 'FINANCE' || r === 'DIRECTOR' || r === 'ADMIN';
  });
  readonly showOverview = computed(() => {
    const r = this.role();
    return r === 'DIRECTOR' || r === 'ADMIN';
  });

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.dashboard', labelFallback: 'Dashboard' }]);
    this.load();
  }

  load(): void {
    const role: StaffRole | null = this.auth.role();
    if (!role) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.service.load(role).subscribe({
      next: (snap) => {
        this.snapshot.set(snap);
        this.refreshedAt.set(
          new Date().toLocaleTimeString(this.i18n.locale(), {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  appGroups(snap: DashboardSnapshot): readonly GroupCountDto[] {
    return snap.applicationsByStatus.data ?? [];
  }

  totalOf(groups: readonly GroupCountDto[]): number {
    return totalOf(groups);
  }

  pendingApps(snap: DashboardSnapshot): number {
    return sumGroups(this.appGroups(snap), ['SUBMITTED', 'UNDER_REVIEW']);
  }

  corrections(snap: DashboardSnapshot): number {
    return countOf(this.appGroups(snap), 'NEEDS_CORRECTION');
  }

  activeInternships(snap: DashboardSnapshot): number {
    return countOf(snap.internshipsByStatus.data ?? [], 'ACTIVE');
  }

  readyForDecision(snap: DashboardSnapshot): number {
    return countOf(snap.financeByStatus.data ?? [], 'READY_FOR_DECISION');
  }

  docsMissing(snap: DashboardSnapshot): number {
    return countOf(snap.financeByStatus.data ?? [], 'DOCUMENTS_MISSING');
  }

  approvedAmount(snap: DashboardSnapshot): number {
    return (snap.paymentTotals.data ?? []).reduce((acc, r) => acc + (r.totalAmount ?? 0), 0);
  }

  approvedReceipts(snap: DashboardSnapshot): number {
    return (snap.paymentTotals.data ?? []).reduce((acc, r) => acc + (r.receiptCount ?? 0), 0);
  }
}
