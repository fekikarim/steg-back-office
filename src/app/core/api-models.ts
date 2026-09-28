/**
 * Typed API contracts maintained from `steg-backend/docs/openapi.json`
 * (Phase A13 export, 103 paths). This file is the Back Office's typed view
 * of that contract — regenerate/align when the frozen contract changes.
 * Backend is authoritative for business rules; these are transport types only.
 */

export interface ApiErrorEnvelope {
  readonly timestamp?: string;
  readonly status?: number;
  readonly error?: string;
  readonly message?: string;
  readonly path?: string;
  readonly traceId?: string;
  readonly fieldErrors?: readonly { readonly field: string; readonly message: string }[];
}

export interface Page<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly number: number;
  readonly size: number;
}

/**
 * Normalizes a paginated backend response into the app's flat `Page<T>`.
 *
 * Spring Boot 4 returns the instance-model format
 * `{ content, page: { number, size, totalElements, totalPages } }` while
 * older endpoints/mocks still return the flat format (and some list
 * endpoints return a bare array). Accepting all three here keeps every
 * paginated view (finance, audit, notifications, companion lists, …)
 * rendering correct counts instead of `NaN`.
 */
export function asPage<T>(
  payload: Page<T> | { readonly page?: unknown; readonly content: readonly T[] } | readonly T[],
): Page<T> {
  if (Array.isArray(payload)) {
    const rows = payload as readonly T[];
    return {
      content: rows,
      totalElements: rows.length,
      totalPages: 1,
      number: 0,
      size: rows.length,
    };
  }
  const body = payload as { readonly content: readonly T[]; readonly page?: unknown };
  const meta = body.page as
    | {
        readonly number?: number;
        readonly size?: number;
        readonly totalElements?: number;
        readonly totalPages?: number;
      }
    | undefined;
  if (meta && typeof meta === 'object') {
    const content = body.content;
    return {
      content,
      number: meta.number ?? 0,
      size: meta.size ?? content.length,
      totalElements: meta.totalElements ?? content.length,
      totalPages:
        meta.totalPages ??
        (meta.size
          ? Math.max(1, Math.ceil((meta.totalElements ?? content.length) / meta.size))
          : 1),
    };
  }
  const flat = body as unknown as Partial<Page<T>>;
  const content = body.content;
  return {
    content,
    number: flat.number ?? 0,
    size: flat.size ?? content.length,
    totalElements: flat.totalElements ?? content.length,
    totalPages: flat.totalPages ?? 1,
  };
}

export interface PageQuery {
  readonly page: number;
  readonly size: number;
  readonly sort?: string;
  readonly direction?: 'asc' | 'desc';
  readonly search?: string;
  readonly status?: string;
  readonly from?: string;
  readonly to?: string;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';
export type InternshipStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type InternshipType = 'OBSERVATION' | 'PERFECTIONNEMENT' | 'PFE';
export type FinanceCaseStatus =
  | 'OPENED'
  | 'UNDER_REVIEW'
  | 'DOCUMENTS_MISSING'
  | 'READY_FOR_DECISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export interface ApplicationRow {
  readonly id: string;
  readonly reference: string;
  readonly candidateName: string;
  readonly university: string;
  readonly status: ApplicationStatus;
  readonly internshipType: InternshipType | null;
  readonly mandatory: boolean | null;
  readonly submittedAt: string | null;
  readonly updatedAt: string;
}

export interface KpiSummary {
  readonly pendingApplications: number;
  readonly activeInternships: number;
  readonly financeToReview: number;
  readonly documentsMissing: number;
}

/**
 * Backend reporting DTOs (Phase A13 `/api/reports/*`).
 * Every dashboard metric is derived from these — never from partial client lists.
 */
export interface GroupCountDto {
  readonly groupName: string;
  readonly count: number;
}

export interface PaymentTotalRowDto {
  readonly year: number;
  readonly month: number;
  readonly departmentCode: string;
  readonly totalAmount: number;
  readonly receiptCount: number;
}

