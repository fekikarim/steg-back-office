import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardService, type DashboardSnapshot } from './dashboard.service';
import { ApiClient } from '../../core/api-client.service';

function httpError(status: number): { status: number } {
  return { status };
}

describe('DashboardService', () => {
  const appGroups = [
    { groupName: 'SUBMITTED', count: 12 },
    { groupName: 'UNDER_REVIEW', count: 6 },
    { groupName: 'NEEDS_CORRECTION', count: 3 },
  ];
  const internGroups = [
    { groupName: 'ACTIVE', count: 87 },
    { groupName: 'COMPLETED', count: 41 },
  ];

  function setup(stub: Partial<Record<string, () => unknown>>): DashboardService {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        {
          provide: ApiClient,
          useValue: {
            getApplicationsByStatus: () => of([]),
            getInternshipsByStatus: () => of([]),
            getInternshipsByType: () => of([]),
            getInternshipsByDepartment: () => of([]),
            getFinanceCasesByStatus: () => of([]),
            getPaymentTotals: () => of([]),
            getFinanceCases: () => of([]),
            getNotifications: () => of({ content: [] }),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(DashboardService);
  }

  it('HR loads application/internship reports + activity, skips finance endpoints', () => {
    let financeCalled = false;
    const service = setup({
      getApplicationsByStatus: () => of(appGroups),
      getInternshipsByStatus: () => of(internGroups),
      getFinanceCasesByStatus: () => {
        financeCalled = true;
        return of([]);
      },
      getPaymentTotals: () => {
        financeCalled = true;
        return of([]);
      },
      getFinanceCases: () => {
        financeCalled = true;
        return of([]);
      },
    });
    let snapshot!: DashboardSnapshot;
    service.load('HR').subscribe((s) => (snapshot = s));
    const snap: DashboardSnapshot = snapshot;
    expect(snap.applicationsByStatus.state).toBe('ok');
    expect(snap.applicationsByStatus.data).toEqual(appGroups);
    expect(snap.applicationsByStatus.source).toContain('/api/reports/applications-by-status');
    expect(snap.internshipsByStatus.state).toBe('ok');
    expect(snap.internshipsByType.state).toBe('unavailable');
    expect(snap.financeByStatus.state).toBe('unavailable');
    expect(snap.paymentTotals.state).toBe('unavailable');
    expect(financeCalled).toBe(false);
  });

  it('maps 403 to unavailable and other failures to error', () => {
    const service = setup({
      getApplicationsByStatus: () => throwError(() => httpError(403)),
      getInternshipsByStatus: () => throwError(() => httpError(500)),
    });
    let snapshot!: DashboardSnapshot;
    service.load('HR').subscribe((s) => (snapshot = s));
    expect(snapshot.applicationsByStatus.state).toBe('unavailable');
    expect(snapshot.applicationsByStatus.data).toBeNull();
    expect(snapshot.internshipsByStatus.state).toBe('error');
  });

  it('normalizes single-object payment totals and paged finance queue', () => {
    const service = setup({
      getPaymentTotals: () =>
        of({ year: 2026, month: 7, departmentCode: 'DSI', totalAmount: 150, receiptCount: 1 }),
      getFinanceCases: () =>
        of({
          content: [{ id: '1', reference: 'FIN-1', status: 'READY_FOR_DECISION' }],
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: 5,
        }),
    });
    let snapshot!: DashboardSnapshot;
    service.load('FINANCE').subscribe((s) => (snapshot = s));
    expect(snapshot.paymentTotals.data).toEqual([
      { year: 2026, month: 7, departmentCode: 'DSI', totalAmount: 150, receiptCount: 1 },
    ]);
    expect(snapshot.financeQueue.data).toEqual([
      { id: '1', reference: 'FIN-1', status: 'READY_FOR_DECISION' },
    ]);
    expect(snapshot.applicationsByStatus.state).toBe('unavailable');
  });

  it('DIRECTOR loads every dataset including overview reports', () => {
    const service = setup({
      getInternshipsByType: () => of([{ groupName: 'PFE', count: 60 }]),
      getInternshipsByDepartment: () => of([{ groupName: 'DSI', count: 40 }]),
    });
    let snapshot!: DashboardSnapshot;
    service.load('DIRECTOR').subscribe((s) => (snapshot = s));
    expect(snapshot.internshipsByType.state).toBe('ok');
    expect(snapshot.internshipsByDepartment.state).toBe('ok');
    expect(snapshot.financeByStatus.state).toBe('ok');
  });
});
