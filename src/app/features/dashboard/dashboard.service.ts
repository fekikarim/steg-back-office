import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import {
  normalizePaymentTotals,
  type GroupCountDto,
  type PaymentTotalRowDto,
  type NotificationItem,
  type FinanceCaseQueueItem,
  type Page,
} from '../../core/api-models';
import type { StaffRole } from '../../core/roles';

export type DatasetState = 'ok' | 'unavailable' | 'error';

export interface Dataset<T> {
  readonly state: DatasetState;
  /** Backend rows; null when unavailable (403) or failed. Never client-invented. */
  readonly data: T | null;
  /** Reporting endpoint this dataset traces to (auditability per metric). */
  readonly source: string;
  readonly loadedAt: string | null;
}

export interface DashboardSnapshot {
  readonly applicationsByStatus: Dataset<readonly GroupCountDto[]>;
  readonly internshipsByStatus: Dataset<readonly GroupCountDto[]>;
  readonly internshipsByType: Dataset<readonly GroupCountDto[]>;
  readonly internshipsByDepartment: Dataset<readonly GroupCountDto[]>;
  readonly financeByStatus: Dataset<readonly GroupCountDto[]>;
  readonly paymentTotals: Dataset<readonly PaymentTotalRowDto[]>;
  readonly financeQueue: Dataset<readonly FinanceCaseQueueItem[]>;
  readonly activity: Dataset<readonly NotificationItem[]>;
}

function ok<T>(data: T, source: string): Dataset<T> {
  return { state: 'ok', data, source, loadedAt: new Date().toISOString() };
}

function unavailable<T>(source: string): Dataset<T> {
  return { state: 'unavailable', data: null, source, loadedAt: null };
}

function failed<T>(source: string): Dataset<T> {
  return { state: 'error', data: null, source, loadedAt: null };
}

function isForbidden(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const status =
      (error as { status?: number }).status ??
      (error as { error?: { status?: number } }).error?.status;
    return status === 403 || status === 401;
  }
  return false;
}

/**
 * Dashboard data orchestration. Every metric traces to a Phase A13
 * `/api/reports/*` endpoint; queues use bounded reads (size ≤ 8).
 * 403 → `unavailable` (role-scoped, honest); other failures → `error`.
 * No metric is ever computed from partial client-side lists.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  load(role: StaffRole): Observable<DashboardSnapshot> {
    const wantAppReports =
      role === 'HR' || role === 'DIRECTOR' || role === 'ADMIN' || role === 'SUPERVISOR';
    const wantFinanceReports = role === 'FINANCE' || role === 'DIRECTOR' || role === 'ADMIN';
    const wantOverviewReports = role === 'DIRECTOR' || role === 'ADMIN';

    return forkJoin({
      applicationsByStatus: wantAppReports
        ? this.api.getApplicationsByStatus().pipe(
            map((rows) => ok(rows, 'GET /api/reports/applications-by-status')),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly GroupCountDto[]>('GET /api/reports/applications-by-status')
                  : failed<readonly GroupCountDto[]>('GET /api/reports/applications-by-status'),
              ),
            ),
          )
        : of(unavailable<readonly GroupCountDto[]>('GET /api/reports/applications-by-status')),
      internshipsByStatus: wantAppReports
        ? this.api.getInternshipsByStatus().pipe(
            map((rows) => ok(rows, 'GET /api/reports/internships-by-status')),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly GroupCountDto[]>('GET /api/reports/internships-by-status')
                  : failed<readonly GroupCountDto[]>('GET /api/reports/internships-by-status'),
              ),
            ),
          )
        : of(unavailable<readonly GroupCountDto[]>('GET /api/reports/internships-by-status')),
      internshipsByType: wantOverviewReports
        ? this.api.getInternshipsByType().pipe(
            map((rows) => ok(rows, 'GET /api/reports/internships-by-type')),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly GroupCountDto[]>('GET /api/reports/internships-by-type')
                  : failed<readonly GroupCountDto[]>('GET /api/reports/internships-by-type'),
              ),
            ),
          )
        : of(unavailable<readonly GroupCountDto[]>('GET /api/reports/internships-by-type')),
      internshipsByDepartment: wantOverviewReports
        ? this.api.getInternshipsByDepartment().pipe(
            map((rows) => ok(rows, 'GET /api/reports/internships-by-department')),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly GroupCountDto[]>(
                      'GET /api/reports/internships-by-department',
                    )
                  : failed<readonly GroupCountDto[]>('GET /api/reports/internships-by-department'),
              ),
            ),
          )
        : of(unavailable<readonly GroupCountDto[]>('GET /api/reports/internships-by-department')),
      financeByStatus: wantFinanceReports
        ? this.api.getFinanceCasesByStatus().pipe(
            map((rows) => ok(rows, 'GET /api/reports/finance-cases-by-status')),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly GroupCountDto[]>(
                      'GET /api/reports/finance-cases-by-status',
                    )
                  : failed<readonly GroupCountDto[]>('GET /api/reports/finance-cases-by-status'),
              ),
            ),
          )
        : of(unavailable<readonly GroupCountDto[]>('GET /api/reports/finance-cases-by-status')),
      paymentTotals: wantFinanceReports
        ? this.api.getPaymentTotals().pipe(
            map((payload) =>
              ok(normalizePaymentTotals(payload), 'GET /api/reports/payment-totals'),
            ),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly PaymentTotalRowDto[]>('GET /api/reports/payment-totals')
                  : failed<readonly PaymentTotalRowDto[]>('GET /api/reports/payment-totals'),
              ),
            ),
          )
        : of(unavailable<readonly PaymentTotalRowDto[]>('GET /api/reports/payment-totals')),
      financeQueue: wantFinanceReports
        ? this.api.getFinanceCases('READY_FOR_DECISION', 0, 5).pipe(
            map((payload) =>
              ok(
                normalizeQueue(payload),
                'GET /api/finance-cases?status=READY_FOR_DECISION&size=5',
              ),
            ),
            catchError((e: unknown) =>
              of(
                isForbidden(e)
                  ? unavailable<readonly FinanceCaseQueueItem[]>('GET /api/finance-cases')
                  : failed<readonly FinanceCaseQueueItem[]>('GET /api/finance-cases'),
              ),
            ),
          )
        : of(unavailable<readonly FinanceCaseQueueItem[]>('GET /api/finance-cases')),
      activity: this.api.getNotifications(false, 0, 8).pipe(
        map((page) => ok(page.content ?? [], 'GET /api/notifications?size=8')),
        catchError((e: unknown) =>
          of(
            isForbidden(e)
              ? unavailable<readonly NotificationItem[]>('GET /api/notifications')
              : failed<readonly NotificationItem[]>('GET /api/notifications'),
          ),
        ),
      ),
    });
  }
}

function normalizeQueue(
  payload: readonly FinanceCaseQueueItem[] | Page<FinanceCaseQueueItem>,
): readonly FinanceCaseQueueItem[] {
  if (isQueueArray(payload)) return payload;
  return (payload.content ?? []) as readonly FinanceCaseQueueItem[];
}

function isQueueArray(
  value: readonly FinanceCaseQueueItem[] | Page<FinanceCaseQueueItem>,
): value is readonly FinanceCaseQueueItem[] {
  return Array.isArray(value);
}
