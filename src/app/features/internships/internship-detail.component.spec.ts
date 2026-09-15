import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InternshipDetailComponent } from './internship-detail.component';
import { InternshipService, type InternshipBundle } from './internship.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function bundle(status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'): InternshipBundle {
  return {
    internship: {
      id: 'i1',
      reference: 'STAGE-2026-0001',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status,
      type: 'PFE',
      requirement: 'OBLIGATOIRE',
      paymentEligible: true,
      subject: 'Grid',
      academicLevel: 'Engineer',
      candidateId: 'c1',
      candidateFullName: 'Sara Ben Ammar',
      applicationId: 'a1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
      version: 0,
    },
    candidate: null,
    classification: {
      internshipId: 'i1',
      reference: 'STAGE-2026-0001',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      type: 'PFE',
      requirement: 'OBLIGATOIRE',
      paymentEligible: true,
      durationInDays: 92,
      appliedRuleDescription: 'Duration > 3 months → PFE, mandatory.',
    },
    assignments: [
      {
        id: 'as-1',
        internshipId: 'i1',
        departmentId: 'd1',
        departmentName: 'DSI',
        supervisorId: 's1',
        supervisorName: 'Leila Mansour',
        assignedById: 'e9',
        assignedByName: 'HR Staff',
        assignedAt: '2026-07-01',
        startDate: null,
        endDate: null,
        status: 'ACTIVE',
        assignmentReason: null,
        endedAt: null,
        createdAt: '2026-07-01T00:00:00Z',
        version: 0,
      },
    ],
    workflow: null,
    documents: [],
    actions: [],
    actionsRestricted: false,
  };
}

