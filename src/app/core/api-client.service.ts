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
  FinanceCaseDetail,
  FinanceCaseDocument,
  PaymentDecisionBody,
  FinanceDocumentReviewBody,
  AiAnalysisResult,
  AiRecommendation,
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
  InternshipDetail,
  InternshipClassification,
  InternshipAssignment,
  InternshipAssignmentRequest,
  InternshipCreateFromApplicationRequest,
  InternshipCreateManualRequest,
  InternshipUpdateDatesRequest,
  Department,
  Employee,
  CertificateInfo,
  InternshipDocumentItem,
  AttachInternshipDocumentBody,
  DocumentType,
  DocumentFile,
  DepartmentRequest,
  EmployeeRequest,
  AuditLogEntry,
  AuditQuery,
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

  /* -------- Phase C3 — internship lifecycle & assignment -------- */

  /** Staff internship list (ADMIN/HR/SUPERVISOR). Backend returns the full array. */
  listInternships(): Observable<InternshipDetail[]> {
    return this.http
      .get<InternshipDetail[]>(`${this.baseUrl}/api/internships`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternship(id: string): Observable<InternshipDetail> {
    return this.http
      .get<InternshipDetail>(`${this.baseUrl}/api/internships/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Create from an ACCEPTED application (ADMIN/HR). Source data copied backend-side. */
  createInternshipFromApplication(
    body: InternshipCreateFromApplicationRequest,
  ): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/from-application`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Manual creation where the backend permits it (ADMIN/HR). */
  createManualInternship(body: InternshipCreateManualRequest): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/manual`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Date update triggers backend reclassification (ADMIN/HR). */
  updateInternshipDates(
    id: string,
    body: InternshipUpdateDatesRequest,
  ): Observable<InternshipDetail> {
    return this.http
      .put<InternshipDetail>(`${this.baseUrl}/api/internships/${id}/dates`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  cancelInternship(id: string): Observable<InternshipDetail> {
    return this.http
      .post<InternshipDetail>(`${this.baseUrl}/api/internships/${id}/cancel`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Assignment history (ADMIN/HR/SUPERVISOR). */
  listAssignments(internshipId: string): Observable<InternshipAssignment[]> {
    return this.http
      .get<InternshipAssignment[]>(`${this.baseUrl}/api/internships/${internshipId}/assignments`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Assign/reassign (ADMIN/HR). Backend atomically ends the current ACTIVE
   * assignment and activates the new one; the one-active rule is enforced
   * server-side (409 on concurrent reassignment).
   */
  assignInternship(
    internshipId: string,
    body: InternshipAssignmentRequest,
  ): Observable<InternshipAssignment> {
    return this.http
      .post<InternshipAssignment>(
        `${this.baseUrl}/api/internships/${internshipId}/assignments`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Read-only classification transparency view. */
  getClassification(internshipId: string): Observable<InternshipClassification> {
    return this.http
      .get<InternshipClassification>(
        `${this.baseUrl}/api/internships/${internshipId}/classification`,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Internship lifecycle transition (ADMIN/HR): PLANNED → ACTIVE → COMPLETED. */
  executeInternshipTransition(
    internshipId: string,
    body: WorkflowTransitionRequest,
  ): Observable<WorkflowActionResponse> {
    return this.http
      .post<WorkflowActionResponse>(
        `${this.baseUrl}/api/internships/${internshipId}/workflow/actions`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  getInternshipWorkflow(internshipId: string): Observable<WorkflowInstanceResponse> {
    return this.http
      .get<WorkflowInstanceResponse>(`${this.baseUrl}/api/internships/${internshipId}/workflow`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Certificate generation entry point (ADMIN/HR/active supervisor).
   * Backend enforces COMPLETED + supervisor eligibility; no request body —
   * the generation date is captured server-side.
   */
  generateCertificate(internshipId: string): Observable<CertificateInfo> {
    return this.http
      .post<CertificateInfo>(`${this.baseUrl}/api/internships/${internshipId}/certificates`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  downloadCertificate(certificateId: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/certificates/${certificateId}`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Departments/employees (ADMIN/HR) — reference data for the assign dialog. */
  listDepartments(): Observable<Department[]> {
    return this.http
      .get<Department[]>(`${this.baseUrl}/api/departments`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  listEmployees(): Observable<Employee[]> {
    return this.http
      .get<Employee[]>(`${this.baseUrl}/api/employees`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C4 — internship document workspace -------- */

  /** Documents attached to an internship (ADMIN/HR/CANDIDATE/SUPERVISOR). */
  listInternshipDocuments(internshipId: string): Observable<InternshipDocumentItem[]> {
    return this.http
      .get<InternshipDocumentItem[]>(`${this.baseUrl}/api/internships/${internshipId}/documents`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Staff upload (any authenticated user; backend validates MIME/size/content
   * and returns metadata including restrictedAccess). Raw bytes never touch
   * application state beyond the upload call.
   */
  uploadDocument(type: DocumentType, file: File): Observable<DocumentFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http
      .post<DocumentFile>(`${this.baseUrl}/api/documents`, form, {
        params: new HttpParams().set('type', type),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Attach an uploaded document to an internship (ADMIN/HR). */
  attachInternshipDocument(
    internshipId: string,
    body: AttachInternshipDocumentBody,
  ): Observable<InternshipDocumentItem> {
    return this.http
      .post<InternshipDocumentItem>(
        `${this.baseUrl}/api/internships/${internshipId}/documents`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Document metadata without content (for preview decisions). */
  getDocumentMetadata(documentId: string): Observable<DocumentFile> {
    return this.http
      .get<DocumentFile>(`${this.baseUrl}/api/documents/${documentId}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C5 — finance & payment workspace -------- */

  /**
   * Server-paginated finance queue (FINANCE/ADMIN). Status is the only
   * backend-supported filter; period/department/eligibility refine the
   * loaded page client-side (see finance queue component).
   */
  listFinanceCases(
    status: FinanceCaseStatus | '',
    page: number,
    size: number,
    sort = 'openedAt,desc',
  ): Observable<Page<FinanceCaseQueueItem>> {
    let params = this.pageable(page, size, sort);
    if (status) params = params.set('status', status);
    return this.http
      .get<Page<FinanceCaseQueueItem>>(`${this.baseUrl}/api/finance-cases`, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Full case with calculation, dossier and approval history (FINANCE/ADMIN). */
  getFinanceCase(id: string): Observable<FinanceCaseDetail> {
    return this.http
      .get<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Recompute the payment snapshot pre-decision (FINANCE/ADMIN, audited). */
  recalculateCase(id: string): Observable<FinanceCaseDetail> {
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/recalculate`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Approve payment + issue receipt (FINANCE role only, comment optional). */
  approveCase(id: string, comment?: string): Observable<FinanceCaseDetail> {
    const body: PaymentDecisionBody = comment?.trim() ? { comment: comment.trim() } : {};
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/approve`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Reject payment (FINANCE role only, reason mandatory backend-side). */
  rejectCase(id: string, reason: string): Observable<FinanceCaseDetail> {
    return this.http
      .post<FinanceCaseDetail>(`${this.baseUrl}/api/finance-cases/${id}/reject`, {
        comment: reason.trim(),
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Receipt PDF download (backend checks FINANCE/ADMIN/HR-or-supervisor). */
  downloadReceipt(caseId: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}/api/finance-cases/${caseId}/receipt`, { responseType: 'blob' })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Review one dossier document (FINANCE/ADMIN). */
  reviewFinanceDocument(
    caseId: string,
    documentId: string,
    body: FinanceDocumentReviewBody,
  ): Observable<FinanceCaseDocument> {
    return this.http
      .patch<FinanceCaseDocument>(
        `${this.baseUrl}/api/finance-cases/${caseId}/documents/${documentId}`,
        body,
      )
      .pipe(catchError((e) => throwError(() => e)));
  }

  /**
   * Advisory AI analysis of the dossier (ADMIN/FINANCE). CIN content is
   * excluded backend-side; the result only ever proposes recommendations.
   */
  analyzeFinanceCase(caseId: string): Observable<AiAnalysisResult> {
    return this.http
      .post<AiAnalysisResult>(`${this.baseUrl}/api/ai/finance-cases/${caseId}/analyze`, {})
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Human traceability review of one AI recommendation (no state change). */
  reviewAiRecommendation(
    recommendationId: string,
    status: 'ACCEPTED_BY_HUMAN' | 'DISMISSED',
  ): Observable<AiRecommendation> {
    return this.http
      .post<AiRecommendation>(`${this.baseUrl}/api/ai/recommendations/${recommendationId}/review`, {
        status,
      })
      .pipe(catchError((e) => throwError(() => e)));
  }

  /* -------- Phase C6 — administration workspace -------- */

  /** Departments (mutations: ADMIN only, enforced backend-side). */
  createDepartment(body: DepartmentRequest): Observable<Department> {
    return this.http
      .post<Department>(`${this.baseUrl}/api/departments`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  updateDepartment(id: string, body: DepartmentRequest): Observable<Department> {
    return this.http
      .put<Department>(`${this.baseUrl}/api/departments/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft-deactivate (backend never hard-deletes). */
  deactivateDepartment(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/departments/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Employees (create/update: ADMIN/HR; deactivate: ADMIN only). */
  createEmployee(body: EmployeeRequest): Observable<Employee> {
    return this.http
      .post<Employee>(`${this.baseUrl}/api/employees`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  updateEmployee(id: string, body: EmployeeRequest): Observable<Employee> {
    return this.http
      .put<Employee>(`${this.baseUrl}/api/employees/${id}`, body)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Soft-deactivate (backend never hard-deletes). */
  deactivateEmployee(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/api/employees/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }

  /** Audit trail (ADMIN only, read-only, server-paginated). */
  searchAudit(query: AuditQuery): Observable<Page<AuditLogEntry>> {
    let params = this.pageable(query.page, query.size, 'createdAt,desc');
    if (query.action?.trim()) params = params.set('action', query.action.trim());
    if (query.entityId?.trim()) params = params.set('entityId', query.entityId.trim());
    if (query.actorId?.trim()) params = params.set('actorId', query.actorId.trim());
    return this.http
      .get<Page<AuditLogEntry>>(`${this.baseUrl}/api/audit`, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }

  getAuditEntry(id: string): Observable<AuditLogEntry> {
    return this.http
      .get<AuditLogEntry>(`${this.baseUrl}/api/audit/${id}`)
      .pipe(catchError((e) => throwError(() => e)));
  }
}
