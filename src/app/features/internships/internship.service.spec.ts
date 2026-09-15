import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InternshipService, activeAssignment, type InternshipBundle } from './internship.service';
import { ApiClient } from '../../core/api-client.service';
import type { InternshipDetail } from '../../core/api-models';

function httpError(status: number): { status: number } {
  return { status };
}

const INTERNSHIP: InternshipDetail = {
  id: 'i1',
  reference: 'STAGE-2026-0001',
  startDate: '2026-07-01',
  endDate: '2026-09-30',
  status: 'ACTIVE',
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
};

describe('activeAssignment', () => {
  it('returns the ACTIVE assignment or null', () => {
    expect(activeAssignment([])).toBeNull();
    const rows = [
      { status: 'ENDED', supervisorName: 'Old' },
      { status: 'ACTIVE', supervisorName: 'New' },
    ] as unknown as InternshipBundle['assignments'];
    expect(activeAssignment(rows)?.supervisorName).toBe('New');
  });
});

describe('InternshipService', () => {
  function setup(stub: Partial<Record<string, (...args: never[]) => unknown>>): InternshipService {
    TestBed.configureTestingModule({
      providers: [
        InternshipService,
        {
          provide: ApiClient,
          useValue: {
            getInternship: () => of(INTERNSHIP),
            getCandidate: () => of(null),
            getClassification: () => of(null),
            listAssignments: () => of([]),
            getInternshipWorkflow: () => of(null),
            listWorkflowActions: () => of([]),
            executeInternshipTransition: () => of({ id: 'act-1' }),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(InternshipService);
  }

  it('assembles the bundle and tolerates missing pieces', () => {
    const service = setup({});
    let bundle!: InternshipBundle;
    service.loadBundle('i1').subscribe((b) => (bundle = b));
    expect(bundle.internship.reference).toBe('STAGE-2026-0001');
    expect(bundle.workflow).toBeNull();
    expect(bundle.actions).toEqual([]);
    expect(bundle.actionsRestricted).toBe(false);
  });

  it('marks history restricted on 403 instead of failing the bundle', () => {
    const service = setup({
      getInternshipWorkflow: () => of({ id: 'wf-1' }),
      listWorkflowActions: () => throwError(() => httpError(403)),
    });
    let bundle!: InternshipBundle;
    service.loadBundle('i1').subscribe((b) => (bundle = b));
    expect(bundle.actions).toEqual([]);
    expect(bundle.actionsRestricted).toBe(true);
  });

  it('maps lifecycle transitions to backend payloads', () => {
    const seen: unknown[] = [];
    const service = setup({
      executeInternshipTransition: (_id: unknown, body: unknown) => {
        seen.push(body);
        return of({ id: 'act' });
      },
    });
    service.activate('i1').subscribe();
    service.complete('i1').subscribe();
    expect(seen).toEqual([
      { actionType: 'VALIDATION', targetStepCode: 'ACTIVE' },
      { actionType: 'COMPLETION', targetStepCode: 'COMPLETED' },
    ]);
  });

  it('isolates per-internship assignment failures in the map', () => {
    const service = setup({
      listAssignments: (id: unknown) =>
        id === 'bad' ? throwError(() => httpError(403)) : of([{ id: 'as-1', status: 'ACTIVE' }]),
    });
    let map!: Map<string, unknown[]>;
    service.loadAssignmentMap(['ok', 'bad']).subscribe((m) => (map = m));
    expect(map.get('ok')?.length).toBe(1);
    expect(map.get('bad')).toEqual([]);
  });
});
