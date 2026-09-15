import type { Page, Route } from '@playwright/test';

/**
 * Stateful mocked Phase-A11-style API. Mirrors the real backend contract
 * (shapes follow src/app/core/api-models.ts) with a tiny in-memory state
 * machine so the full staff lifecycle is demonstrable without seed data:
 * review → accept → internship → assign → complete → certificate →
 * finance approve → receipt. Mutations change subsequent GETs, exactly
 * like the backend would.
 */
export interface MockState {
  appStatus: string;
  internshipStatus: string;
  financeStatus: string;
  receiptReference: string | null;
  certificate: { id: string; reference: string } | null;
  assignment: {
    id: string;
    departmentName: string;
    supervisorName: string;
    status: string;
  } | null;
}

export function createMockState(): MockState {
  return {
    appStatus: 'SUBMITTED',
    internshipStatus: 'PLANNED',
    financeStatus: 'READY_FOR_DECISION',
    receiptReference: null,
    certificate: null,
    assignment: null,
  };
}

const APP_ID = 'app-1';
const INTERNSHIP_ID = 'ship-1';
const CASE_ID = 'case-1';

function groups(entries: [string, number][]): { groupName: string; count: number }[] {
  return entries.map(([groupName, count]) => ({ groupName, count }));
}

function pageOf<T>(content: T[]): object {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
  };
}

function applicationDetail(state: MockState): object {
  return {
    id: APP_ID,
    reference: 'APP-2026-000123',
    status: state.appStatus,
    candidateId: 'cand-1',
    candidateName: 'Amira Ben Salah',
    desiredStartDate: '2026-03-02',
    desiredEndDate: '2026-08-31',
    proposedTheme: 'Suivi de stages',
    submittedOnline: true,
    submissionDate: '2026-01-15',
    calculatedType: 'PFE',
    requirement: 'OBLIGATOIRE',
    rejectionReason: null,
    correctionComment: null,
    reviewerId: null,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-16T09:00:00Z',
    version: 1,
  };
}

function internshipDetail(state: MockState): object {
  return {
    id: INTERNSHIP_ID,
    reference: 'STAGE-2026-000007',
    startDate: '2026-02-01',
    endDate: '2026-07-31',
    status: state.internshipStatus,
    type: 'PFE',
    requirement: 'OBLIGATOIRE',
    paymentEligible: true,
    subject: 'Suivi de stages',
    academicLevel: 'ENGINEERING',
    candidateId: 'cand-1',
    candidateFullName: 'Amira Ben Salah',
    applicationId: APP_ID,
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-01-20T09:00:00Z',
    version: 1,
  };
}

function financeCase(state: MockState): object {
  return {
    id: CASE_ID,
    reference: 'FIN-2026-000009',
    status: state.financeStatus,
    internshipId: INTERNSHIP_ID,
    internshipReference: 'STAGE-2026-000007',
    openedAt: '2026-08-05T09:00:00Z',
    closedAt: state.financeStatus === 'APPROVED' ? '2026-08-06T09:00:00Z' : null,
    workflowInstanceId: 'wf-fin-1',
    calculation: {
      completedMonths: 6,
      payableMonths: 3,
      ratePerMonth: 50,
      calculatedAmount: 300,
      cappedAmount: 150,
      capApplied: true,
      currencyCode: 'TND',
      calculatedAt: '2026-08-05T10:00:00Z',
    },
    documents: [
      {
        documentId: 'doc-cin',
        documentReference: 'DOC-CIN-1',
        documentType: 'CIN_COPY',
        mandatory: true,
        verificationStatus: 'VERIFIED',
        verificationComment: null,
        reviewedAt: '2026-08-05T11:00:00Z',
        reviewedByName: 'Finance Benali',
      },
      {
        documentId: 'doc-app',
        documentReference: 'DOC-APP-1',
        documentType: 'INTERNSHIP_APPLICATION',
        mandatory: true,
        verificationStatus: 'VERIFIED',
        verificationComment: null,
        reviewedAt: '2026-08-05T11:05:00Z',
        reviewedByName: 'Finance Benali',
      },
    ],
    approvals:
      state.financeStatus === 'APPROVED'
        ? [
            {
              id: 'appr-1',
              decision: 'APPROVED',
              comment: 'Dossier complet.',
              decisionSequence: 1,
              decidedAt: '2026-08-06T09:00:00Z',
              decidedByName: 'Finance Benali',
            },
          ]
        : [],
    receiptReference: state.receiptReference,
  };
}

