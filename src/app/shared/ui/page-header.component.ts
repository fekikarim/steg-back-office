import { Component, Input, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';

/** Page title + actions area used by every routed page (consistent hierarchy). */
@Component({
  selector: 'st-page-header',
  standalone: true,
  imports: [],
  template: `
    <div class="st-pagehead">
      <div class="st-pagehead__text">
        <h1 class="st-pagehead__title">{{ title }}</h1>
        @if (subtitle) {
          <p class="st-pagehead__sub">{{ subtitle }}</p>
        }
      </div>
      <div class="st-pagehead__actions" role="group" [attr.aria-label]="i18n.t('page.actions')">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .st-pagehead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        flex-wrap: wrap;
        margin-block-end: 1rem;
      }
      .st-pagehead__title {
        margin: 0;
        font-size: 1.4rem;
        color: var(--text-primary);
      }
      .st-pagehead__sub {
        margin: 0.25rem 0 0;
        color: var(--text-secondary);
        font-size: 0.85rem;
      }
      .st-pagehead__actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly i18n = inject(I18nService);
  @Input() title = '';
  @Input() subtitle = '';
}
