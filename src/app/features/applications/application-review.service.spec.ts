import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApplicationReviewService } from './application-review.service';
import { ApiClient } from '../../core/api-client.service';
import type { ApplicationDetail } from '../../core/api-models';

function httpError(status: number): { status: number } {
  return { status };
}

const APP: ApplicationDetail = {
  id: 'app-1',
  reference: 'APP-2026-0001',
  status: 'UNDER_REVIEW',
  candidateId: 'cand-1',
  candidateName: 'A B',
  desiredStartDate: '2026-07-01',
  desiredEndDate: '2026-08-31',
  proposedTheme: null,
  submittedOnline: true,
  submissionDate: '2026-06-01',
  calculatedType: 'PERFECTIONNEMENT',
  requirement: 'OBLIGATOIRE',
  rejectionReason: null,
  correctionComment: null,
  reviewerId: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  version: 0,
};

describe('ApplicationReviewService', () => {
  function setup(
    stub: Partial<Record<string, (...args: never[]) => unknown>>,
  ): ApplicationReviewService {
    TestBed.configureTestingModule({
      providers: [
        ApplicationReviewService,
        {
          provide: ApiClient,
          useValue: {
            getApplication: () => of(APP),
            getCandidate: () => of(null),
            getApplicationDocuments: () => of([]),
            getApplicationWorkflow: () => of(null),
            listWorkflowActions: () => of([]),
            executeApplicationTransition: () => of({ id: 'act-1' }),
            verifyApplicationDocument: () => of({}),
            downloadDocument: () => of(new Blob()),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(ApplicationReviewService);
  }

  it('assembles the dossier bundle and tolerates missing workflow/candidate', () => {
    const service = setup({});
    let bundle: unknown;
    service.loadDossier('app-1').subscribe((b) => (bundle = b));
    const d = bundle as import('./application-review.service').DossierBundle;
    expect(d.application.reference).toBe('APP-2026-0001');
    expect(d.workflow).toBeNull();
    expect(d.actions).toEqual([]);
    expect(d.actionsRestricted).toBe(false);
  });

  it('marks history restricted on 403 instead of failing the dossier', () => {
    const service = setup({
      getApplicationWorkflow: () => of({ id: 'wf-1' }),
      listWorkflowActions: () => throwError(() => httpError(403)),
    });
    let bundle!: import('./application-review.service').DossierBundle;
    service.loadDossier('app-1').subscribe((b) => (bundle = b));
    expect(bundle.actions).toEqual([]);
    expect(bundle.actionsRestricted).toBe(true);
  });

  it('propagates non-403 history errors', () => {
    const service = setup({
      getApplicationWorkflow: () => of({ id: 'wf-1' }),
      listWorkflowActions: () => throwError(() => httpError(500)),
    });
    let failed = false;
    service.loadDossier('app-1').subscribe({ error: () => (failed = true) });
    expect(failed).toBe(true);
  });

  it('maps review actions to backend transition payloads (trimmed comments)', () => {
    const seen: unknown[] = [];
    const service = setup({
      executeApplicationTransition: (_id: unknown, body: unknown) => {
        seen.push(body);
        return of({ id: 'act' });
      },
    });
    service.beginReview('app-1').subscribe();
    service.accept('app-1', '  Good file  ').subscribe();
    service.reject('app-1', '  Missing transcripts.  ').subscribe();
    service.requestCorrection('app-1', 'Blurry CIN scan.').subscribe();
    expect(seen).toEqual([
      { actionType: 'VALIDATION', targetStepCode: 'UNDER_REVIEW' },
      {
        actionType: 'APPROVAL',
        targetStepCode: 'FINAL_DECISION',
        decision: 'APPROVED',
        comment: 'Good file',
      },
      {
        actionType: 'APPROVAL',
        targetStepCode: 'FINAL_DECISION',
        decision: 'REJECTED',
        comment: 'Missing transcripts.',
      },
      {
        actionType: 'APPROVAL',
        targetStepCode: 'FINAL_DECISION',
        decision: 'NEEDS_CORRECTION',
        comment: 'Blurry CIN scan.',
      },
    ]);
  });
});
