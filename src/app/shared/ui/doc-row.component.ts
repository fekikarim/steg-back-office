import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { I18nService } from '../../core/i18n.service';
import { StIconComponent } from './icon.component';
import { BadgeComponent } from './badge.component';

/**
 * Document preview/download pattern: metadata + verification state +
 * backend-endpoint actions only (never storage keys). Restricted CIN rows
 * render a strong sensitive indicator and disable actions without permission.
 */
@Component({
  selector: 'st-doc-row',
  standalone: true,
  imports: [StIconComponent, BadgeComponent],
  template: `
    <div class="st-doc" [class.st-doc--restricted]="restricted && !canViewRestricted">
      <st-icon name="file" [size]="20" />
      <div class="st-doc__meta">
        <strong class="st-doc__name" dir="auto">{{ fileName }}</strong>
        <span class="st-doc__sub" dir="auto"
          >{{ docType }} · {{ fileSize }} · {{ uploadedAt }}</span
        >
      </div>
      @if (restricted) {
        <st-badge [label]="i18n.t('common.sensitive')" tone="restricted" icon="shield" />
      }
      <st-badge [label]="verificationLabel" [tone]="verificationTone" />
      <div class="st-doc__actions">
        <button
          type="button"
          class="st-btn st-btn--secondary"
          [disabled]="restricted && !canViewRestricted"
          (click)="preview.emit()"
        >
          <st-icon name="eye" [size]="14" /> {{ i18n.t('common.preview') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--secondary"
          [disabled]="restricted && !canViewRestricted"
          (click)="download.emit()"
        >
          <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .st-doc {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        background: var(--bg-surface);
        flex-wrap: wrap;
      }
      .st-doc--restricted {
        border-color: color-mix(in srgb, var(--action-danger) 45%, transparent);
      }
      .st-doc__meta {
        flex: 1;
        min-inline-size: 10rem;
        display: grid;
        gap: 0.15rem;
      }
      .st-doc__name {
        font-size: 0.85rem;
        overflow-wrap: anywhere;
      }
      .st-doc__sub {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-doc__actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class DocRowComponent {
  readonly i18n = inject(I18nService);
  @Input() fileName = '';
  @Input() docType = '';
  @Input() fileSize = '';
  @Input() uploadedAt = '';
  @Input() verificationLabel = '';
  @Input() verificationTone: 'neutral' | 'info' | 'success' | 'warning' | 'error' = 'neutral';
  @Input() restricted = false;
  @Input() canViewRestricted = false;
  @Output() preview = new EventEmitter<void>();
  @Output() download = new EventEmitter<void>();
}
