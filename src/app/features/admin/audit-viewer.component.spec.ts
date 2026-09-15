import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuditViewerComponent } from './audit-viewer.component';
import { AdminService } from './admin.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function httpError(status: number): { status: number } {
  return { status };
}

const ROW = {
  id: 'log1',
  createdAt: '2026-10-01T10:00:00Z',
  action: 'APPLICATION_ACCEPTED',
  entityType: 'InternshipApplication',
  entityId: 'a1',
  oldValues: null,
  newValues: '{"status":"ACCEPTED"}',
  actorId: 'u1',
  actorEmail: 'rh@steg.tn',
  ipAddress: '10.0.0.1',
};

describe('AuditViewerComponent', () => {
  async function setup(searchImpl?: (q: unknown) => unknown) {
    const seen: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [AuditViewerComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'audit', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: {
            searchAudit: (q: unknown) => {
              seen.push(q);
              return searchImpl
                ? (searchImpl(q) as never)
                : of({ content: [ROW], number: 0, totalPages: 1 });
            },
            getAuditEntry: () => of(ROW),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('admin@steg.tn', 'ADMIN');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AuditViewerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, seen };
  }

  it('queries the server with action/entity/actor filters and pagination', async () => {
    const { fixture, seen } = await setup();
    const component = fixture.componentInstance;
    component.action.set('APPLICATION_ACCEPTED');
    component.actorId.set('u1');
    component.onServerFilter();
    expect(seen.length).toBe(2);
    expect(seen[1]).toMatchObject({ action: 'APPLICATION_ACCEPTED', actorId: 'u1', page: 0 });
    expect(fixture.nativeElement.textContent as string).toContain('APPLICATION_ACCEPTED');
  });

  it('is read-only: no edit or delete affordance exists', async () => {
    const { fixture } = await setup();
    const labels = [...fixture.nativeElement.querySelectorAll('button')].map(
      (b: HTMLButtonElement) => b.textContent?.trim(),
    );
    for (const label of labels) {
      expect(label).not.toMatch(/delete|remove|edit/i);
    }
    expect(fixture.nativeElement.querySelector('st-drawer')).toBeTruthy();
  });

  it('truncates sensitive payloads for cautious display', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    expect(component.preview('x'.repeat(2000)).length).toBeLessThan(2000);
    expect(component.preview(null)).toBe('');
  });

  it('handles ADMIN-only 403 gracefully without leaking data', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AuditViewerComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'audit', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: { searchAudit: () => throwError(() => httpError(403)) },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('dir@steg.tn', 'DIRECTOR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AuditViewerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Restricted access');
    expect(text).not.toContain('APPLICATION_ACCEPTED');
  });
});
