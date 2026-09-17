import { Component, inject, signal, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { RealtimeService } from '../../core/realtime.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DistBarsComponent } from '../dashboard/dist-bars.component';
import {
  normalizePaymentTotals,
  totalOf,
  type GroupCountDto,
  type PaymentTotalRowDto,
} from '../../core/api-models';
import { formatTND } from '../../core/format';

/**
 * Reports (E3): every figure from a real `/api/reports/*` aggregate —
 * applications by status, internships by status/type/department, finance cases
 * by status, payment totals. Server-computed; the client only renders.
 */
@Component({
  selector: 'st-reports',
  standalone: true,
  imports: [
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LiveStatusComponent,
    DistBarsComponent,
  ],
  styles: [
    `
      .st-rp-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }
      .st-rp-card {
        border: 1px solid var(--st-border, #e5e7eb);
        border-radius: 0.75rem;
        padding: 1rem 1.1rem;
        background: var(--st-surface, #fff);
      }
      .st-rp-card h2 {
        margin: 0 0 0.6rem;
        font-size: 1rem;
      }
      .st-rp-total {
        font-size: 1.6rem;
        font-weight: 700;
      }
      .st-rp-live {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
    `,
  ],
  template: `
    <st-page-header [title]="i18n.t('reports.title')" [subtitle]="i18n.t('reports.subtitle')" />
    <div class="st-rp-live"><st-live-status /></div>
    @if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else {
      <div class="st-rp-grid">
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.applications')">
          <h2>{{ i18n.t('reports.applications') }}</h2>
          <p class="st-rp-total">{{ totalOf(applications()) }}</p>
          <st-dist-bars [groups]="applications()" />
        </section>
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.internshipsStatus')">
          <h2>{{ i18n.t('reports.internshipsStatus') }}</h2>
          <p class="st-rp-total">{{ totalOf(internshipsByStatus()) }}</p>
          <st-dist-bars [groups]="internshipsByStatus()" />
        </section>
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.internshipsType')">
          <h2>{{ i18n.t('reports.internshipsType') }}</h2>
          <p class="st-rp-total">{{ totalOf(internshipsByType()) }}</p>
          <st-dist-bars [groups]="internshipsByType()" />
        </section>
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.internshipsDept')">
          <h2>{{ i18n.t('reports.internshipsDept') }}</h2>
          <p class="st-rp-total">{{ totalOf(internshipsByDept()) }}</p>
          <st-dist-bars [groups]="internshipsByDept()" />
        </section>
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.finance')">
          <h2>{{ i18n.t('reports.finance') }}</h2>
          <p class="st-rp-total">{{ totalOf(financeByStatus()) }}</p>
          <st-dist-bars [groups]="financeByStatus()" />
        </section>
        <section class="st-rp-card" [attr.aria-label]="i18n.t('reports.payments')">
          <h2>{{ i18n.t('reports.payments') }}</h2>
          @if (payments().length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('reports.noPayments')"
            />
          } @else {
            @for (row of payments(); track row.year + '-' + row.month + '-' + row.departmentCode) {
              <p dir="auto">
                {{ row.year }}-{{ row.month }} · {{ row.departmentCode }} ·
                {{ fmtAmount(row.totalAmount) }} ({{ row.receiptCount }})
              </p>
            }
          }
        </section>
      </div>
    }
  `,
})
export class ReportsComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly applications = signal<readonly GroupCountDto[]>([]);
  readonly internshipsByStatus = signal<readonly GroupCountDto[]>([]);
  readonly internshipsByType = signal<readonly GroupCountDto[]>([]);
  readonly internshipsByDept = signal<readonly GroupCountDto[]>([]);
  readonly financeByStatus = signal<readonly GroupCountDto[]>([]);
  readonly payments = signal<readonly PaymentTotalRowDto[]>([]);

  readonly totalOf = totalOf;

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.reports', labelFallback: 'Reports' }]);
    this.load();
    // Live: aggregates refresh when backoffice state changes (no refresh needed).
    this.realtime.backofficeEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      applications: this.api
        .getApplicationsByStatus()
        .pipe(catchError(() => of([] as GroupCountDto[]))),
      internshipsByStatus: this.api
        .getInternshipsByStatus()
        .pipe(catchError(() => of([] as GroupCountDto[]))),
      internshipsByType: this.api
        .getInternshipsByType()
        .pipe(catchError(() => of([] as GroupCountDto[]))),
      internshipsByDept: this.api
        .getInternshipsByDepartment()
        .pipe(catchError(() => of([] as GroupCountDto[]))),
      financeByStatus: this.api
        .getFinanceCasesByStatus()
        .pipe(catchError(() => of([] as GroupCountDto[]))),
      payments: this.api.getPaymentTotals().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (r) => {
        this.applications.set(r.applications ?? []);
        this.internshipsByStatus.set(r.internshipsByStatus ?? []);
        this.internshipsByType.set(r.internshipsByType ?? []);
        this.internshipsByDept.set(r.internshipsByDept ?? []);
        this.financeByStatus.set(r.financeByStatus ?? []);
        this.payments.set(normalizePaymentTotals(r.payments));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  fmtAmount(amount: number): string {
    return formatTND(amount, this.i18n.locale());
  }
}
