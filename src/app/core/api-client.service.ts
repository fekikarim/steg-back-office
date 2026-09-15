import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  Page,
  PageQuery,
  ApplicationRow,
  GroupCountDto,
  PaymentTotalRowDto,
  NotificationItem,
  FinanceCaseQueueItem,
  FinanceCaseStatus,
  ApplicationDetail,
  WorkflowTransitionRequest,
  WorkflowInstanceResponse,
  WorkflowActionResponse,
  ApplicationDocumentItem,
  DocumentVerificationBody,
  CandidateSummary,
  CandidateDetail,
  University,
  ManualApplicationFields,
  ManualApplicationResult,
} from './api-models';

/**
 * Centralized typed API client. All feature services go through here —
 * no ad-hoc fetch wrappers. Base URL + auth + error envelope centralized.
 * Report methods mirror `steg-backend/docs/openapi.json` (Phase A13 export).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiBaseUrl;

  private params(query: PageQuery): HttpParams {
    let p = new HttpParams()
      .set('page', query.page)
      .set('size', Math.min(query.size, environment.pageSizeMax));
    if (query.sort) p = p.set('sort', `${query.sort},${query.direction ?? 'asc'}`);
    if (query.search) p = p.set('search', query.search);
    if (query.status) p = p.set('status', query.status);
    if (query.from) p = p.set('from', query.from);
    if (query.to) p = p.set('to', query.to);
    return p;
  }

  /** Spring Data pageable params for endpoints with a required `pageable`. */
  private pageable(page: number, size: number, sort?: string): HttpParams {
    let p = new HttpParams().set('page', page).set('size', Math.min(size, environment.pageSizeMax));
    if (sort) p = p.set('sort', sort);
    return p;
  }

  getApplications(query: PageQuery): Observable<Page<ApplicationRow>> {
    return this.http
      .get<Page<ApplicationRow>>(`${this.baseUrl}/api/applications`, { params: this.params(query) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  // -- Phase A13 reporting endpoints (aggregate counts, not raw dumps) --

  getApplicationsByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/applications-by-status`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-status`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByType(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-type`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipsByDepartment(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/internships-by-department`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getFinanceCasesByStatus(): Observable<GroupCountDto[]> {
    return this.http
      .get<GroupCountDto[]>(`${this.baseUrl}/api/reports/finance-cases-by-status`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getPaymentTotals(departmentId?: string): Observable<PaymentTotalRowDto | PaymentTotalRowDto[]> {
    let params = new HttpParams();
    if (departmentId) params = params.set('departmentId', departmentId);
    return this.http
      .get<PaymentTotalRowDto | PaymentTotalRowDto[]>(
        `${this.baseUrl}/api/reports/payment-totals`,
        {
          params,
        },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  // -- Bounded queue reads (small pages only; never full dumps on the dashboard) --

  getFinanceCases(
    status: FinanceCaseStatus,
    page = 0,
    size = 5,
  ): Observable<FinanceCaseQueueItem[] | Page<FinanceCaseQueueItem>> {
    const params = this.pageable(page, size, 'openedAt,desc').set('status', status);
    return this.http
      .get<FinanceCaseQueueItem[] | Page<FinanceCaseQueueItem>>(
        `${this.baseUrl}/api/finance-cases`,
        {
          params,
        },
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  getNotifications(unreadOnly: boolean, page = 0, size = 8): Observable<Page<NotificationItem>> {
    const params = this.pageable(page, size, 'createdAt,desc').set('unreadOnly', unreadOnly);
    return this.http
      .get<Page<NotificationItem>>(`${this.baseUrl}/api/notifications`, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Secure download via backend endpoint only — never expose storage keys. */
  downloadUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /* -------- Phase C2 — candidate / application review workspace -------- */

  /** Staff application list (ADMIN/HR see all). Backend returns the full array. */
  listApplications(): Observable<ApplicationDetail[]> {
    return this.http
      .get<ApplicationDetail[]>(`${this.baseUrl}/api/applications`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplication(id: string): Observable<ApplicationDetail> {
    return this.http
      .get<ApplicationDetail>(`${this.baseUrl}/api/applications/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplicationDocuments(applicationId: string): Observable<ApplicationDocumentItem[]> {
    return this.http
      .get<ApplicationDocumentItem[]>(`${this.baseUrl}/api/applications/${applicationId}/documents`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  verifyApplicationDocument(
    applicationId: string,
    documentId: string,
    body: DocumentVerificationBody,
  ): Observable<ApplicationDocumentItem> {
    return this.http
      .put<ApplicationDocumentItem>(
        `${this.baseUrl}/api/applications/${applicationId}/documents/${documentId}/verify`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff workflow transitions (backend guard is authoritative):
   * review = VALIDATION/UNDER_REVIEW; accept/reject/correct = APPROVAL/FINAL_DECISION.
   */
  executeApplicationTransition(
    applicationId: string,
    body: WorkflowTransitionRequest,
  ): Observable<WorkflowActionResponse> {
    return this.http
      .post<WorkflowActionResponse>(
        `${this.baseUrl}/api/applications/${applicationId}/workflow/actions`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  getApplicationWorkflow(applicationId: string): Observable<WorkflowInstanceResponse> {
    return this.http
      .get<WorkflowInstanceResponse>(`${this.baseUrl}/api/applications/${applicationId}/workflow`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  listWorkflowActions(instanceId: string): Observable<WorkflowActionResponse[]> {
    return this.http
      .get<WorkflowActionResponse[]>(`${this.baseUrl}/api/workflows/${instanceId}/actions`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff candidate list. Backend never includes nationalId here
   * (CandidateSummaryResponse) — the type makes CIN leakage impossible.
   */
  listCandidates(): Observable<CandidateSummary[]> {
    return this.http
      .get<CandidateSummary[]>(`${this.baseUrl}/api/candidates`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getCandidate(id: string): Observable<CandidateDetail> {
    return this.http
      .get<CandidateDetail>(`${this.baseUrl}/api/candidates/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  listUniversities(): Observable<University[]> {
    return this.http
      .get<University[]>(`${this.baseUrl}/api/universities`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Manual intake for walk-in candidates: same InternshipApplication model as
   * online applications via POST /api/public/applications (multipart).
   * Source is read back from `submittedOnline` on the stored record.
   */
  submitManualApplication(
    fields: ManualApplicationFields,
    files: readonly File[],
  ): Observable<ManualApplicationResult> {
    const form = new FormData();
    form.append(
      'application',
      new Blob([JSON.stringify({ ...fields })], { type: 'application/json' }),
    );
    for (const file of files) form.append('documents', file, file.name);
    return this.http
      .post<ManualApplicationResult>(`${this.baseUrl}/api/public/applications`, form)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Authenticated binary download through backend endpoints (blob keeps the JWT header). */
  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    const segment = restricted ? 'download-restricted' : 'download';
    return this.http
      .get(`${this.baseUrl}/api/documents/${documentId}/${segment}`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }
}
