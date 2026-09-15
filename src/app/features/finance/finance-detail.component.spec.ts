import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FinanceDetailComponent } from './finance-detail.component';
import { FinanceService, type FinanceCaseBundle } from './finance.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import type { StaffRole } from '../../core/roles';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function bundle(overrides: Partial<FinanceCaseBundle> = {}): FinanceCaseBundle {
  return {
    financeCase: {
      id: 'fc1',
      reference: 'FIN-2026-0001',
      status: 'READY_FOR_DECISION',
      internshipId: 'i1',
      internshipReference: 'STAGE-2026-0001',
      openedAt: '2026-10-01T00:00:00Z',
      closedAt: null,
      workflowInstanceId: 'wf1',
      calculation: {
        completedMonths: 6,
        payableMonths: 3,
        ratePerMonth: 50,
        calculatedAmount: 300,
        cappedAmount: 150,
        capApplied: true,
        currencyCode: 'TND',
        calculatedAt: '2026-10-02T00:00:00Z',
      },
      documents: [],
      approvals: [
        {
          id: 'ap1',
          decision: 'APPROVED',
          comment: 'Dossier complete.',
          decisionSequence: 1,
          decidedAt: '2026-10-03T00:00:00Z',
          decidedByName: 'Finance Benali',
        },
      ],
      receiptReference: null,
    },
    internship: {
      id: 'i1',
      reference: 'STAGE-2026-0001',
      startDate: '2026-02-01',
      endDate: '2026-07-31',
      status: 'COMPLETED',
      type: 'PFE',
      requirement: 'OBLIGATOIRE',
      paymentEligible: true,
      subject: 'Grid',
      academicLevel: 'Engineer',
      candidateId: 'c1',
      candidateFullName: 'Sara Ben Ammar',
      applicationId: 'a1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
      version: 0,
    },
    assignment: {
      id: 'as1',
      internshipId: 'i1',
      departmentId: 'd1',
      departmentName: 'DSI',
      supervisorId: 's1',
      supervisorName: 'Leila Mansour',
      assignedById: 'e9',
      assignedByName: 'HR Staff',
      assignedAt: '2026-02-01',
      startDate: null,
      endDate: null,
      status: 'ACTIVE',
      assignmentReason: null,
      endedAt: null,
      createdAt: '2026-02-01T00:00:00Z',
      version: 0,
    },
    docs: [],
    ...overrides,
  };
}

