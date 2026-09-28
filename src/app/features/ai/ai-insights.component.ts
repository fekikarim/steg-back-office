import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { AuthService } from '../../core/auth.service';
import { AiAssistantService, type AssistInsight } from './ai-assistant.service';
import { readRememberedSupervisor } from '../internships/supervisor-scope';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { AlertComponent } from '../../shared/ui/alert.component';

/**
 * AI Administrative Insights: a rule-based executive summary of live
 * platform figures (applications, internships, validation workload).
 * Every line links to its source queue; figures are never generated.
 */
@Component({
  selector: 'st-ai-insights',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, AlertComponent],
  template: `
    <section class="st-card" [attr.aria-label]="i18n.t('assistant.insightsTitle')">
      <div class="st-card__head">
        <h2 class="st-card__title">{{ i18n.t('assistant.insightsTitle') }}</h2>
        @if (loading()) {
          <span class="st-hint">{{ i18n.t('common.loading') }}</span>
        }
      </div>
      @if (loading()) {
        <st-skeleton [rows]="3" />
      } @else if (error()) {
        <st-alert tone="warning">{{ i18n.t('assistant.insightsUnavailable') }}</st-alert>
      } @else {
        <ul class="st-insights">
          @for (insight of insights(); track insight.textKey + insight.link) {
            <li dir="auto">
              <a [routerLink]="insight.link" class="st-insight">
                {{ i18n.t(insight.textKey, insight.textParams) }} →
              </a>
            </li>
          }
        </ul>
        <p class="st-note">{{ i18n.t('assistant.ruleBasedNote') }}</p>
      }
    </section>
  `,
  styles: [
    `
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-end: 0.75rem;
      }
      .st-card__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-card__head .st-card__title {
        margin-block-end: 0;
      }
      .st-insights {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
        font-size: 0.85rem;
      }
      .st-insight {
        color: inherit;
        text-decoration: none;
        display: block;
        padding: 0.5rem 0.65rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
      }
      .st-insight:hover {
        border-color: var(--action-primary);
      }
      .st-note {
        font-size: 0.7rem;
        color: var(--text-muted);
        margin: 0.6rem 0 0;
      }
      .st-hint {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    `,
  ],
})
export class AiInsightsComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly assistant = inject(AiAssistantService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly insights = signal<readonly AssistInsight[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    const scope = this.auth.role() === 'SUPERVISOR' ? readRememberedSupervisor() : '';
    this.assistant.loadScoped(scope).subscribe({
      next: (data) => {
        this.insights.set(this.assistant.insights(data));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