function assignments(state: MockState): object[] {
  if (!state.assignment) return [];
  return [
    {
      id: state.assignment.id,
      internshipId: INTERNSHIP_ID,
      departmentId: 'dep-1',
      departmentName: state.assignment.departmentName,
      supervisorId: 'emp-2',
      supervisorName: state.assignment.supervisorName,
      assignedById: 'emp-9',
      assignedByName: 'HR Karim',
      assignedAt: '2026-02-01',
      startDate: '2026-02-01',
      endDate: '2026-07-31',
      status: state.assignment.status,
      assignmentReason: 'Encadrement PFE',
      endedAt: null,
      createdAt: '2026-02-01T09:00:00Z',
      version: 1,
    },
  ];
}

/** Installs the mock API router for the given page + mutable state. */
export async function installMockApi(page: Page, state: MockState): Promise<void> {
  await page.route('http://localhost:8080/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname.replace(/^\/api/, '');
    const ok = (json: unknown, status = 200): Promise<void> =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });

    // --- auth (real backend flow: JWT with role) ---
    if (method === 'POST' && path === '/auth/login') {
      const body = route.request().postDataJSON() as { email?: string; password?: string };
      const email = (body?.email ?? '').toLowerCase();
      const roleMap: Record<string, string> = {
        'rh@steg.tn': 'HR',
        'sup@steg.tn': 'SUPERVISOR',
        'supervisor.steg@steg.tn': 'SUPERVISOR',
        'finance@steg.tn': 'FINANCE',
        'finance.steg@steg.tn': 'FINANCE',
        'admin@steg.tn': 'ADMIN',
        'dir@steg.tn': 'DIRECTOR',
        'candidate@steg.tn': 'CANDIDATE',
      };
      const role = roleMap[email];
      if (!role) {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 401,
            error: 'Unauthorized',
            message: 'Incorrect email or password.',
            path: '/api/auth/login',
          }),
        });
      }
      const payload = {
        sub: `user-${role.toLowerCase()}`,
        email,
        roles: [`ROLE_${role}`],
        exp: Math.floor(Date.now() / 1000) + 900,
      };
      const b64 = (obj: unknown): string =>
        Buffer.from(JSON.stringify(obj)).toString('base64url');
      const mockJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
      return ok({
        accessToken: mockJwt,
        refreshToken: `mock-refresh-${role.toLowerCase()}`,
        expiresIn: 900,
        tokenType: 'Bearer',
      });
    }
    if (method === 'POST' && path === '/auth/refresh') {
      const body = route.request().postDataJSON() as { refreshToken?: string };
      const rt = body?.refreshToken ?? '';
      const role = rt.includes('finance')
        ? 'FINANCE'
        : rt.includes('supervisor') || rt.includes('sup')
          ? 'SUPERVISOR'
          : rt.includes('admin')
            ? 'ADMIN'
            : rt.includes('hr')
              ? 'HR'
              : 'HR';
      const payload = {
        sub: `user-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@steg.tn`,
        roles: [`ROLE_${role}`],
        exp: Math.floor(Date.now() / 1000) + 900,
      };
      const b64 = (obj: unknown): string =>
        Buffer.from(JSON.stringify(obj)).toString('base64url');
      const mockJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
      return ok({
        accessToken: mockJwt,
        refreshToken: `mock-refresh-${role.toLowerCase()}-new`,
        expiresIn: 900,
        tokenType: 'Bearer',
      });
    }
    if (method === 'POST' && (path === '/auth/logout' || path === '/auth/logout-all')) {
      return route.fulfill({ status: 204, body: '' });
    }

    // --- reporting aggregates (dashboard) ---
    if (method === 'GET' && path === '/reports/applications-by-status')
      return ok(
        groups([
          ['SUBMITTED', 4],
          ['UNDER_REVIEW', 2],
          ['ACCEPTED', 9],
        ]),
      );
    if (method === 'GET' && path === '/reports/internships-by-status')
      return ok(
        groups([
          ['ACTIVE', 6],
          ['COMPLETED', 3],
        ]),
      );
    if (method === 'GET' && path === '/reports/internships-by-type')
      return ok(
        groups([
          ['PFE', 5],
          ['OBSERVATION', 4],
        ]),
      );
    if (method === 'GET' && path === '/reports/internships-by-department')
      return ok(
        groups([
          ['DSI', 4],
          ['DT', 5],
        ]),
      );
    if (method === 'GET' && path === '/reports/finance-cases-by-status')
      return ok(
        groups([
          ['READY_FOR_DECISION', 2],
          ['APPROVED', 7],
        ]),
      );
    if (method === 'GET' && path === '/reports/payment-totals')
      return ok([
        { year: 2026, month: 7, departmentCode: 'DSI', totalAmount: 300, receiptCount: 2 },
      ]);
    if (method === 'GET' && path === '/notifications') return ok(pageOf([]));

    // --- applications ---
    if (method === 'GET' && path === '/applications')
      return ok([
        {
          ...applicationDetail(state),
          university: 'ENIT',
          internshipType: 'PFE',
          mandatory: true,
          submittedAt: '2026-01-15',
          updatedAt: '2026-01-16T09:00:00Z',
        },
      ]);
    if (method === 'GET' && path === `/applications/${APP_ID}`) return ok(applicationDetail(state));
    if (method === 'GET' && path === `/applications/${APP_ID}/documents`)
      return ok([
        {
          id: 'ad-cin',
          applicationId: APP_ID,
          document: {
            id: 'doc-cin-app',
            reference: 'DOC-APP-CIN-1',
            type: 'CIN_COPY',
            restrictedAccess: true,
            generatedAutomatically: false,
            latestVersionNumber: 1,
            originalFileName: 'cin.png',
            mimeType: 'image/png',
            sizeBytes: 1024,
            checksum: 'abc',
            uploadedAt: '2026-01-15T09:00:00Z',
            createdAt: '2026-01-15T09:00:00Z',
          },
          mandatory: true,
          verificationStatus: 'PENDING',
          verificationComment: null,
          verifiedById: null,
          verifiedAt: null,
          createdAt: '2026-01-15T09:00:00Z',
        },
        {
          id: 'ad-cv',
          applicationId: APP_ID,
          document: {
            id: 'doc-cv-app',
            reference: 'DOC-APP-CV-1',
            type: 'CV',
            restrictedAccess: false,
            generatedAutomatically: false,
            latestVersionNumber: 1,
            originalFileName: 'cv.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            checksum: 'def',
            uploadedAt: '2026-01-15T09:00:00Z',
            createdAt: '2026-01-15T09:00:00Z',
          },
          mandatory: false,
          verificationStatus: 'PENDING',
          verificationComment: null,
          verifiedById: null,
          verifiedAt: null,
          createdAt: '2026-01-15T09:00:00Z',
        },
      ]);
    if (method === 'PUT' && path === `/applications/${APP_ID}/documents/ad-cv/verify`)
      return ok({ id: 'ad-cv', verificationStatus: 'VERIFIED' });
    if (method === 'GET' && path === '/documents/doc-cv-app/download')
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock cv'),
      });
    if (method === 'GET' && path === '/documents/doc-app')
      return ok({
        id: 'doc-app',
        reference: 'DOC-APP-1',
        type: 'INTERNSHIP_APPLICATION',
        restrictedAccess: false,
        generatedAutomatically: false,
        latestVersionNumber: 1,
        originalFileName: 'demande.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksum: 'def',
        uploadedAt: '2026-08-05T09:00:00Z',
        createdAt: '2026-08-05T09:00:00Z',
      });
    if (method === 'GET' && path === '/documents/doc-cin-app/download-restricted')
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      });
    if (method === 'GET' && path === `/applications/${APP_ID}/workflow`)
      return ok({
        id: 'wf-app-1',
        definitionCode: 'application-review',
        definitionName: 'Application Review',
        currentStepCode: state.appStatus,
        currentStepName: state.appStatus,
        status: 'RUNNING',
        startedAt: '2026-01-15T09:00:00Z',
        completedAt: null,
        cancelledAt: null,
      });
    if (method === 'POST' && path === `/applications/${APP_ID}/workflow/actions`) {
      const body = route.request().postDataJSON() as { decision?: string };
      if (body?.decision === 'APPROVED') state.appStatus = 'ACCEPTED';
      else if (body?.decision === 'REJECTED') state.appStatus = 'REJECTED';
      else state.appStatus = 'UNDER_REVIEW';
      return ok({
        id: 'act-1',
        instanceId: 'wf-app-1',
        stepCode: state.appStatus,
        stepName: state.appStatus,
        performedById: 'u-hr',
        performedByUsername: 'hr.steg',
        type: 'APPROVAL',
        decision: body?.decision ?? 'PENDING',
        comment: null,
        sequenceNumber: 2,
        performedAt: new Date().toISOString(),
      });
    }
    if (method === 'GET' && path === '/workflows/wf-app-1/actions')
      return ok([
        {
          id: 'act-0',
          instanceId: 'wf-app-1',
          stepCode: 'SUBMITTED',
          stepName: 'Submitted',
          performedById: 'u-cand',
          performedByUsername: 'amira.ben.salah',
          type: 'SUBMISSION',
          decision: 'PENDING',
          comment: null,
          sequenceNumber: 1,
          performedAt: '2026-01-15T09:00:00Z',
        },
      ]);

    // --- candidates ---
    if (method === 'GET' && path === '/candidates')
      return ok([
        {
          id: 'cand-1',
          firstName: 'Amira',
          lastName: 'Ben Salah',
          email: 'amira.ben.salah@example.tn',
          phone: '+21620000000',
          birthDate: '2003-05-01',
          speciality: 'Informatique',
          diploma: 'Licence',
          universityId: 'univ-1',
          universityName: 'ENIT',
          userId: 'u-cand',
          createdAt: '2026-01-10T09:00:00Z',
          updatedAt: '2026-01-10T09:00:00Z',
          version: 0,
        },
      ]);
    if (method === 'GET' && path === '/candidates/cand-1')
      return ok({
        id: 'cand-1',
        firstName: 'Amira',
        lastName: 'Ben Salah',
        email: 'amira.ben.salah@example.tn',
        phone: '+21620000000',
        birthDate: '2003-05-01',
        address: 'Tunis',
        speciality: 'Informatique',
        diploma: 'Licence',
        skills: 'Java, Angular',
        languages: 'ar, fr, en',
        nationalId: '09876543',
        universityId: 'univ-1',
        universityName: 'ENIT',
        userId: 'u-cand',
        createdAt: '2026-01-10T09:00:00Z',
        updatedAt: '2026-01-10T09:00:00Z',
        version: 0,
      });

    // --- internships ---
    if (method === 'GET' && path === '/internships') return ok([internshipDetail(state)]);
    if (method === 'GET' && path === `/internships/${INTERNSHIP_ID}`)
      return ok(internshipDetail(state));
    if (method === 'POST' && path === '/internships/from-application')
      return ok(internshipDetail(state), 201);
    if (method === 'GET' && path === `/internships/${INTERNSHIP_ID}/assignments`)
      return ok(assignments(state));
    if (method === 'POST' && path === `/internships/${INTERNSHIP_ID}/assignments`) {
      state.assignment = {
        id: 'as-1',
        departmentName: 'DSI',
        supervisorName: 'Leila Mansour',
        status: 'ACTIVE',
      };
      return ok(assignments(state)[0], 201);
    }
    if (method === 'GET' && path === `/internships/${INTERNSHIP_ID}/classification`)
      return ok({
        internshipId: INTERNSHIP_ID,
        reference: 'STAGE-2026-000007',
        startDate: '2026-02-01',
        endDate: '2026-07-31',
        type: 'PFE',
        requirement: 'OBLIGATOIRE',
        paymentEligible: true,
        durationInDays: 181,
        appliedRuleDescription: 'Durée > 3 mois → PFE, obligatoire.',
      });
    if (method === 'GET' && path === `/internships/${INTERNSHIP_ID}/workflow`)
      return ok({
        id: 'wf-ship-1',
        definitionCode: 'internship-lifecycle',
        definitionName: 'Internship lifecycle',
        currentStepCode: state.internshipStatus,
        currentStepName: state.internshipStatus,
        status: 'RUNNING',
        startedAt: '2026-02-01T09:00:00Z',
        completedAt: null,
        cancelledAt: null,
      });
    if (method === 'POST' && path === `/internships/${INTERNSHIP_ID}/workflow/actions`) {
      const body = route.request().postDataJSON() as { targetStepCode?: string };
      if (body?.targetStepCode) state.internshipStatus = body.targetStepCode;
      return ok({
        id: 'act-s1',
        instanceId: 'wf-ship-1',
        stepCode: state.internshipStatus,
        stepName: state.internshipStatus,
        performedById: 'u-hr',
        performedByUsername: 'hr.steg',
        type: 'VALIDATION',
        decision: 'APPROVED',
        comment: null,
        sequenceNumber: 2,
        performedAt: new Date().toISOString(),
      });
    }
    if (method === 'GET' && path === '/workflows/wf-ship-1/actions') return ok([]);
    if (method === 'GET' && path === `/internships/${INTERNSHIP_ID}/documents`) return ok([]);
    if (method === 'POST' && path === `/internships/${INTERNSHIP_ID}/certificates`) {
      state.certificate = { id: 'cert-1', reference: 'CERT-2026-000003' };
      return ok(
        {
          id: 'cert-1',
          reference: 'CERT-2026-000003',
          status: 'GENERATED',
          templateCode: 'CERT_V1',
          templateVersion: 1,
          internshipId: INTERNSHIP_ID,
          internshipReference: 'STAGE-2026-000007',
          generatedAt: new Date().toISOString(),
          issueDate: '2026-08-01',
        },
        201,
      );
    }
    if (method === 'GET' && path === '/certificates/cert-1')
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock certificate'),
      });

    // --- organization reference data ---
    if (method === 'GET' && path === '/departments')
      return ok([
        {
          id: 'dep-1',
          code: 'DSI',
          name: 'DSI',
          description: null,
          active: true,
          parentDepartmentId: null,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          version: 0,
        },
      ]);
    if (method === 'GET' && path === '/employees')
      return ok([
        {
          id: 'emp-2',
          employeeNumber: 'EMP-0002',
          firstName: 'Leila',
          lastName: 'Mansour',
          phoneNumber: null,
          position: 'Supervisor',
          hireDate: '2020-01-01',
          active: true,
          departmentId: 'dep-1',
          departmentName: 'DSI',
          userId: 'u-sup',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          version: 0,
        },
      ]);

    // --- finance ---
    if (method === 'GET' && path === '/finance-cases') {
      const status = url.searchParams.get('status');
      const all = [financeCase(state)] as object[];
      const content = status ? all.filter((c) => (c as { status: string }).status === status) : all;
      return ok({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });
    }
    if (method === 'GET' && path === `/finance-cases/${CASE_ID}`) return ok(financeCase(state));
    if (method === 'POST' && path === `/finance-cases/${CASE_ID}/approve`) {
      state.financeStatus = 'APPROVED';
      state.receiptReference = 'PAY-2026-000004';
      return ok(financeCase(state));
    }
    if (method === 'POST' && path === `/finance-cases/${CASE_ID}/reject`) {
      state.financeStatus = 'REJECTED';
      return ok(financeCase(state));
    }
    if (method === 'POST' && path === `/finance-cases/${CASE_ID}/recalculate`)
      return ok(financeCase(state));
    if (method === 'GET' && path === `/finance-cases/${CASE_ID}/receipt`)
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock receipt'),
      });

    // --- documents ---
    if (method === 'GET' && path === '/documents/doc-cin')
      return ok({
        id: 'doc-cin',
        reference: 'DOC-CIN-1',
        type: 'CIN_COPY',
        restrictedAccess: true,
        generatedAutomatically: false,
        latestVersionNumber: 1,
        originalFileName: 'cin-finance.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        checksum: 'abc',
        uploadedAt: '2026-08-05T09:00:00Z',
        createdAt: '2026-08-05T09:00:00Z',
      });
    if (method === 'GET' && path === '/documents/doc-cin')
      return ok({
        id: 'doc-cin',
        reference: 'DOC-CIN-1',
        type: 'CIN_COPY',
        restrictedAccess: true,
        generatedAutomatically: false,
        latestVersionNumber: 1,
        originalFileName: 'cin.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        checksum: 'abc',
        uploadedAt: '2026-08-05T09:00:00Z',
        createdAt: '2026-08-05T09:00:00Z',
      });
    if (method === 'GET' && path === '/documents/doc-app')
      return ok({
        id: 'doc-app',
        reference: 'DOC-APP-1',
        type: 'INTERNSHIP_APPLICATION',
        restrictedAccess: false,
        generatedAutomatically: false,
        latestVersionNumber: 1,
        originalFileName: 'demande.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksum: 'def',
        uploadedAt: '2026-08-05T09:00:00Z',
        createdAt: '2026-08-05T09:00:00Z',
      });
    if (method === 'GET' && path === '/documents/doc-cin/download-restricted')
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      });
    if (method === 'GET' && path === '/documents/doc-app/download')
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock'),
      });

    // --- audit ---
    if (method === 'GET' && path === '/audit')
      return ok({
        content: [
          {
            id: 'log-1',
            createdAt: '2026-08-06T09:00:00Z',
            action: 'PAYMENT_APPROVED',
            entityType: 'FinanceCase',
            entityId: CASE_ID,
            oldValues: null,
            newValues: '{"status":"APPROVED"}',
            actorId: 'u-fin',
            actorEmail: 'finance@steg.tn',
            ipAddress: '10.0.0.2',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      });
    if (method === 'GET' && path === '/audit/log-1')
      return ok({
        id: 'log-1',
        createdAt: '2026-08-06T09:00:00Z',
        action: 'PAYMENT_APPROVED',
        entityType: 'FinanceCase',
        entityId: CASE_ID,
        oldValues: '{"status":"READY_FOR_DECISION"}',
        newValues: '{"status":"APPROVED"}',
        actorId: 'u-fin',
        actorEmail: 'finance@steg.tn',
        ipAddress: '10.0.0.2',
      });

    // --- AI advisory ---
    if (method === 'POST' && path === `/ai/finance-cases/${CASE_ID}/analyze`)
      return ok({
        analysis: {
          id: 'an-1',
          type: 'FINANCE_CASE_ANALYSIS',
          relatedEntityType: 'FinanceCase',
          relatedEntityId: CASE_ID,
          modelUsed: 'mock-model',
          inputSummary: 'Dossier summary',
          outputSummary: 'Coherent dossier.',
          cinExcluded: true,
          createdAt: new Date().toISOString(),
        },
        recommendations: [
          {
            id: 'rec-1',
            analysisId: 'an-1',
            recommendationText: 'Verify assignment letter dates.',
            status: 'PROPOSED',
            reviewedById: null,
            reviewedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        responseText: 'Dossier coherent, CIN excluded.',
      });

    return ok({ message: 'mock: unhandled ' + method + ' ' + path }, 404);
  });
}

/** Real login through the backend-synced form (email + password only; role comes from JWT). */
export async function loginAs(
  page: Page,
  email: string,
  _role: 'HR' | 'SUPERVISOR' | 'FINANCE' | 'DIRECTOR' | 'ADMIN',
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-mail|email/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill('Password123!');
  await page.getByRole('button', { name: /se connecter|sign in/i }).click();
  await page.waitForURL('**/dashboard');
}
