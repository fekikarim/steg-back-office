import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { I18nService } from '../core/i18n.service';
import { StIconComponent } from '../shared/ui/icon.component';

/** Breadcrumb trail (adapts to RTL; directional chevron mirrors). */
@Component({
  selector: 'st-breadcrumbs',
  standalone: true,
  imports: [RouterLink, StIconComponent],
  template: `
    <nav class="st-crumbs" aria-label="Breadcrumb">
      <ol class="st-crumbs__list">
        <li class="st-crumbs__item">
          <a routerLink="/dashboard" class="st-crumbs__link">{{ i18n.t('shell.home') }}</a>
        </li>
        @for (
          crumb of crumbs.trail();
          track crumb.labelKey + crumb.labelFallback;
          let last = $last
        ) {
          <li class="st-crumbs__item" aria-current="{{ last ? 'page' : 'false' }}">
            <st-icon name="chevronRight" [size]="13" [mirror]="true" />
            @if (crumb.url && !last) {
              <a [routerLink]="crumb.url" class="st-crumbs__link">{{
                i18n.t(crumb.labelKey) !== crumb.labelKey
                  ? i18n.t(crumb.labelKey)
                  : crumb.labelFallback
              }}</a>
            } @else {
              <span class="st-crumbs__current">{{
                i18n.t(crumb.labelKey) !== crumb.labelKey
                  ? i18n.t(crumb.labelKey)
                  : crumb.labelFallback
              }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: [
    `
      .st-crumbs__list {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex-wrap: wrap;
        list-style: none;
        margin: 0 0 0.35rem;
        padding: 0;
        font-size: 0.76rem;
        color: var(--text-muted);
      }
      .st-crumbs__item {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }
      .st-crumbs__link {
        color: var(--action-primary);
        text-decoration: none;
      }
      .st-crumbs__link:hover {
        text-decoration: underline;
      }
      .st-crumbs__current {
        color: var(--text-secondary);
        font-weight: 600;
      }
    `,
  ],
})
export class BreadcrumbsComponent {
  readonly crumbs = inject(BreadcrumbService);
  readonly i18n = inject(I18nService);
}
