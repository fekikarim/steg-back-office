import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './core/guards';

function placeholder(title: string, subtitle: string, body: string, crumbKey: string): object {
  return {
    title,
    subtitle,
    body,
    crumbKey,
    crumbFallback: title,
  };
}

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login.component').then((m) => m.LoginComponent),
    title: 'STEG Back Office — Login',
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/placeholder.component').then((m) => m.ForbiddenComponent),
    title: 'STEG Back Office — Restricted',
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard.component').then((m) => m.DashboardComponent),
        title: 'STEG Back Office — Dashboard',
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/application-queue.component').then(
            (m) => m.ApplicationsComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Applications',
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./features/applications/manual-intake.component').then(
            (m) => m.ManualIntakeComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_REVIEW'])],
        title: 'STEG Back Office — Manual intake',
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./features/applications/application-dossier.component').then(
            (m) => m.ApplicationDossierComponent,
          ),
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Application dossier',
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./features/candidates/candidate-list.component').then(
            (m) => m.CandidateListComponent,
          ),
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidates',
      },
      {
        path: 'candidates/:id',
        loadComponent: () =>
          import('./features/candidates/candidate-detail.component').then(
            (m) => m.CandidateDetailComponent,
          ),
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidate',
      },
      {
        path: 'internships',
        loadComponent: () =>
          import('./features/internships/internship-list.component').then(
            (m) => m.InternshipListComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internships',
      },
      {
        path: 'internships/new',
        loadComponent: () =>
          import('./features/internships/internship-create.component').then(
            (m) => m.InternshipCreateComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_ASSIGN'])],
        title: 'STEG Back Office — New internship',
      },
      {
        path: 'internships/:id',
        loadComponent: () =>
          import('./features/internships/internship-detail.component').then(
            (m) => m.InternshipDetailComponent,
          ),
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internship',
      },
      {
        path: 'assignments',
        loadComponent: () =>
          import('./features/placeholder.component').then((m) => m.PlaceholderComponent),
        canActivate: [permissionGuard(['INTERNSHIP_ASSIGN'])],
        data: placeholder(
          'Supervisors & assignments',
          'One active assignment rule · Phase C3',
          'Assignment workspace lands in Phase C3.',
          'nav.assignments',
        ),
        title: 'STEG Back Office — Assignments',
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./features/placeholder.component').then((m) => m.PlaceholderComponent),
        canActivate: [permissionGuard(['DOCUMENT_VIEW'])],
        data: placeholder(
          'Documents',
          'Restricted CIN handling · Phase C4',
          'Document workspace lands in Phase C4.',
          'nav.documents',
        ),
        title: 'STEG Back Office — Documents',
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance-queue.component').then((m) => m.FinanceQueueComponent),
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance',
      },
      {
        path: 'finance/:id',
        loadComponent: () =>
          import('./features/finance/finance-detail.component').then(
            (m) => m.FinanceDetailComponent,
          ),
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance case',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/placeholder.component').then((m) => m.PlaceholderComponent),
        canActivate: [permissionGuard(['REPORT_VIEW'])],
        data: placeholder(
          'Reports',
          'Backend aggregates only · Phase C1',
          'Reporting lands in Phase C1.',
          'nav.reports',
        ),
        title: 'STEG Back Office — Reports',
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/placeholder.component').then((m) => m.PlaceholderComponent),
        canActivate: [permissionGuard([])],
        data: placeholder(
          'Notifications',
          'Workflow events',
          'Notification center wiring lands in Phase C1.',
          'nav.notifications',
        ),
        title: 'STEG Back Office — Notifications',
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/admin/audit-viewer.component').then((m) => m.AuditViewerComponent),
        canActivate: [permissionGuard(['AUDIT_VIEW'])],
        title: 'STEG Back Office — Audit',
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin-workspace.component').then(
            (m) => m.AdminWorkspaceComponent,
          ),
        canActivate: [permissionGuard(['USER_MANAGE'])],
        title: 'STEG Back Office — Administration',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/placeholder.component').then((m) => m.NotFoundComponent),
    title: 'STEG Back Office — Not found',
  },
];
