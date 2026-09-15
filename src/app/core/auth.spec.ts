import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { permissionsFor, visibleNav } from './roles';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const stubRoutes = [
  { path: 'dashboard', component: StubComponent },
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
    auth.signInDemo('finance@steg.tn', 'FINANCE');
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('FINANCE');
    expect(auth.hasPermission('FINANCE_PAYMENT_APPROVE')).toBe(true);
    expect(auth.hasPermission('USER_MANAGE')).toBe(false);
    // Test helper now sets a dummy token so interceptors treat it as authenticated
    expect(auth.getAccessToken()).not.toBeNull();
    expect(localStorage.getItem('steg-bo-session') ?? '').not.toContain('token');
  });

  it('sign-out clears session', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo('rh@steg.tn', 'HR');
    auth.setAccessToken('abc');
    auth.signOut();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });
});

describe('roles', () => {
  it('FINANCE cannot see admin nav; ADMIN sees audit+admin (UX only)', () => {
    const financePaths = visibleNav('FINANCE').flatMap((s) => s.items.map((i) => i.path));
    expect(financePaths).toContain('/finance');
    expect(financePaths).not.toContain('/admin');
    const adminPaths = visibleNav('ADMIN').flatMap((s) => s.items.map((i) => i.path));
    expect(adminPaths).toContain('/admin');
    expect(adminPaths).toContain('/audit');
  });

  it('HR sees applications but not finance approval permission', () => {
    expect(permissionsFor('HR')).toContain('APPLICATION_REVIEW');
    expect(permissionsFor('HR')).not.toContain('FINANCE_PAYMENT_APPROVE');
  });
});
