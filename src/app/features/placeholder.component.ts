import { Component, inject, OnInit, Input } from '@angular/core';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { I18nService } from '../core/i18n.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/states.component';

/** Generic institutional placeholder for Phase C1–C6 queues (keeps nav/routes real). */
@Component({
  selector: 'st-placeholder',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <st-page-header [title]="title" [subtitle]="subtitle" />
    <st-empty-state [title]="i18n.t('common.empty.title')" [body]="body" />
  `,
})
export class PlaceholderComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  @Input() title = '';
  @Input() subtitle = '';
  @Input() body = '';
  @Input() crumbKey = '';
  @Input() crumbFallback = '';

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: this.crumbKey, labelFallback: this.crumbFallback || this.title }]);
  }
}

@Component({
  selector: 'st-forbidden',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <st-page-header
      [title]="i18n.t('common.forbidden.title')"
      [subtitle]="i18n.t('common.forbidden.body')"
    />
    <st-empty-state
      [title]="i18n.t('common.restricted')"
      [body]="i18n.t('common.forbidden.body')"
    />
  `,
})
export class ForbiddenComponent {
  readonly i18n = inject(I18nService);
}

@Component({
  selector: 'st-not-found',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <st-page-header title="404" subtitle="Page introuvable · Page not found · الصفحة غير موجودة" />
    <st-empty-state title="404" body="The requested page does not exist." />
  `,
})
export class NotFoundComponent {
  readonly i18n = inject(I18nService);
}