/** Minimal notification projection for the dashboard activity feed. */
export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  readonly relatedEntityType: string;
  readonly relatedEntityId: string;
  readonly createdAt: string;
  readonly read: boolean;
  readonly readAt: string | null;
}

/** Minimal finance-case projection for the finance work queue. */
export interface FinanceCaseQueueItem {
  readonly id: string;
  readonly reference: string;
  readonly status: FinanceCaseStatus;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly receiptReference: string | null;
}

/** Sum counts for the given group names (e.g. pending = SUBMITTED + UNDER_REVIEW). */
export function sumGroups(groups: readonly GroupCountDto[], names: readonly string[]): number {
  const wanted = new Set(names);
  return groups.filter((g) => wanted.has(g.groupName)).reduce((acc, g) => acc + (g.count ?? 0), 0);
}

/** Exact count for one group name, 0 when the backend omits the group. */
export function countOf(groups: readonly GroupCountDto[], name: string): number {
  return groups.find((g) => g.groupName === name)?.count ?? 0;
}

/** Total of all groups (denominator for distribution bars). */
export function totalOf(groups: readonly GroupCountDto[]): number {
  return groups.reduce((acc, g) => acc + (g.count ?? 0), 0);
}

/** Normalize payment-totals payload (backend may return one row or an array). */
export function normalizePaymentTotals(
  payload: PaymentTotalRowDto | readonly PaymentTotalRowDto[] | null,
): readonly PaymentTotalRowDto[] {
  if (isPaymentRowArray(payload)) return payload;
  if (payload === null) return [];
  return [payload];
}

function isPaymentRowArray(value: unknown): value is readonly PaymentTotalRowDto[] {
  return Array.isArray(value);
}

/* ------------------------------------------------------------------ */
/* Phase C2 — candidate / application review workspace contracts.      */
/* Mirrors steg-backend/docs/openapi.json. Backend is authoritative;  */
/* these are transport types only, no business rules live here.       */
/* ------------------------------------------------------------------ */

