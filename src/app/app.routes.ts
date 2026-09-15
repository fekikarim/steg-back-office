import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { LoginComponent } from './features/login.component';
import { DashboardComponent } from './features/dashboard.component';
import { ApplicationsComponent } from './features/applications/application-queue.component';
import { ApplicationDossierComponent } from './features/applications/application-dossier.component';
import { ManualIntakeComponent } from './features/applications/manual-intake.component';
import { CandidateListComponent } from './features/candidates/candidate-list.component';
import { CandidateDetailComponent } from './features/candidates/candidate-detail.component';
import { InternshipListComponent } from './features/internships/internship-list.component';
import { InternshipDetailComponent } from './features/internships/internship-detail.component';
import { InternshipCreateComponent } from './features/internships/internship-create.component';
import { FinanceQueueComponent } from './features/finance/finance-queue.component';
import { FinanceDetailComponent } from './features/finance/finance-detail.component';
import {
  PlaceholderComponent,
  ForbiddenComponent,
  NotFoundComponent,
} from './features/placeholder.component';
import { authGuard, permissionGuard } from './core/guards';

function placeholder(title: string, subtitle: string, body: string, crumbKey: string): object {
  return {
    component: PlaceholderComponent,
    title,
    subtitle,
    body,
    crumbKey,
    crumbFallback: title,
  };
}

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'STEG Back Office — Login' },
  { path: 'forbidden', component: ForbiddenComponent, title: 'STEG Back Office — Restricted' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard()],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, title: 'STEG Back Office — Dashboard' },
      {
        path: 'applications',
        component: ApplicationsComponent,
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Applications',
      },
      {
        path: 'applications/new',
        component: ManualIntakeComponent,
        canActivate: [permissionGuard(['APPLICATION_REVIEW'])],
        title: 'STEG Back Office — Manual intake',
      },
      {
        path: 'applications/:id',
        component: ApplicationDossierComponent,
        canActivate: [permissionGuard(['APPLICATION_VIEW'])],
        title: 'STEG Back Office — Application dossier',
      },
      {
        path: 'candidates',
        component: CandidateListComponent,
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidates',
      },
      {
        path: 'candidates/:id',
        component: CandidateDetailComponent,
        canActivate: [permissionGuard(['CANDIDATE_VIEW'])],
        title: 'STEG Back Office — Candidate',
      },
      {
        path: 'internships',
        component: InternshipListComponent,
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internships',
      },
      {
        path: 'internships/new',
        component: InternshipCreateComponent,
        canActivate: [permissionGuard(['INTERNSHIP_ASSIGN'])],
        title: 'STEG Back Office — New internship',
      },
      {
        path: 'internships/:id',
        component: InternshipDetailComponent,
        canActivate: [permissionGuard(['INTERNSHIP_VIEW'])],
        title: 'STEG Back Office — Internship',
      },
      {
        path: 'assignments',
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
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
        component: FinanceQueueComponent,
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance',
      },
      {
        path: 'finance/:id',
        component: FinanceDetailComponent,
        canActivate: [permissionGuard(['FINANCE_CASE_VIEW'])],
        title: 'STEG Back Office — Finance case',
      },
      {
        path: 'reports',
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
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
        component: PlaceholderComponent,
        canActivate: [permissionGuard(['AUDIT_VIEW'])],
        data: placeholder(
          'Audit',
          'Read-only · Phase C6',
          'Audit viewer lands in Phase C6.',
          'nav.audit',
        ),
        title: 'STEG Back Office — Audit',
      },
      {
        path: 'admin',
        component: PlaceholderComponent,
        canActivate: [permissionGuard(['USER_MANAGE'])],
        data: placeholder(
          'Administration',
          'Users, roles, departments · Phase C6',
          'Administration lands in Phase C6.',
          'nav.admin',
        ),
        title: 'STEG Back Office — Administration',
      },
    ],
  },
  { path: '**', component: NotFoundComponent, title: 'STEG Back Office — Not found' },
];
