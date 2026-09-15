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
    actions: [],
    actionsRestricted: false,
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
});
