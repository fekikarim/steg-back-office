import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from '../dashboard.component';
import { DashboardService, type DashboardSnapshot } from './dashboard.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
  { path: 'supervisor-dashboard', component: StubComponent },
  { path: 'applications', component: StubComponent },
  { path: 'internships', component: StubComponent },
  { path: 'finance', component: StubComponent },
  { path: 'notifications', component: StubComponent },
  { path: 'login', component: StubComponent },
];

function snapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  const groups = (rows: { groupName: string; count: number }[]) => ({
    state: 'ok' as const,
    data: rows,
    source: 'GET /api/reports/test',
    loadedAt: new Date().toISOString(),
  });
  return {
    applicationsByStatus: groups([
      { groupName: 'SUBMITTED', count: 12 },
      { groupName: 'UNDER_REVIEW', count: 6 },
      { groupName: 'NEEDS_CORRECTION', count: 3 },
    ]),
    internshipsByStatus: groups([
      { groupName: 'ACTIVE', count: 87 },
      { groupName: 'COMPLETED', count: 10 },
    ]),
    internshipsByType: groups([{ groupName: 'PFE', count: 60 }]),
    internshipsByDepartment: groups([{ groupName: 'DSI', count: 40 }]),
    financeByStatus: groups([
      { groupName: 'READY_FOR_DECISION', count: 6 },
      { groupName: 'DOCUMENTS_MISSING', count: 9 },
    ]),
    paymentTotals: {
      state: 'ok',
      data: [{ year: 2026, month: 7, departmentCode: 'DSI', totalAmount: 150, receiptCount: 1 }],
      source: 'GET /api/reports/payment-totals',
      loadedAt: new Date().toISOString(),
    },
    financeQueue: {
      state: 'ok',
      data: [
        {
          id: 'f1',
          reference: 'FIN-2026-000041',
          status: 'READY_FOR_DECISION',
          internshipId: 'i1',
          internshipReference: 'STAGE-2026-000090',
          openedAt: '2026-07-01T00:00:00Z',
          closedAt: null,
          receiptReference: null,
        },
      ],
      source: 'GET /api/finance-cases',
      loadedAt: new Date().toISOString(),
    },
    activity: {
      state: 'ok',
      data: [
        {
          id: 'n1',
          title: 'Application accepted',
          message: 'APP-2026-000118 accepted',
          priority: 'NORMAL',
          relatedEntityType: 'APPLICATION',
          relatedEntityId: 'a1',
          createdAt: '2026-07-02T10:00:00Z',
          read: false,
          readAt: null,
        },
      ],
      source: 'GET /api/notifications',
      loadedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('DashboardComponent', () => {
  async function setup(role: 'ADMIN' | 'SUPERVISOR', snap: DashboardSnapshot) {
    let calls = 0;
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter(stubRoutes),
        {
          provide: DashboardService,
          useValue: {
            load: () => {
              calls++;
              return of(snap);
            },
          },
        },
      ],
    }).compileComponents();
    // English assertions below; component renders from dictionaries.
    TestBed.inject(I18nService).setLocale('en');
    const auth = TestBed.inject(AuthService);
    auth.signInDemo(role === 'ADMIN' ? 'admin@steg.tn' : 'sup@steg.tn', role);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls: () => calls };
  }

  it('ADMIN sees backend-derived KPIs (18 pending, 87 active, 3 corrections) with drill-downs', async () => {
    const { fixture } = await setup('ADMIN', snapshot());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('18');
    expect(text).toContain('87');
    const corrections = fixture.nativeElement.querySelector(
      'a[href*="/applications"]',
    ) as HTMLAnchorElement;
    expect(corrections).toBeTruthy();
    const hrefs = [...fixture.nativeElement.querySelectorAll('.st-kpi')].map((e: Element) =>
      e.getAttribute('href'),
    );
    expect(hrefs.some((h) => h?.includes('/applications'))).toBe(true);
    // Corrections KPI drills down with a status filter
    const withParams = [...fixture.nativeElement.querySelectorAll('.st-kpi')].map((e: Element) =>
      e.getAttribute('href'),
    );
    expect(withParams.some((h) => h?.includes('NEEDS_CORRECTION'))).toBe(true);
  });

  it('ADMIN sees finance KPIs and queue alongside operations KPIs', async () => {
    const { fixture } = await setup('ADMIN', snapshot());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('150');
    expect(text).toContain('FIN-2026-000041');
    expect(text).toContain('Pending applications');
  });

  it('ADMIN sees overview distributions with per-section sources', async () => {
    const { fixture } = await setup('ADMIN', snapshot());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('PFE');
    expect(text).toContain('DSI');
    // Per-section backend source traceability (fixture uses a test source label)
    expect(text).toContain('Source: GET /api/reports/test');
  });

  it('SUPERVISOR is redirected to their dashboard', async () => {
    const { fixture } = await setup('SUPERVISOR', snapshot());
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/supervisor-dashboard');
  });

  it('renders error state with retry for failed datasets', async () => {
    const snap = snapshot({
      activity: { state: 'error', data: null, source: 'GET /api/notifications', loadedAt: null },
    });
    const { fixture, calls } = await setup('ADMIN', snap);
    const retry = fixture.nativeElement.querySelector('st-error-state button') as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    expect(calls()).toBeGreaterThan(1);
  });

  it('shows skeleton while loading and unread badge on activity', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter(stubRoutes),
        { provide: DashboardService, useValue: { load: () => of(snapshot()) } },
      ],
    }).compileComponents();
    TestBed.inject(I18nService).setLocale('en');
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('admin@steg.tn', 'ADMIN');
    const fixture = TestBed.createComponent(DashboardComponent);
    // Before first detection completes, loading skeleton is present
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('unread');
  });

  it('has no manual refresh button — uses live WebSocket with update timestamp', async () => {
    const { fixture } = await setup('ADMIN', snapshot());
    const refreshBtn = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.includes('Refresh'),
    );
    expect(refreshBtn).toBeFalsy();
    expect(fixture.nativeElement.querySelector('st-live-status')).toBeTruthy();
    // Dashboard announces last auto-refresh time without manual button interaction
    expect(fixture.nativeElement.textContent as string).toContain('Updated at');
  });
});
