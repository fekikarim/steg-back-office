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
