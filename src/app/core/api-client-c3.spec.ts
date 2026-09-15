import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

describe('ApiClient — C3 internship lifecycle', () => {
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

  it('lists/gets internships and classification from documented endpoints', () => {
    client.listInternships().subscribe();
    http.expectOne(`${base}/api/internships`).flush([]);

    client.getInternship('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1`).flush({ id: 'i1' });

    client.getClassification('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1/classification`).flush({ internshipId: 'i1' });
  });

  it('creates from application / manual with exact bodies', () => {
    client.createInternshipFromApplication({ applicationId: 'a1' }).subscribe();
    const fromApp = http.expectOne(`${base}/api/internships/from-application`);
    expect(fromApp.request.method).toBe('POST');
    expect(fromApp.request.body).toEqual({ applicationId: 'a1' });
    fromApp.flush({});

    client
      .createManualInternship({
        candidateId: 'c1',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        subject: 'Grid',
      })
      .subscribe();
    const manual = http.expectOne(`${base}/api/internships/manual`);
    expect(manual.request.body).toEqual({
      candidateId: 'c1',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      subject: 'Grid',
    });
    manual.flush({});
  });

  it('updates dates, cancels and transitions with exact bodies', () => {
    client
      .updateInternshipDates('i1', { startDate: '2026-07-01', endDate: '2026-08-31' })
      .subscribe();
    const dates = http.expectOne(`${base}/api/internships/i1/dates`);
    expect(dates.request.method).toBe('PUT');
    expect(dates.request.body).toEqual({ startDate: '2026-07-01', endDate: '2026-08-31' });
    dates.flush({});

    client.cancelInternship('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1/cancel`).flush({});

    client
      .executeInternshipTransition('i1', { actionType: 'COMPLETION', targetStepCode: 'COMPLETED' })
      .subscribe();
    const transition = http.expectOne(`${base}/api/internships/i1/workflow/actions`);
    expect(transition.request.method).toBe('POST');
    expect(transition.request.body).toEqual({
      actionType: 'COMPLETION',
      targetStepCode: 'COMPLETED',
    });
    transition.flush({});

    client.getInternshipWorkflow('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1/workflow`).flush({});
  });

  it('assigns with exact body and lists history', () => {
    client
      .assignInternship('i1', {
        departmentId: 'd1',
        supervisorId: 's1',
        assignmentReason: 'Rotation',
      })
      .subscribe();
    const assign = http.expectOne(`${base}/api/internships/i1/assignments`);
    expect(assign.request.method).toBe('POST');
    expect(assign.request.body).toEqual({
      departmentId: 'd1',
      supervisorId: 's1',
      assignmentReason: 'Rotation',
    });
    assign.flush({});

    client.listAssignments('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1/assignments`).flush([]);
  });

  it('generates/downloads certificates and loads reference data', () => {
    client.generateCertificate('i1').subscribe();
    const gen = http.expectOne(`${base}/api/internships/i1/certificates`);
    expect(gen.request.method).toBe('POST');
    gen.flush({ id: 'cert-1' });

    client.downloadCertificate('cert-1').subscribe();
    http.expectOne(`${base}/api/certificates/cert-1`).flush(new Blob());

    client.listDepartments().subscribe();
    http.expectOne(`${base}/api/departments`).flush([]);

    client.listEmployees().subscribe();
    http.expectOne(`${base}/api/employees`).flush([]);
  });
});
