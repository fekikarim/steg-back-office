import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { InternshipCreateComponent } from './internship-create.component';
import { InternshipService } from './internship.service';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ACCEPTED_PFE = {
  id: 'a1',
  reference: 'APP-2026-0001',
  status: 'ACCEPTED',
  candidateId: 'c1',
  candidateName: 'Sara Ben Ammar',
  desiredStartDate: '2026-07-01',
  desiredEndDate: '2026-10-31',
  calculatedType: 'PFE',
  requirement: 'OBLIGATOIRE',
};

const PENDING_OBS = {
  ...ACCEPTED_PFE,
  id: 'a2',
  status: 'SUBMITTED',
  calculatedType: 'OBSERVATION',
};

describe('InternshipCreateComponent', () => {
  async function setup(applicationId: string | null, app: unknown) {
    const calls: { method: string; args: unknown[] }[] = [];
    await TestBed.configureTestingModule({
      imports: [InternshipCreateComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
          { path: 'internships/:id', component: StubComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => applicationId } } },
        },
        {
          provide: ApiClient,
          useValue: {
            getApplication: () => of(app),
            listCandidates: () =>
              of([{ id: 'c1', firstName: 'Sara', lastName: 'Ben Ammar', universityName: 'ENIT' }]),
          },
        },
        {
          provide: InternshipService,
          useValue: {
            createFromApplication: (_body: unknown) => {
              calls.push({ method: 'createFromApplication', args: [_body] });
              return of({
                id: 'i1',
                reference: 'STAGE-1',
                type: 'PFE',
                requirement: 'OBLIGATOIRE',
              });
            },
            createManual: (_body: unknown) => {
              calls.push({ method: 'createManual', args: [_body] });
              return of({
                id: 'i2',
                reference: 'STAGE-2',
                type: 'PFE',
                requirement: 'OBLIGATOIRE',
              });
            },
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('rh@steg.tn', 'HR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(InternshipCreateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls };
  }

  it('prefills from ?applicationId= and omits the flag for non-observation', async () => {
    const { fixture, calls } = await setup('a1', ACCEPTED_PFE);
    const component = fixture.componentInstance;
    expect(component.application()?.reference).toBe('APP-2026-0001');
    component.submitFromApplication();
    expect(calls.length).toBe(1);
    expect(calls[0]?.args[0]).toEqual({ applicationId: 'a1', observationObligatoire: null });
    expect(component.created()?.reference).toBe('STAGE-1');
  });

  it('blocks creation from a non-accepted application', async () => {
    const { fixture, calls } = await setup('a2', PENDING_OBS);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('not accepted');
    fixture.componentInstance.submitFromApplication();
    expect(calls.length).toBe(0);
  });

  it('creates manual internships with explicit source data', async () => {
    const { fixture, calls } = await setup(null, null);
    const component = fixture.componentInstance;
    component.mode.set('manual');
    fixture.detectChanges();
    component.manual.candidateId = 'c1';
    component.manual.subject = 'Grid monitoring';
    component.manual.startDate = '2026-07-01';
    component.manual.endDate = '2026-10-31';
    component.submitManual();
    expect(calls.length).toBe(1);
    expect(calls[0]?.args[0]).toMatchObject({
      candidateId: 'c1',
      subject: 'Grid monitoring',
      observationObligatoire: false,
    });
  });

  it('rejects inverted manual dates without calling the backend', async () => {
    const { fixture, calls } = await setup(null, null);
    const component = fixture.componentInstance;
    component.manual.candidateId = 'c1';
    component.manual.subject = 'Grid';
    component.manual.startDate = '2026-10-01';
    component.manual.endDate = '2026-07-01';
    component.submitManual();
    expect(component.formError()).toBeTruthy();
    expect(calls.length).toBe(0);
  });
});
