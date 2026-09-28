import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { permissionsFor, visibleNav, isBackOfficeRole } from './roles';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
  { path: 'supervisor', component: StubComponent },
  { path: 'login', component: StubComponent },
];

describe('AuthService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(stubRoutes)] });
    localStorage.clear();
  });

  it('starts signed out by default', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it('demo sign-in sets role and permissions without persisting tokens', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('admin@steg.tn', 'ADMIN');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('ADMIN');
    expect(auth.hasPermission('FINANCE_PAYMENT_APPROVE')).toBe(true);
    expect(auth.hasPermission('USER_MANAGE')).toBe(true);
    // Test helper now sets a dummy token so interceptors treat it as authenticated
    expect(auth.getAccessToken()).not.toBeNull();
    expect(localStorage.getItem('steg-bo-session') ?? '').not.toContain('token');
  });

  it('supervisor session carries only scoped permissions', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('sup@steg.tn', 'SUPERVISOR');
    expect(auth.hasPermission('INTERNSHIP_VIEW')).toBe(true);
    expect(auth.hasPermission('FINANCE_CASE_VIEW')).toBe(true);
    expect(auth.hasPermission('APPLICATION_VIEW')).toBe(false);
    expect(auth.hasPermission('CANDIDATE_VIEW')).toBe(false);
    expect(auth.hasPermission('AUDIT_VIEW')).toBe(false);
    expect(auth.hasPermission('NOTIFICATION_MANAGE')).toBe(false);
  });

  it('sign-out clears session', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('admin@steg.tn', 'ADMIN');
    auth.setAccessToken('abc');
    auth.signOut();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it('restored sessions under removed roles are dropped', () => {
    localStorage.setItem(
      'steg-bo-session',
      JSON.stringify({ email: 'x@steg.tn', displayName: 'x', role: 'HR', userId: 'u' }),
    );
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(isBackOfficeRole('HR')).toBe(false);
    expect(isBackOfficeRole('FINANCE')).toBe(false);
    expect(isBackOfficeRole('DIRECTOR')).toBe(false);
    expect(isBackOfficeRole('ADMIN')).toBe(true);
    expect(isBackOfficeRole('SUPERVISOR')).toBe(true);
  });
});

describe('roles', () => {
  it('SUPERVISOR sees validation + receipts only; ADMIN sees everything (UX only)', () => {
    const supPaths = visibleNav('SUPERVISOR').flatMap((s) => s.items.map((i) => i.path));
    expect(supPaths).toEqual(['/supervisor-dashboard', '/internships', '/supervisor', '/finance']);
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    for (const p of [
      '/dashboard',
      '/reports',
      '/applications',
      '/candidates',
      '/internships',
      '/supervisor',
      '/finance',
      '/notifications',
      '/tasks',
      '/audit',
      '/admin',
    ]) {
      expect(adminPaths).toContain(p);
    }
  });

  it('ADMIN holds admin permissions; SUPERVISOR holds scoped ones', () => {
    expect(permissionsFor('ADMIN')).toContain('APPLICATION_REVIEW');
    expect(permissionsFor('ADMIN')).toContain('USER_MANAGE');
    expect(permissionsFor('SUPERVISOR')).toContain('FINANCE_PAYMENT_APPROVE');
    expect(permissionsFor('SUPERVISOR')).not.toContain('APPLICATION_REVIEW');
    expect(permissionsFor('SUPERVISOR')).not.toContain('INTERNSHIP_ASSIGN');
    expect(permissionsFor('SUPERVISOR')).not.toContain('REPORT_VIEW');
  });
});
