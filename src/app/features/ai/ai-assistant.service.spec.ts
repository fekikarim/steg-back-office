import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AiAssistantService } from './ai-assistant.service';
import type { AssistData } from './ai-assistant.service';

function data(overrides: Partial<AssistData> = {}): AssistData {
  return {
    applications: [],
    internships: [],
    appsByStatus: [],
    internshipsByStatus: [],
    financeByStatus: [],
    scope: '',
    scopedIds: new Set<string>(),
    ...overrides,
  };
}

describe('AiAssistantService (rule-based)', () => {
  let service: AiAssistantService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AiAssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  it('flags submitted applications as review tasks with medium priority', () => {
    const d = data({
      applications: [
        {
          id: 'a1',
          reference: 'APP-1',
          status: 'SUBMITTED',
          candidateId: 'c1',
          candidateName: 'Nadia',
          desiredStartDate: '2026-03-01',
          desiredEndDate: '2026-06-01',
          proposedTheme: null,
          submittedOnline: true,
          submissionDate: '2026-01-10',
          calculatedType: null,
          requirement: null,
          rejectionReason: null,
          correctionComment: null,
          reviewerId: null,
          createdAt: '2026-01-10T00:00:00Z',
          updatedAt: new Date().toISOString(),
          version: 0,
        },
      ],
    });
    const tasks = service.tasks(d);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.kind).toBe('review-application');
    expect(tasks[0]?.link).toBe('/applications/a1');
  });

  it('flags completed internships for validation and ending ones for monitoring', () => {
    const ended = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const d = data({
      internships: [
        {
          id: 's1',
          reference: 'STAGE-1',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          status: 'COMPLETED',
          type: 'PFE',
          requirement: 'OBLIGATOIRE',
          paymentEligible: true,
          subject: 'x',
          academicLevel: 'ING',
          candidateId: 'c1',
          candidateFullName: 'Nadia',
          applicationId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
          version: 0,
        },
        {
          id: 's2',
          reference: 'STAGE-2',
          startDate: '2026-06-01',
          endDate: ended,
          status: 'ACTIVE',
          type: 'PFE',
          requirement: 'OBLIGATOIRE',
          paymentEligible: true,
          subject: 'y',
          academicLevel: 'ING',
          candidateId: 'c2',
          candidateFullName: 'Karim',
          applicationId: null,
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
          version: 0,
        },
      ],
    });
    const kinds = service.tasks(d).map((t) => t.kind);
    expect(kinds).toContain('validate-internship');
    expect(kinds).toContain('monitor-ending');
  });

  it('restricts supervisor scope to assigned internships', () => {
    const intern = {
      id: 's9',
      reference: 'STAGE-9',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      status: 'COMPLETED',
      type: 'PFE',
      requirement: 'OBLIGATOIRE',
      paymentEligible: true,
      subject: 'x',
      academicLevel: 'ING',
      candidateId: 'c1',
      candidateFullName: 'Nadia',
      applicationId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      version: 0,
    } as const;
    const scoped = data({ internships: [intern], scope: 'Leila', scopedIds: new Set() });
    expect(service.tasks(scoped)).toHaveLength(0);
    const mine = data({ internships: [intern], scope: 'Leila', scopedIds: new Set(['s9']) });
    expect(service.tasks(mine).map((t) => t.kind)).toContain('validate-internship');
  });

  it('answers suggested questions from live data, never inventing', () => {
    const d = data({
      applications: [],
      internships: [],
      financeByStatus: [{ groupName: 'DOCUMENTS_MISSING', count: 2 }],
    });
    expect(service.answer('How many applications are awaiting approval?', d).params['n']).toBe('0');
    const missing = service.answer('Show me applications with missing documents', d);
    expect(missing.params['n']).toBe('2');
    expect(service.answer('Tell me a joke', d).key).toBe('assistant.answer.guidance');
  });

  it('builds dashboard insights with source links', () => {
    const insights = service.insights(data());
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]?.link).toBe('/tasks');
  });

  it('loads scoped data through the backend (fail-soft)', () => {
    service.loadScoped('').subscribe((loaded) => {
      expect(loaded.applications).toEqual([]);
      expect(loaded.internships).toEqual([]);
    });
    const reqs = http.match(() => true);
    expect(reqs.length).toBeGreaterThan(0);
    for (const req of reqs) req.flush([]);
    http.verify();
  });
});