/** Full application record (GET /api/applications, GET /api/applications/{id}). */
export interface ApplicationDetail {
  readonly id: string;
  readonly reference: string;
  readonly status: ApplicationStatus;
  readonly candidateId: string;
  readonly candidateName: string;
  readonly desiredStartDate: string;
  readonly desiredEndDate: string;
  readonly proposedTheme: string | null;
  readonly submittedOnline: boolean;
  readonly submissionDate: string | null;
  /** Backend-calculated internship type — read-only, never set by the client. */
  readonly calculatedType: InternshipType | null;
  /** Backend-calculated requirement — read-only, never set by the client. */
  readonly requirement: 'OBLIGATOIRE' | 'OPTIONAL' | null;
  readonly rejectionReason: string | null;
  readonly correctionComment: string | null;
  readonly reviewerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export type WorkflowActionType =
  | 'APPROVAL'
  | 'VALIDATION'
  | 'SUBMISSION'
  | 'REJECTION'
  | 'CORRECTION_REQUEST'
  | 'CANCELLATION'
  | 'COMPLETION';
export type WorkflowDecision =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'NEEDS_CORRECTION';

/** POST /api/applications/{id}/workflow/actions body. */
export interface WorkflowTransitionRequest {
  readonly targetStepCode?: string;
  readonly actionType: WorkflowActionType;
  readonly decision?: WorkflowDecision;
  readonly comment?: string;
}

export interface WorkflowInstanceResponse {
  readonly id: string;
  readonly definitionCode: string;
  readonly definitionName: string;
  readonly currentStepCode: string;
  readonly currentStepName: string;
  readonly status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface WorkflowActionResponse {
  readonly id: string;
  readonly instanceId: string;
  readonly stepCode: string;
  readonly stepName: string;
  readonly performedById: string;
  readonly performedByUsername: string;
  readonly type: WorkflowActionType;
  readonly decision: WorkflowDecision;
  readonly comment: string | null;
  readonly sequenceNumber: number;
  readonly performedAt: string;
}

export type DocumentType =
  | 'CV'
  | 'MOTIVATION_LETTER'
  | 'UNIVERSITY_CONVENTION'
  | 'TRANSCRIPT'
  | 'INTERNSHIP_APPLICATION'
  | 'ASSIGNMENT_LETTER'
  | 'INTERNSHIP_CONVENTION'
  | 'STEG_INTERNSHIP_REPORT'
  | 'CAHIER_DES_CHARGES'
  | 'PROJECT_DEMO_IMAGE'
  | 'INTERNSHIP_CERTIFICATE'
  | 'INTERNSHIP_LOGBOOK'
  | 'CIN_COPY'
  | 'PAYMENT_RECEIPT'
  | 'OTHER';
export type DocumentVerificationStatus =
  'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_CORRECTION';

export interface DocumentFile {
  readonly id: string;
  readonly reference: string;
  readonly type: DocumentType;
  readonly restrictedAccess: boolean;
  readonly generatedAutomatically: boolean;
  readonly latestVersionNumber: number;
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly uploadedAt: string;
  readonly createdAt: string;
}

export interface ApplicationDocumentItem {
  readonly id: string;
  readonly applicationId: string;
  readonly document: DocumentFile;
  readonly mandatory: boolean;
  readonly verificationStatus: DocumentVerificationStatus;
  readonly verificationComment: string | null;
  readonly verifiedById: string | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}

export interface DocumentVerificationBody {
  readonly status: DocumentVerificationStatus;
  readonly comment?: string;
}

/**
 * Candidate list projection. nationalId is NEVER present here by backend
 * contract — the type omits it so lists cannot leak CIN even by accident.
 */
export interface CandidateSummary {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly birthDate: string | null;
  readonly speciality: string | null;
  readonly diploma: string | null;
  readonly universityId: string;
  readonly universityName: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** Full candidate profile (staff view). nationalId is sensitive — mask in UI. */
export interface CandidateDetail extends CandidateSummary {
  readonly address: string | null;
  readonly skills: string | null;
  readonly languages: string | null;
  readonly nationalId: string | null;
}

export interface University {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

/**
 * Manual intake payload (POST /api/public/applications, multipart).
 * Produces the identical InternshipApplication model as online applications;
 * source is read back from `submittedOnline` on the response/detail.
 */
export interface ManualApplicationFields {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly nationalId: string;
  readonly universityId: string;
  readonly speciality: string;
  readonly diploma: string;
  readonly desiredStartDate: string;
  readonly desiredEndDate: string;
}

export interface ManualApplicationResult {
  readonly reference: string;
  readonly status: string;
  readonly trackingToken: string;
}

/* ------------------------------------------------------------------ */
/* Phase C3 — internship lifecycle & assignment contracts.             */
/* Mirrors steg-backend/docs/openapi.json. All classification,         */
/* eligibility and transition rules live backend-side; these are       */
/* transport types only.                                               */
/* ------------------------------------------------------------------ */

export type InternshipRequirement = 'OBLIGATOIRE' | 'OPTIONAL';

/** GET /api/internships, GET /api/internships/{id}. */
export interface InternshipDetail {
  readonly id: string;
  readonly reference: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: InternshipStatus;
  /** Backend-computed — read-only, never set by the client. */
  readonly type: InternshipType;
  /** Backend-computed — read-only, never set by the client. */
  readonly requirement: InternshipRequirement;
  /** Backend-computed payment eligibility flag — read-only. */
  readonly paymentEligible: boolean;
  readonly subject: string;
  readonly academicLevel: string;
  readonly candidateId: string;
  readonly candidateFullName: string;
  readonly applicationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** GET /api/internships/{id}/classification — read-only transparency view. */
export interface InternshipClassification {
  readonly internshipId: string;
  readonly reference: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly type: InternshipType;
  readonly requirement: InternshipRequirement;
  readonly paymentEligible: boolean;
  readonly durationInDays: number;
  readonly appliedRuleDescription: string;
}

export type AssignmentStatus = 'PLANNED' | 'ACTIVE' | 'ENDED' | 'REASSIGNED' | 'CANCELLED';

/** GET/POST /api/internships/{id}/assignments. */
export interface InternshipAssignment {
  readonly id: string;
  readonly internshipId: string;
  readonly departmentId: string;
  readonly departmentName: string;
  readonly supervisorId: string;
  readonly supervisorName: string;
  readonly assignedById: string;
  readonly assignedByName: string;
  readonly assignedAt: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly status: AssignmentStatus;
  readonly assignmentReason: string | null;
  readonly endedAt: string | null;
  readonly createdAt: string;
  readonly version: number;
}

export interface InternshipAssignmentRequest {
  readonly departmentId: string;
  readonly supervisorId: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly assignmentReason?: string;
}

/** POST /api/internships/from-application. */
export interface InternshipCreateFromApplicationRequest {
  readonly applicationId: string;
  /**
   * Explicit flag for observation internships (true = OBLIGATOIRE).
   * Null/absent conservatively defaults to OPTIONAL backend-side.
   */
  readonly observationObligatoire?: boolean | null;
}

/** POST /api/internships/manual. */
export interface InternshipCreateManualRequest {
  readonly candidateId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly subject: string;
  readonly academicLevel?: string;
  readonly observationObligatoire?: boolean | null;
}

/** PUT /api/internships/{id}/dates — backend recomputes classification. */
export interface InternshipUpdateDatesRequest {
  readonly startDate: string;
  readonly endDate: string;
  readonly observationObligatoire?: boolean | null;
}

export interface Department {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly parentDepartmentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface Employee {
  readonly id: string;
  readonly employeeNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string | null;
  readonly position: string | null;
  readonly hireDate: string | null;
  readonly active: boolean;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  readonly userId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** POST /api/internships/{id}/certificates response (metadata; PDF via download). */
export interface CertificateInfo {
  readonly id: string;
  readonly reference: string;
  readonly status: 'GENERATED' | 'ISSUED' | 'REVOKED';
  readonly templateCode: string;
  readonly templateVersion: number;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly generatedAt: string;
  readonly issueDate: string;
}

/* ------------------------------------------------------------------ */
/* Phase C4 — internship document workspace contracts.                 */
/* Mirrors steg-backend/docs/openapi.json. Verification support varies */
/* per context (application docs: yes; internship docs: read-only);    */
/* the client never invents verification semantics.                    */
/* ------------------------------------------------------------------ */

/** GET /api/internships/{id}/documents item. No verification fields by contract. */
export interface InternshipDocumentItem {
  readonly id: string;
  readonly internshipId: string;
  readonly document: DocumentFile;
  readonly mandatory: boolean;
  readonly generatedAutomatically: boolean;
  readonly createdAt: string;
}

/** POST /api/internships/{id}/documents body. */
export interface AttachInternshipDocumentBody {
  readonly documentId: string;
  readonly mandatory?: boolean;
}

/** Document types staff may upload into an internship dossier. */
export const INTERNSHIP_UPLOAD_TYPES: readonly DocumentType[] = [
  'INTERNSHIP_APPLICATION',
  'ASSIGNMENT_LETTER',
  'STEG_INTERNSHIP_REPORT',
  'CAHIER_DES_CHARGES',
  'PROJECT_DEMO_IMAGE',
  'INTERNSHIP_CONVENTION',
  'CIN_COPY',
  'OTHER',
];

/** Dossier completeness expectations (presence only — finance decides). */
export const REQUIRED_DOSSIER_TYPES: readonly DocumentType[] = [
  'INTERNSHIP_APPLICATION',
  'ASSIGNMENT_LETTER',
  'STEG_INTERNSHIP_REPORT',
];

/* ------------------------------------------------------------------ */
/* Phase C5 — finance & payment workspace contracts.                   */
/* Mirrors Phase A11 endpoints. Calculation fields are rendered        */
/* verbatim; no payment formula lives in the client.                   */
/* ------------------------------------------------------------------ */

/** GET /api/finance-cases/{id} — full case with calculation + history. */
export interface FinanceCaseDetail {
  readonly id: string;
  readonly reference: string;
  readonly status: FinanceCaseStatus;
  readonly internshipId: string;
  readonly internshipReference: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly workflowInstanceId: string;
  readonly calculation: PaymentCalculation | null;
  readonly documents: readonly FinanceCaseDocument[];
  readonly approvals: readonly PaymentApproval[];
  readonly receiptReference: string | null;
}

/** Backend payment snapshot — displayed verbatim, never recomputed. */
export interface PaymentCalculation {
  readonly completedMonths: number;
  readonly payableMonths: number;
  readonly ratePerMonth: number;
  readonly calculatedAmount: number;
  readonly cappedAmount: number;
  readonly capApplied: boolean;
  readonly currencyCode: string;
  readonly calculatedAt: string;
}

export interface PaymentApproval {
  readonly id: string;
  readonly decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  readonly comment: string | null;
  readonly decisionSequence: number;
  readonly decidedAt: string;
  readonly decidedByName: string;
}

export interface FinanceCaseDocument {
  readonly documentId: string;
  readonly documentReference: string;
  readonly documentType: DocumentType;
  readonly mandatory: boolean;
  readonly verificationStatus: DocumentVerificationStatus;
  readonly verificationComment: string | null;
  readonly reviewedAt: string | null;
  readonly reviewedByName: string | null;
}

export interface PaymentDecisionBody {
  readonly comment?: string;
}

export interface FinanceDocumentReviewBody {
  readonly status: DocumentVerificationStatus;
  readonly comment?: string;
}

/** Advisory AI result — recommendations are read-only proposals for humans. */
export interface AiAnalysisResult {
  readonly analysis: AiAnalysis;
  readonly recommendations: readonly AiRecommendation[];
  readonly responseText: string;
}

export interface AiAnalysis {
  readonly id: string;
  readonly type: string;
  readonly relatedEntityType: string;
  readonly relatedEntityId: string;
  readonly modelUsed: string;
  readonly inputSummary: string;
  readonly outputSummary: string;
  readonly cinExcluded: boolean;
  readonly createdAt: string;
}

export interface AiRecommendation {
  readonly id: string;
  readonly analysisId: string;
  readonly recommendationText: string;
  readonly status: 'PROPOSED' | 'ACCEPTED_BY_HUMAN' | 'DISMISSED';
  readonly reviewedById: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Phase C6 — administration workspace contracts.                      */
/* Department/employee/audit mirror the backend; user-account           */
/* provisioning has no backend endpoint (marked pending in UI).        */
/* ------------------------------------------------------------------ */

export interface DepartmentRequest {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly parentDepartmentId?: string | null;
}

export interface EmployeeRequest {
  readonly employeeNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber?: string;
  readonly position?: string;
  readonly hireDate?: string;
  readonly departmentId: string;
  readonly userId?: string | null;
}

/** GET /api/audit item. old/new values are opaque backend-redacted JSON. */
export interface AuditLogEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly oldValues: string | null;
  readonly newValues: string | null;
  readonly actorId: string;
  readonly actorEmail: string;
  readonly ipAddress: string;
}

export interface AuditQuery {
  readonly action?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly page: number;
  readonly size: number;
}

/** Backend error → user-safe message mapping (no stack traces, no secrets). */
export function toUserMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const envelope = (error as { error?: ApiErrorEnvelope }).error ?? (error as ApiErrorEnvelope);
    if (envelope?.message) return envelope.message;
    if (typeof envelope?.error === 'string') return envelope.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected error';
}

/* ------------------------------------------------------------------ */
/* Supervision workspace contracts (companion + evaluation).           */
/* Mirrors steg-backend CompanionController/EvaluationController DTOs. */
/* All progress/validation rules live backend-side; these are         */
/* transport types only.                                               */
/* ------------------------------------------------------------------ */

/** Task attached to an internship (Flutter + back office share the model). */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CompanionTask {
  readonly id: string;
  readonly internshipId: string;
  readonly createdById: string | null;
  readonly createdByEmail: string | null;
  readonly assignedToId: string | null;
  readonly assignedToEmail: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TaskRequest {
  readonly title: string;
  readonly description?: string;
  readonly assignedToId?: string | null;
  readonly dueDate?: string | null;
  readonly status?: TaskStatus;
}

/** Daily journal entry submitted from the Flutter mobile app. */
export type JournalEntryStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';

export interface JournalEntry {
  readonly id: string;
  readonly journalId: string | null;
  readonly authorId: string | null;
  readonly authorEmail: string | null;
  readonly validatedById: string | null;
  readonly validatedByName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: JournalEntryStatus;
  readonly entryDate: string;
  readonly submittedAt: string | null;
  readonly validatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JournalValidationBody {
  readonly comment?: string;
}

/** Internship report deliverable with append-only versions. */
export type DeliverableStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';

export interface DeliverableItem {
  readonly id: string;
  readonly internshipId: string;
  readonly validatedById: string | null;
  readonly validatedByName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: DeliverableStatus;
  readonly currentVersion: number;
  readonly submittedAt: string | null;
  readonly validatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Supervisor/intern evaluation (totalScore computed backend-side). */
export type EvaluationType = 'DAILY' | 'WEEKLY' | 'MID_TERM' | 'FINAL' | 'CUSTOM';

export interface EvaluationItem {
  readonly id: string;
  readonly internshipId: string;
  readonly evaluatorId: string | null;
  readonly evaluatorEmail: string | null;
  readonly templateId: string | null;
  readonly templateName: string | null;
  readonly type: EvaluationType;
  readonly evaluationDate: string;
  readonly feedback: string | null;
  readonly totalScore: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvaluationCreateBody {
  readonly templateId?: string | null;
  readonly type: EvaluationType;
  readonly evaluationDate: string;
  readonly feedback?: string;
}

export interface EvaluationScoreItem {
  readonly id: string;
  readonly evaluationId: string;
  readonly criterionId: string | null;
  readonly criterionName: string | null;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly weight: number | null;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvaluationCriterionItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxScore: number;
  readonly weight: number;
}

export interface EvaluationTemplateItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly criteria: readonly EvaluationCriterionItem[];
}

/* ------------------------------------------------------------------ */
/* Administrative validation decisions (recorded as VALIDATION         */
/* workflow actions on COMPLETED internships — see WorkflowService).   */
/* Validate→APPROVED, Reject→REJECTED, Corrections→NEEDS_CORRECTION,   */
/* Hold→RETURNED. Every decision is audited backend-side.              */
/* ------------------------------------------------------------------ */

export type ValidationDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION' | 'RETURNED';

export const VALIDATION_DECISIONS: readonly ValidationDecision[] = [
  'APPROVED',
  'REJECTED',
  'NEEDS_CORRECTION',
  'RETURNED',
];

/** Latest administrative validation decision derived from workflow history. */
export interface ValidationState {
  readonly decision: ValidationDecision | null;
  readonly comment: string | null;
  readonly performedBy: string | null;
  readonly performedAt: string | null;
}

/**
 * Derives the current administrative validation state from an internship's
 * ordered workflow actions. Only VALIDATION actions targeting the COMPLETED
 * step count; the latest one wins. No such action means awaiting validation.
 */
export function deriveValidationState(actions: readonly WorkflowActionResponse[]): ValidationState {
  let latest: WorkflowActionResponse | null = null;
  for (const action of actions) {
    if (action.type !== 'VALIDATION') continue;
    if (action.stepCode !== 'COMPLETED') continue;
    if (!action.decision || action.decision === 'PENDING') continue;
    if (!latest || action.sequenceNumber > latest.sequenceNumber) latest = action;
  }
  if (!latest || !latest.decision) {
    return { decision: null, comment: null, performedBy: null, performedAt: null };
  }
  return {
    decision: latest.decision as ValidationDecision,
    comment: latest.comment,
    performedBy: latest.performedByUsername,
    performedAt: latest.performedAt,
  };
}

/** PUT /api/candidates/{id} body (staff profile correction). */
export interface CandidateUpdateBody {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly birthDate?: string | null;
  readonly address?: string | null;
  readonly speciality?: string | null;
  readonly diploma?: string | null;
  readonly skills?: string | null;
  readonly languages?: string | null;
  readonly universityId: string;
  readonly nationalId: string;
}
