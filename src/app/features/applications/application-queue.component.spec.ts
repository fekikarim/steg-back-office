import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationsComponent } from './application-queue.component';
import { ApplicationQueueStore } from './application-queue-store';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import type { ApplicationDetail } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const APPS: ApplicationDetail[] = [
  {
    id: 'a1',
    reference: 'APP-2026-0001',
    status: 'SUBMITTED',
    candidateId: 'c1',
    candidateName: 'Sara Ben Ammar',
    desiredStartDate: '2026-07-01',
    desiredEndDate: '2026-08-31',
    proposedTheme: null,
    submittedOnline: true,
    submissionDate: '2026-06-01',
    calculatedType: 'PERFECTIONNEMENT',
    requirement: 'OBLIGATOIRE',
    rejectionReason: null,
    correctionComment: null,
    reviewerId: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    version: 0,
  },
  {
    id: 'a2',
    reference: 'APP-2026-0002',
    status: 'NEEDS_CORRECTION',
    candidateId: 'c2',
    candidateName: 'Omar Trabelsi',
    desiredStartDate: '2026-07-01',
    desiredEndDate: '2026-07-31',
    proposedTheme: null,
    submittedOnline: false,
    submissionDate: '2026-06-02',
    calculatedType: 'OBSERVATION',
    requirement: 'OPTIONAL',
    rejectionReason: null,
    correctionComment: 'Blurry scan',
    reviewerId: null,
    createdAt: '2026-06-02T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
    version: 0,
  },
];

const CANDIDATES = [
  { id: 'c1', universityName: 'ENIT' },
  { id: 'c2', universityName: 'INSAT' },
];

describe('ApplicationsComponent (queue)', () => {
  async function setup(queryStatus: string | null = null) {
    await TestBed.configureTestingModule({
      imports: [ApplicationsComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'applications', component: StubComponent },
          { path: 'applications/new', component: StubComponent },
          { path: 'applications/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => queryStatus } } },
        },
        {
          provide: ApiClient,
          useValue: {
            listApplications: () => of(APPS),
            listCandidates: () => of(CANDIDATES),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('rh@steg.tn', 'HR');
    const fixture = TestBed.createComponent(ApplicationsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders backend rows with joined university and source badges', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('APP-2026-0001');
    expect(text).toContain('ENIT');
    expect(text).toContain('INSAT');
  });

  it('never renders CIN values in the queue', async () => {
    const fixture = await setup();
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('nationalId');
    expect(html).not.toContain('CIN-');
    expect(html.toLowerCase()).not.toContain('cin');
  });

  it('applies dashboard drill-down preset and filters rows', async () => {
    const fixture = await setup('NEEDS_CORRECTION');
    const component = fixture.componentInstance;
    expect(component.status()).toBe('NEEDS_CORRECTION');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0]?.reference).toBe('APP-2026-0002');
  });

  it('preserves filters/search in the store across navigation', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.search.set('sara');
    component.onFilter();
    const store = TestBed.inject(ApplicationQueueStore);
    expect(store.get().search).toBe('sara');

    // Simulate leaving and coming back: new component instance restores state.
    const fixture2 = TestBed.createComponent(ApplicationsComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(fixture2.componentInstance.search()).toBe('sara');
    expect(fixture2.componentInstance.filtered().length).toBe(1);
  });

  it('shows the manual intake entry point only with APPLICATION_REVIEW', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelector('a[href="/applications/new"]')).toBeTruthy();
  });
});