describe('FinanceDetailComponent', () => {
  async function setup(role: StaffRole, snap: FinanceCaseBundle) {
    const calls: { method: string; args: unknown[] }[] = [];
    await TestBed.configureTestingModule({
      imports: [FinanceDetailComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'finance', component: StubComponent },
          { path: 'internships/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'fc1' } } },
        },
        {
          provide: FinanceService,
          useValue: {
            loadCase: () => of(snap),
            recalculate: () => {
              calls.push({ method: 'recalculate', args: [] });
              return of(snap.financeCase);
            },
            approve: (_id: unknown, comment: unknown) => {
              calls.push({ method: 'approve', args: [_id, comment] });
              return of(snap.financeCase);
            },
            reject: (_id: unknown, reason: unknown) => {
              calls.push({ method: 'reject', args: [_id, reason] });
              return of(snap.financeCase);
            },
            downloadReceipt: () => {
              calls.push({ method: 'downloadReceipt', args: [] });
              return of(new Blob());
            },
            reviewDocument: () => of({}),
            downloadDocument: () => of(new Blob()),
            analyze: () =>
              of({
                analysis: {
                  id: 'an1',
                  type: 'FINANCE_CASE_ANALYSIS',
                  modelUsed: 'test-model',
                  cinExcluded: true,
                },
                recommendations: [
                  {
                    id: 'rec1',
                    analysisId: 'an1',
                    recommendationText: 'Check assignment letter dates.',
                    status: 'PROPOSED',
                  },
                ],
                responseText: 'Dossier looks consistent.',
              }),
            reviewRecommendation: (id: unknown, status: unknown) => {
              calls.push({ method: 'reviewRecommendation', args: [id, status] });
              return of({ id, status });
            },
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo(`${role.toLowerCase()}@steg.tn`, role);
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(FinanceDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls };
  }

  it('renders the backend calculation verbatim with actual vs payable separated', async () => {
    const { fixture } = await setup('FINANCE', bundle());
    const text = fixture.nativeElement.textContent as string;
    // Actual 6-month period intact…
    expect(text).toContain('2026-02-01');
    expect(text).toContain('2026-07-31');
    // …and backend snapshot verbatim: 6 completed, 3 payable, 300 → capped 150.
    expect(text).toContain('300');
    expect(text).toContain('150');
    expect(text).toContain('Cap applied');
    expect(text).toContain('PFE');
  });

  it('hides approve/reject without the FINANCE role (ADMIN is read-only here)', async () => {
    const { fixture } = await setup('ADMIN', bundle());
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Approve payment');
    expect(text).not.toContain('Reject payment');
  });

  it('requires an explicit confirmation stating the receipt consequence', async () => {
    const { fixture, calls } = await setup('FINANCE', bundle());
    const component = fixture.componentInstance;
    component.openReason('approve');
    fixture.detectChanges();
    // Optional comment path goes straight to the receipt-consequence confirm.
    component.submitReason();
    fixture.detectChanges();
    expect(component.confirmApprove()).toBe(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('official PDF payment receipt');
    component.doApprove();
    expect(calls.some((c) => c.method === 'approve')).toBe(true);
  });

  it('blocks short rejection reasons client-side (backend stays authoritative)', async () => {
    const { fixture, calls } = await setup('FINANCE', bundle());
    const component = fixture.componentInstance;
    component.openReason('reject');
    component.reasonText = 'no';
    component.submitReason();
    expect(component.reasonError()).toBeTruthy();
    expect(calls.length).toBe(0);
    component.reasonText = 'CIN copy missing from the dossier.';
    component.submitReason();
    expect(calls).toEqual([
      { method: 'reject', args: ['fc1', 'CIN copy missing from the dossier.'] },
    ]);
  });

  it('shows the receipt only when the backend confirms generation', async () => {
    const without = await setup('FINANCE', bundle());
    expect(without.fixture.nativeElement.textContent as string).toContain('No receipt');

    await TestBed.resetTestingModule();
    const snap = bundle();
    const withReceipt = {
      ...snap,
      financeCase: {
        ...snap.financeCase,
        status: 'APPROVED' as const,
        receiptReference: 'PAY-2026-0001',
      },
    };
    const { fixture, calls } = await setup('FINANCE', withReceipt);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('PAY-2026-0001');
    const component = fixture.componentInstance;
    component.downloadReceipt();
    expect(calls.some((c) => c.method === 'downloadReceipt')).toBe(true);
  });

  it('keeps AI advisory with no approve path and traceable reviews', async () => {
    const { fixture, calls } = await setup('FINANCE', bundle());
    const component = fixture.componentInstance;
    component.tab.set('ai');
    component.runAnalysis();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('AI assists, humans decide');
    expect(text).toContain('CIN excluded');
    expect(text).toContain('Check assignment letter dates.');
    // No AI-driven approve/reject exists on the AI panel itself.
    const sections = [...fixture.nativeElement.querySelectorAll('section.st-card')];
    const aiSection = sections.find((s: Element) =>
      s.querySelector('h2')?.textContent?.includes('AI analysis'),
    ) as Element | undefined;
    expect(aiSection?.textContent).not.toContain('Approve payment');
    expect(aiSection?.textContent).not.toContain('Reject payment');
    component.reviewRec('rec1', 'DISMISSED');
    expect(calls.some((c) => c.method === 'reviewRecommendation')).toBe(true);
  });

  it('disables restricted downloads without DOCUMENT_VIEW_RESTRICTED', async () => {
    await TestBed.resetTestingModule();
    const snap = bundle();
    const docsBundle: FinanceCaseBundle = {
      ...snap,
      docs: [
        {
          documentId: 'd1',
          documentReference: 'DOC-1',
          documentType: 'CIN_COPY',
          mandatory: true,
          verificationStatus: 'PENDING',
          verificationComment: null,
          reviewedAt: null,
          reviewedByName: null,
          meta: {
            id: 'd1',
            reference: 'DOC-1',
            type: 'CIN_COPY',
            restrictedAccess: true,
            generatedAutomatically: false,
            latestVersionNumber: 1,
            originalFileName: 'cin.png',
            mimeType: 'image/png',
            sizeBytes: 1024,
            checksum: 'abc',
            uploadedAt: '2026-06-01T00:00:00Z',
            createdAt: '2026-06-01T00:00:00Z',
          },
        },
      ],
    };
    // DIRECTOR can view the case but holds no DOCUMENT_VIEW_RESTRICTED.
    const { fixture } = await setup('DIRECTOR', docsBundle);
    const component = fixture.componentInstance;
    component.tab.set('dossier');
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('.st-docrow__actions button')];
    const download = buttons.find((b: HTMLButtonElement) => b.textContent?.includes('Download')) as
      HTMLButtonElement | undefined;
    expect(download).toBeTruthy();
    expect(download?.disabled).toBe(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sensitive data');
  });

  it('surfaces backend 403 on decisions as a forbidden toast', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [FinanceDetailComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'finance', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'fc1' } } },
        },
        {
          provide: FinanceService,
          useValue: {
            loadCase: () => of(bundle()),
            approve: () => throwError(() => ({ status: 403 })),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('finance@steg.tn', 'FINANCE');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(FinanceDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.openReason('approve');
    component.submitReason();
    component.doApprove();
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.some((t) => t.kind === 'error')).toBe(true);
  });
});
