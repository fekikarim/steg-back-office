import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

describe('ApiClient — C4 document workspace', () => {
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

  it('lists internship documents from the documented endpoint', () => {
    client.listInternshipDocuments('i1').subscribe();
    http.expectOne(`${base}/api/internships/i1/documents`).flush([]);
  });

  it('uploads with the type query param and multipart file part', () => {
    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });
    client.uploadDocument('STEG_INTERNSHIP_REPORT', file).subscribe();
    const req = http.expectOne((r) => r.method === 'POST' && r.url === `${base}/api/documents`);
    expect(req.request.params.get('type')).toBe('STEG_INTERNSHIP_REPORT');
    const body = req.request.body as FormData;
    expect(body.get('file')).toBeTruthy();
    req.flush({ id: 'doc-9' });
  });

  it('attaches with the exact body', () => {
    client.attachInternshipDocument('i1', { documentId: 'doc-9', mandatory: true }).subscribe();
    const req = http.expectOne(`${base}/api/internships/i1/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ documentId: 'doc-9', mandatory: true });
    req.flush({ id: 'ad-9' });
  });

  it('fetches metadata without content', () => {
    client.getDocumentMetadata('doc-9').subscribe();
    http.expectOne(`${base}/api/documents/doc-9`).flush({ id: 'doc-9' });
  });
});
