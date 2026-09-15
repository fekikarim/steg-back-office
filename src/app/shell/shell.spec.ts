import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AuthService } from '../core/auth.service';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
  { path: 'applications', component: StubComponent },
  { path: 'candidates', component: StubComponent },
  { path: 'internships', component: StubComponent },
  { path: 'assignments', component: StubComponent },
  { path: 'documents', component: StubComponent },
  { path: 'finance', component: StubComponent },
  { path: 'reports', component: StubComponent },
  { path: 'notifications', component: StubComponent },
  { path: 'audit', component: StubComponent },
  { path: 'admin', component: StubComponent },
  { path: 'login', component: StubComponent },
];

describe('ShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter(stubRoutes)],
    }).compileComponents();
  });

  it('creates with skip link for keyboard users', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const skip = fixture.nativeElement.querySelector('.st-skip') as HTMLAnchorElement | null;
    expect(skip).toBeTruthy();
    expect(skip?.getAttribute('href')).toBe('#st-content');
  });

  it('renders sidebar nav and topbar session controls', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('rh@steg.tn', 'HR');
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('st-sidebar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('st-topbar')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('st-breadcrumbs')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main#st-content')).toBeTruthy();
  });

  it('shows role-aware navigation (UX convenience, backend still authoritative)', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('fin@steg.tn', 'FINANCE');
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const links = [...fixture.nativeElement.querySelectorAll('.st-side__link')].map((a: Element) =>
      a.getAttribute('href'),
    );
    expect(links).toContain('/finance');
    expect(links).not.toContain('/admin');
  });

  it('sidebar collapses and drawer toggles', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const component = fixture.componentInstance;
    component.collapsed.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.st-side--collapsed')).toBeTruthy();
  });

  it('a11y: nav has accessible label, buttons have labels', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('admin@steg.tn', 'ADMIN');
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav[aria-label="Primary"]')).toBeTruthy();
    const unlabeled = [...fixture.nativeElement.querySelectorAll('button')].filter(
      (b: HTMLButtonElement) => !(b.textContent?.trim() || b.getAttribute('aria-label')),
    );
    expect(unlabeled).toEqual([]);
  });
});
