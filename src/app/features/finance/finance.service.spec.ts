import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FinanceService } from './finance.service';
import { ApiClient } from '../../core/api-client.service';
import type { FinanceCaseDetail } from '../../core/api-models';

function httpError(status: number): { status: number } {
  return { status };
}

const CASE: FinanceCaseDetail = {
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
  documents: [
    {
      documentId: 'd1',
      documentReference: 'DOC-1',
      documentType: 'CIN_COPY',
      mandatory: true,
      verificationStatus: 'PENDING',
      verificationComment: null,
      reviewedAt: null,
      reviewedByName: null,
    },
  ],
  approvals: [],
  receiptReference: null,
};

describe('FinanceService', () => {
  function setup(stub: Partial<Record<string, (...args: never[]) => unknown>>): FinanceService {
    TestBed.configureTestingModule({
      providers: [
        FinanceService,
        {
          provide: ApiClient,
          useValue: {
            getFinanceCase: () => of(CASE),
            getInternship: () => of(null),
            listAssignments: () => of([]),
            getDocumentMetadata: () => of(null),
            recalculateCase: () => of(CASE),
            approveCase: () => of(CASE),
            rejectCase: () => of(CASE),
            downloadReceipt: () => of(new Blob()),
            reviewFinanceDocument: () => of({}),
            downloadDocument: () => of(new Blob()),
            analyzeFinanceCase: () => of({ analysis: {}, recommendations: [], responseText: '' }),
            reviewAiRecommendation: () => of({}),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(FinanceService);
  }

  it('assembles the bundle and isolates restricted metadata denial per row', () => {
    const service = setup({
      getDocumentMetadata: () => throwError(() => httpError(403)),
    });
    let bundle!: import('./finance.service').FinanceCaseBundle;
    service.loadCase('fc1').subscribe((b) => (bundle = b));
    expect(bundle.financeCase.reference).toBe('FIN-2026-0001');
    expect(bundle.docs.length).toBe(1);
    expect(bundle.docs[0]?.meta).toBeNull();
    expect(bundle.internship).toBeNull();
  });

  it('passes decision payloads through untouched (backend decides)', () => {
    const seen: unknown[] = [];
    const service = setup({
      approveCase: (id: unknown, comment: unknown) => {
        seen.push([id, comment]);
        return of(CASE);
      },
      rejectCase: (id: unknown, reason: unknown) => {
        seen.push([id, reason]);
        return of(CASE);
      },
    });
    service.approve('fc1', '  Looks good  ').subscribe();
    service.reject('fc1', 'Missing CIN copy.').subscribe();
    expect(seen).toEqual([
      ['fc1', '  Looks good  '],
      ['fc1', 'Missing CIN copy.'],
    ]);
  });

  it('propagates 403 on decisions instead of masking it', () => {
    const service = setup({ approveCase: () => throwError(() => httpError(403)) });
    let failed: unknown;
    service.approve('fc1').subscribe({ error: (e: unknown) => (failed = e) });
    expect((failed as { status: number }).status).toBe(403);
  });
});