function doc(
  id: string,
  type: 'INTERNSHIP_APPLICATION' | 'STEG_INTERNSHIP_REPORT' | 'CIN_COPY',
  restricted: boolean,
): InternshipBundle['documents'][number] {
  return {
    id,
    internshipId: 'i1',
    document: {
      id: `doc-${id}`,
      reference: `DOC-${id}`,
      type,
      restrictedAccess: restricted,
      generatedAutomatically: false,
      latestVersionNumber: 1,
      originalFileName: `${id}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'abc',
      uploadedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-06-01T00:00:00Z',
    },
    mandatory: true,
    generatedAutomatically: false,
    createdAt: '2026-06-01T00:00:00Z',
  };
}
describe('InternshipDetailComponent', () => {
  async function setup(role: 'HR' | 'SUPERVISOR', status: 'PLANNED' | 'ACTIVE' | 'COMPLETED') {
    const calls: { method: string; args: unknown[] }[] = [];
    let loads = 0;
    await TestBed.configureTestingModule({
      imports: [InternshipDetailComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'i1' } } },
        },
        {
          provide: InternshipService,
          useValue: {
            loadBundle: () => {
              loads++;
              return of(bundle(status));
            },
            activate: () => {
              calls.push({ method: 'activate', args: [] });
              return of({ id: 'act' });
            },
            complete: () => {
              calls.push({ method: 'complete', args: [] });
              return of({ id: 'act' });
            },
            cancel: () => of({ id: 'act' }),
            updateDates: (_id: unknown, body: unknown) => {
              calls.push({ method: 'updateDates', args: [body] });
              return of({ type: 'PFE', requirement: 'OBLIGATOIRE' });
            },
            assign: (_id: unknown, body: unknown) => {
              calls.push({ method: 'assign', args: [body] });
              return of({ id: 'as-2' });
            },
            referenceData: () =>
              of({
                departments: [{ id: 'd1', code: 'DSI', name: 'DSI', active: true }],
                employees: [
                  {
                    id: 's1',
                    firstName: 'Leila',
                    lastName: 'Mansour',
                    active: true,
                    employeeNumber: 'E1',
                  },
                ],
              }),
            generateCertificate: () => {
              calls.push({ method: 'generateCertificate', args: [] });
              return of({ id: 'cert-1', reference: 'CERT-1', status: 'GENERATED' });
            },
            downloadCertificate: () => of(new Blob()),
            uploadThenAttach: (_id: unknown, type: unknown, file: unknown, mandatory: unknown) => {
              calls.push({ method: 'uploadThenAttach', args: [_id, type, file, mandatory] });
              return of({ id: 'ad-9' });
            },
            downloadDocument: () => of(new Blob()),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo(role === 'HR' ? 'rh@steg.tn' : 'sup@steg.tn', role);
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(InternshipDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls, loads: () => loads };
  }

  it('shows backend classification read-only with the applied rule', async () => {
    const { fixture } = await setup('HR', 'ACTIVE');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('PFE');
    expect(text).toContain('Duration > 3 months → PFE, mandatory.');
    expect(text).toContain('92');
  });

  it('activates a PLANNED internship through confirm + server reload', async () => {
    const { fixture, calls, loads } = await setup('HR', 'PLANNED');
    const component = fixture.componentInstance;
    component.confirmAction.set('activate');
    fixture.detectChanges();
    component.doConfirm();
    expect(calls.some((c) => c.method === 'activate')).toBe(true);
    expect(loads()).toBeGreaterThan(1);
  });

  it('hides lifecycle management without INTERNSHIP_ASSIGN', async () => {
    const { fixture } = await setup('SUPERVISOR', 'ACTIVE');
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Complete');
    expect(text).not.toContain('Reassign');
  });

  it('shows the certificate entry only for COMPLETED internships', async () => {
    const active = await setup('HR', 'ACTIVE');
    expect(active.fixture.nativeElement.textContent as string).not.toContain(
      'Generate certificate',
    );

    await TestBed.resetTestingModule();
    const { fixture } = await setup('SUPERVISOR', 'COMPLETED');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Generate certificate');
  });

  it('validates dates locally and omits the observation flag for PFE', async () => {
    const { fixture, calls } = await setup('HR', 'ACTIVE');
    const component = fixture.componentInstance;
    component.openDates();
    component.datesForm.startDate = '2026-09-01';
    component.datesForm.endDate = '2026-08-01';
    component.saveDates();
    expect(component.datesError()).toBeTruthy();
    expect(calls.length).toBe(0);

    component.datesForm.startDate = '2026-07-01';
    component.datesForm.endDate = '2026-10-31';
    component.saveDates();
    expect(calls.length).toBe(1);
    expect(calls[0]?.args[0]).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-10-31',
      observationObligatoire: null,
    });
  });

  it('requires department + supervisor and states the one-active rule', async () => {
    const { fixture, calls } = await setup('HR', 'ACTIVE');
    const component = fixture.componentInstance;
    component.tab.set('assignment');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('One active supervisor');
    component.openAssign();
    fixture.detectChanges();
    await fixture.whenStable();
    const confirm = [
      ...fixture.nativeElement.querySelectorAll('st-dialog .st-dialog__actions button'),
    ].find((b: HTMLButtonElement) => b.textContent?.includes('Confirm')) as
      HTMLButtonElement | undefined;
    expect(confirm?.disabled).toBe(true);
    component.assignForm.departmentId = 'd1';
    component.assignForm.supervisorId = 's1';
    component.saveAssign();
    expect(calls.some((c) => c.method === 'assign')).toBe(true);
    expect(calls.find((c) => c.method === 'assign')?.args[0]).toEqual({
      departmentId: 'd1',
      supervisorId: 's1',
    });
  });

  it('surfaces backend 403 on certificate generation as a toast', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InternshipDetailComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'i1' } } },
        },
        {
          provide: InternshipService,
          useValue: {
            loadBundle: () => of(bundle('COMPLETED')),
            generateCertificate: () => throwError(() => ({ status: 403 })),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('sup@steg.tn', 'SUPERVISOR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(InternshipDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.confirmAction.set('certificate');
    component.doConfirm();
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.some((t) => t.kind === 'error')).toBe(true);
  });

  it('groups documents and gates restricted downloads without the explicit permission', async () => {
    await TestBed.resetTestingModule();
    const docs = [
      doc('ad-1', 'INTERNSHIP_APPLICATION', false),
      doc('ad-2', 'STEG_INTERNSHIP_REPORT', false),
      doc('ad-3', 'CIN_COPY', true),
    ];
    await TestBed.configureTestingModule({
      imports: [InternshipDetailComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'i1' } } },
        },
        {
          provide: InternshipService,
          useValue: {
            loadBundle: () => of({ ...bundle('COMPLETED'), documents: docs }),
            downloadDocument: () => of(new Blob()),
            uploadThenAttach: () => of({ id: 'ad-9' }),
          },
        },
      ],
    }).compileComponents();
    // HR lacks DOCUMENT_VIEW_RESTRICTED.
    TestBed.inject(AuthService).signInDemo('rh@steg.tn', 'HR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(InternshipDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.tab.set('documents');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Required pieces');
    expect(text).toContain('Restricted access');
    const buttons = [...fixture.nativeElement.querySelectorAll('.st-docrow__actions button')];
    const restrictedRow = buttons.filter((b: HTMLButtonElement) =>
      b.closest('.st-docrow--restricted'),
    );
    expect(restrictedRow.length).toBeGreaterThan(0);
    for (const b of restrictedRow) expect(b.disabled).toBe(true);
    // Checklist: required set is incomplete (assignment letter missing).
    expect(
      component
        .checklist(fixture.componentInstance.bundle()!)
        .find((c) => c.key === 'internshipDocs.checkRequiredDocs')?.met,
    ).toBe(false);
  });

  it('validates upload size locally and chains upload into attach', async () => {
    const { fixture, calls } = await setup('HR', 'ACTIVE');
    const component = fixture.componentInstance;
    const big = new File([new ArrayBuffer(26 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [big] });
    component.onUploadFile({ target: input } as unknown as Event);
    expect(component.uploadError()).toBeTruthy();
    expect(component.uploadFile).toBeNull();

    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });
    const input2 = document.createElement('input');
    Object.defineProperty(input2, 'files', { value: [file] });
    component.onUploadFile({ target: input2 } as unknown as Event);
    component.uploadType = 'STEG_INTERNSHIP_REPORT';
    component.uploadMandatory = true;
    component.submitUpload();
    const upload = calls.find((c) => c.method === 'uploadThenAttach');
    expect(upload?.args).toEqual(['i1', 'STEG_INTERNSHIP_REPORT', file, true]);
  });

  it('prints the completion summary without touching PDF content', async () => {
    const { fixture } = await setup('HR', 'COMPLETED');
    const component = fixture.componentInstance;
    component.tab.set('documents');
    fixture.detectChanges();
    let printed = false;
    const original = window.print;
    Object.defineProperty(window, 'print', { value: () => (printed = true), configurable: true });
    try {
      component.printSummary();
      expect(printed).toBe(true);
      expect(document.body.classList.contains('st-printing-summary')).toBe(true);
      expect(fixture.nativeElement.querySelector('.st-print-only')).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'print', { value: original, configurable: true });
      document.body.classList.remove('st-printing-summary');
    }
  });
});
