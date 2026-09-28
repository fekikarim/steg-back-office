import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

/**
 * Contract parity: supervision endpoints must match the Spring backend
 * (`CompanionController @RequestMapping("/api/internships")`). A past bug
 * used `/api/tasks/...`, `/api/journal/...`, `/api/deliverables/...` which
 * the E2E mock mirrored — hiding a real 404 against the backend.
 */
describe('ApiClient supervision contract parity', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('PATCHes task status under /api/internships/tasks', () => {
    api.updateTaskStatus('t1', 'COMPLETED').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/internships/tasks/t1/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.params.get('status')).toBe('COMPLETED');
    req.flush({});
    http.verify();
  });

  it('validates/rejects journal entries under /api/internships/journal/entries', () => {
    api.validateJournalEntry('j1', 'ok').subscribe();
    const validate = http.expectOne((r) =>
      r.url.endsWith('/api/internships/journal/entries/j1/validate'),
    );
    expect(validate.request.method).toBe('POST');
    validate.flush({});

    api.rejectJournalEntry('j2', 'missing days').subscribe();
    const reject = http.expectOne((r) =>
      r.url.endsWith('/api/internships/journal/entries/j2/reject'),
    );
    expect(reject.request.body).toEqual({ comment: 'missing days' });
    reject.flush({});
    http.verify();
  });

  it('reviews/downloads deliverables under /api/internships/deliverables', () => {
    api.validateDeliverable('d1').subscribe();
    http.expectOne((r) => r.url.endsWith('/api/internships/deliverables/d1/validate')).flush({});

    api.rejectDeliverable('d2', 'incomplete').subscribe();
    http.expectOne((r) => r.url.endsWith('/api/internships/deliverables/d2/reject')).flush({});

    api.downloadDeliverable('d3').subscribe();
    const download = http.expectOne((r) =>
      r.url.endsWith('/api/internships/deliverables/d3/download'),
    );
    expect(download.request.method).toBe('GET');
    download.flush(new Blob());
    http.verify();
  });

  it('queries the assistant through the secured backend endpoint', () => {
    api.queryAssistant('Combien de candidatures ?').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/ai/assistant/query'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ question: 'Combien de candidatures ?' });
    req.flush({ analysis: {}, recommendations: [], responseText: 'ok' });
    http.verify();
  });
});
