import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApplicationDossierComponent } from './application-dossier.component';
import { ApplicationReviewService, type DossierBundle } from './application-review.service';
import { AuthService } from '../../core/auth.service';
import type { ApplicationDetail } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const APP: ApplicationDetail = {
  id: 'app-1',
  reference: 'APP-2026-0001',
  status: 'UNDER_REVIEW',
  candidateId: 'c1',
  candidateName: 'Sara Ben Ammar',
  desiredStartDate: '2026-07-01',
  desiredEndDate: '2026-08-31',
  proposedTheme: 'Smart grid monitoring',
  submittedOnline: true,
  submissionDate: '2026-06-01',
  calculatedType: 'PERFECTIONNEMENT',
  requirement: 'OBLIGATOIRE',
  rejectionReason: null,
  correctionComment: null,
  reviewerId: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
  version: 0,
};

function bundle(overrides: Partial<DossierBundle> = {}): DossierBundle {
  return {
    application: APP,
    candidate: null,
    documents: [],
    workflow: null,
    actions: [],
    actionsRestricted: false,
    ...overrides,
  };
}

const RESTRICTED_DOC = {
  id: 'ad-1',
  applicationId: 'app-1',
  document: {
    id: 'd-1',
    reference: 'DOC-1',
    type: 'CIN_COPY',
    restrictedAccess: true,
    generatedAutomatically: false,
    latestVersionNumber: 1,
    originalFileName: 'cin.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    checksum: 'abc',
    uploadedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
  },
  mandatory: true,
  verificationStatus: 'PENDING',
  verificationComment: null,
  verifiedById: null,
  verifiedAt: null,
  createdAt: '2026-06-01T00:00:00Z',
} as DossierBundle['documents'][number];

describe('ApplicationDossierComponent', () => {
  async function setup(role: 'HR' | 'SUPERVISOR', snap: DossierBundle) {
    const calls: { method: string; args: unknown[] }[] = [];
    await TestBed.configureTestingModule({
      imports: [ApplicationDossierComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
          { path: 'candidates/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'app-1' } } },
        },
        {
          provide: ApplicationReviewService,
          useValue: {
            loadDossier: () => of(snap),
            beginReview: () => of({ id: 'x' }),
            accept: (...args: unknown[]) => {
              calls.push({ method: 'accept', args });
              return of({ id: 'x' });
            },
            reject: (...args: unknown[]) => {
              calls.push({ method: 'reject', args });
              return of({ id: 'x' });
            },
            requestCorrection: (...args: unknown[]) => {
              calls.push({ method: 'requestCorrection', args });
              return of({ id: 'x' });
            },
            verifyDocument: () => of({}),
            downloadDocument: () => of(new Blob()),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo(role === 'HR' ? 'rh@steg.tn' : 'sup@steg.tn', role);
    const fixture = TestBed.createComponent(ApplicationDossierComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls };
  }

  it('hides review actions without APPLICATION_REVIEW (supervisor sees read-only dossier)', async () => {
    const { fixture } = await setup('SUPERVISOR', bundle());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('APP-2026-0001');
    expect(text).not.toContain('Accepter');
    expect(text).not.toContain('Rejeter');
  });

  it('shows accept/correct/reject for UNDER_REVIEW with review permission', async () => {
    const { fixture } = await setup('HR', bundle());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Accepter');
    expect(text).toContain('Rejeter');
  });

  it('blocks short rejection reasons client-side (backend stays authoritative)', async () => {
    const { fixture, calls } = await setup('HR', bundle());
    const component = fixture.componentInstance;
    component.openReason('reject');
    component.reasonText = 'no';
    component.submitReason();
    expect(component.reasonError()).toBeTruthy();
    expect(calls.length).toBe(0);

    component.reasonText = 'Missing transcripts, please resubmit.';
    component.submitReason();
    expect(calls.length).toBe(1);
    expect(calls[0]?.method).toBe('reject');
  });

  it('disables restricted downloads without DOCUMENT_VIEW_RESTRICTED', async () => {
    const { fixture } = await setup('HR', bundle({ documents: [RESTRICTED_DOC] }));
    const component = fixture.componentInstance;
    component.tab.set('documents');
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('.st-docrow__actions button')];
    const download = buttons.find((b: HTMLButtonElement) => b.textContent?.includes('Télécharger'));
    expect(download?.disabled).toBe(true);
  });

  it('renders the real workflow timeline and masks CIN by default', async () => {
    const { fixture } = await setup(
      'HR',
      bundle({
        candidate: {
          id: 'c1',
          firstName: 'Sara',
          lastName: 'Ben Ammar',
          email: 's@x.tn',
          phone: null,
          birthDate: null,
          speciality: null,
          diploma: null,
          universityId: 'u1',
          universityName: 'ENIT',
          userId: 'u-1',
          createdAt: '',
          updatedAt: '',
          version: 0,
          address: null,
          skills: null,
          languages: null,
          nationalId: 'CIN-99887766',
        },
        actions: [
          {
            id: 'act-1',
            instanceId: 'wf-1',
            stepCode: 'UNDER_REVIEW',
            stepName: 'HR & Department Review',
            performedById: 'e1',
            performedByUsername: 'rh.steg',
            type: 'VALIDATION',
            decision: 'PENDING',
            comment: null,
            sequenceNumber: 1,
            performedAt: '2026-06-03T10:00:00Z',
          },
        ],
      }),
    );
    const component = fixture.componentInstance;
    component.tab.set('timeline');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('HR & Department Review');
    expect(text).toContain('rh.steg');
    expect(text).not.toContain('CIN-99887766');
  });

  it('surfaces backend 403 on history as a restricted note, not a crash', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ApplicationDossierComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'app-1' } } },
        },
        {
          provide: ApplicationReviewService,
          useValue: { loadDossier: () => throwError(() => ({ status: 403 })) },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('sup@steg.tn', 'SUPERVISOR');
    const fixture = TestBed.createComponent(ApplicationDossierComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('st-error-state')).toBeTruthy();
  });
});
