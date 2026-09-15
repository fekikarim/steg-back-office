import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

describe('ApiClient — C2 review workspace', () => {
  let client: ApiClient;
  let http: HttpTestingController;
  const base = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists applications and candidates (candidates carry no nationalId field)', () => {
    client.listApplications().subscribe();
    http.expectOne(`${base}/api/applications`).flush([]);

    client.listCandidates().subscribe((rows) => {
      for (const row of rows) {
        expect('nationalId' in row).toBe(false);
      }
    });
    http
      .expectOne(`${base}/api/candidates`)
      .flush([{ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.c', universityName: 'ENIT' }]);
  });

  it('fetches dossier pieces from the documented endpoints', () => {
    client.getApplication('app-1').subscribe();
    http.expectOne(`${base}/api/applications/app-1`).flush({ id: 'app-1' });

    client.getApplicationDocuments('app-1').subscribe();
    http.expectOne(`${base}/api/applications/app-1/documents`).flush([]);

    client.getApplicationWorkflow('app-1').subscribe();
    http.expectOne(`${base}/api/applications/app-1/workflow`).flush({ id: 'wf-1' });

    client.listWorkflowActions('wf-1').subscribe();
    http.expectOne(`${base}/api/workflows/wf-1/actions`).flush([]);
  });

  it('posts workflow transitions and document verifications with exact bodies', () => {
    client
      .executeApplicationTransition('app-1', {
        actionType: 'VALIDATION',
        targetStepCode: 'UNDER_REVIEW',
      })
      .subscribe();
    const review = http.expectOne(`${base}/api/applications/app-1/workflow/actions`);
    expect(review.request.method).toBe('POST');
    expect(review.request.body).toEqual({
      actionType: 'VALIDATION',
      targetStepCode: 'UNDER_REVIEW',
    });
    review.flush({});

    client
      .executeApplicationTransition('app-1', {
        actionType: 'APPROVAL',
        targetStepCode: 'FINAL_DECISION',
        decision: 'REJECTED',
        comment: 'Missing transcripts, please resubmit.',
      })
      .subscribe();
    const reject = http.expectOne(`${base}/api/applications/app-1/workflow/actions`);
    expect(reject.request.body).toEqual({
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'REJECTED',
      comment: 'Missing transcripts, please resubmit.',
    });
    reject.flush({});

    client
      .verifyApplicationDocument('app-1', 'doc-1', {
        status: 'REQUIRES_CORRECTION',
        comment: 'Blurry scan',
      })
      .subscribe();
    const verify = http.expectOne(`${base}/api/applications/app-1/documents/doc-1/verify`);
    expect(verify.request.method).toBe('PUT');
    expect(verify.request.body).toEqual({ status: 'REQUIRES_CORRECTION', comment: 'Blurry scan' });
    verify.flush({});
  });

  it('submits manual intake as multipart with an application JSON part', () => {
    const file = new File(['%PDF'], 'convention.pdf', { type: 'application/pdf' });
    client
      .submitManualApplication(
        {
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.c',
          phone: '',
          birthDate: '',
          nationalId: '12345678',
          universityId: 'u1',
          speciality: '',
          diploma: '',
          desiredStartDate: '2026-07-01',
          desiredEndDate: '2026-08-31',
        },
        [file],
      )
      .subscribe();
    const req = http.expectOne(`${base}/api/public/applications`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('application')).toBeTruthy();
    expect(body.getAll('documents').length).toBe(1);
    req.flush({ reference: 'APP-2026-1', status: 'SUBMITTED', trackingToken: 'tok' });
  });

  it('downloads binaries through the guarded endpoints (restricted vs standard)', () => {
    client.downloadDocument('d1', false).subscribe();
    const plain = http.expectOne(`${base}/api/documents/d1/download`);
    expect(plain.request.method).toBe('GET');
    plain.flush(new Blob());

    client.downloadDocument('d2', true).subscribe();
    http.expectOne(`${base}/api/documents/d2/download-restricted`).flush(new Blob());
  });
});
