import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { AiAssistantService, type AssistData } from './ai-assistant.service';
import { readRememberedSupervisor } from '../internships/supervisor-scope';

interface ChatMessage {
  readonly from: 'user' | 'ai';
  readonly text: string;
}

/**
 * Floating administrative assistant. Answers the suggested operational
 * questions from live backend data through deterministic rules — it never
 * invents figures and clearly states its rule-based nature. Conversations
 * stay in memory (no persistence) and never leave the authorized scope:
 * supervisors only see their assigned interns.
 */
@Component({
  selector: 'st-assistant-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <section
        class="st-assistant"
        role="dialog"
        aria-modal="false"
        [attr.aria-label]="i18n.t('assistant.title')"
      >
        <header class="st-assistant__head">
          <strong>{{ i18n.t('assistant.title') }}</strong>
          <div class="st-assistant__head-actions">
            <button
              type="button"
              class="st-btn st-btn--text"
              (click)="reset()"
              [disabled]="messages().length === 0"
            >
              {{ i18n.t('assistant.newConversation') }}
            </button>
            <button
              type="button"
              class="st-btn st-btn--text"
              (click)="open.set(false)"
              [attr.aria-label]="i18n.t('common.close')"
            >
              ✕
            </button>
          </div>
        </header>
        <p class="st-assistant__welcome">{{ i18n.t('assistant.welcome') }}</p>
        <div class="st-assistant__suggest">
          @for (q of suggestedKeys(); track q) {
            <button type="button" class="st-chip" (click)="ask(i18n.t(q))" [disabled]="busy()">
              {{ i18n.t(q) }}
            </button>
          }
        </div>
        <div class="st-assistant__log" aria-live="polite">
          @for (m of messages(); track $index) {
            <p class="st-msg" [class.st-msg--ai]="m.from === 'ai'" dir="auto">{{ m.text }}</p>
          }
          @if (busy()) {
            <p class="st-msg st-msg--ai" aria-busy="true">…</p>
          }
        </div>
        <form class="st-assistant__form" (ngSubmit)="send()">
          <label class="st-sr" for="st-assistant-input">{{ i18n.t('assistant.inputLabel') }}</label>
          <input
            id="st-assistant-input"
            type="text"
            class="st-input"
            [(ngModel)]="draft"
            name="draft"
            dir="auto"
            [placeholder]="i18n.t('assistant.inputLabel')"
            maxlength="500"
          />
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy() || !draft.trim()">
            {{ i18n.t('assistant.send') }}
          </button>
        </form>
        <p class="st-assistant__note">{{ i18n.t('assistant.ruleBasedNote') }}</p>
      </section>
    } @else {
      <button
        type="button"
        class="st-fab"
        (click)="open.set(true)"
        [attr.aria-label]="i18n.t('assistant.title')"
      >
        AI
      </button>
    }
  `,
  styles: [
    `
      .st-fab {
        position: fixed;
        inset-block-end: 1.25rem;
        inset-inline-end: 1.25rem;
        inline-size: 3.25rem;
        block-size: 3.25rem;
        border-radius: 50%;
        border: none;
        background: var(--action-primary);
        color: #fff;
        font-weight: 800;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        z-index: 60;
      }
      .st-assistant {
        position: fixed;
        inset-block-end: 1.25rem;
        inset-inline-end: 1.25rem;
        inline-size: min(24rem, calc(100vw - 2rem));
        max-block-size: min(34rem, calc(100dvh - 4rem));
        display: flex;
        flex-direction: column;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: 0.8rem;
        box-shadow: var(--shadow-md);
        z-index: 60;
        overflow: hidden;
      }
      .st-assistant__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        border-block-end: 1px solid var(--border-subtle);
        font-size: 0.9rem;
      }
      .st-assistant__head-actions {
        display: flex;
        gap: 0.25rem;
      }
      .st-assistant__welcome {
        margin: 0;
        padding: 0.6rem 0.8rem 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .st-assistant__suggest {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.5rem 0.8rem 0;
      }
      .st-chip {
        font-size: 0.72rem;
        border: 1px solid var(--border-default);
        background: var(--bg-page);
        color: inherit;
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
      }
      .st-chip:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .st-assistant__log {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem 0.8rem;
        overflow-y: auto;
        min-block-size: 8rem;
      }
      .st-msg {
        margin: 0;
        font-size: 0.82rem;
        padding: 0.45rem 0.6rem;
        border-radius: 0.55rem;
        background: var(--bg-page);
        align-self: flex-end;
        max-inline-size: 100%;
        overflow-wrap: anywhere;
      }
      .st-msg--ai {
        align-self: flex-start;
        background: color-mix(in srgb, var(--action-primary) 10%, var(--bg-page));
      }
      .st-assistant__form {
        display: flex;
        gap: 0.4rem;
        padding: 0.6rem 0.8rem;
        border-block-start: 1px solid var(--border-subtle);
      }
      .st-assistant__form .st-input {
        flex: 1;
      }
      .st-assistant__note {
        margin: 0;
        padding: 0 0.8rem 0.6rem;
        font-size: 0.68rem;
        color: var(--text-muted);
      }
      .st-sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
    `,
  ],
})
export class AssistantPanelComponent {
  readonly i18n = inject(I18nService);
  private readonly assistant = inject(AiAssistantService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly messages = signal<readonly ChatMessage[]>([]);
  draft = '';
  private data: AssistData | null = null;

  suggestedKeys(): readonly string[] {
    return [
      'assistant.suggest.pending',
      'assistant.suggest.ending',
      'assistant.suggest.documents',
      'assistant.suggest.validation',
      'assistant.suggest.progress',
    ];
  }

  reset(): void {
    this.messages.set([]);
    this.data = null;
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.busy()) return;
    this.ask(text);
    this.draft = '';
  }

  ask(question: string): void {
    const text = question.trim();
    if (!text || this.busy()) return;
    this.messages.set([...this.messages(), { from: 'user', text }]);
    this.busy.set(true);
    // Gemini-backed staff assistant first (role-scoped, audited backend-side);
    // rule-based local figures when the AI service is unreachable.
    this.api.queryAssistant(text).subscribe({
      next: (result) => {
        this.busy.set(false);
        const body = result.responseText?.trim() || this.i18n.t('assistant.answer.unavailable');
        this.messages.set([...this.messages(), { from: 'ai', text: body }]);
      },
      error: () => this.askRuleBased(text),
    });
  }

  private askRuleBased(text: string): void {
    if (this.data) {
      this.reply(this.data, text);
      return;
    }
    const scope = this.auth.role() === 'SUPERVISOR' ? readRememberedSupervisor() : '';
    this.assistant.loadScoped(scope).subscribe({
      next: (data) => {
        this.data = data;
        this.reply(data, text);
      },
      error: () => {
        this.busy.set(false);
        this.messages.set([
          ...this.messages(),
          { from: 'ai', text: this.i18n.t('assistant.answer.unavailable') },
        ]);
      },
    });
  }

  private reply(data: AssistData, question: string): void {
    const { key, params } = this.assistant.answer(question, data);
    this.messages.set([...this.messages(), { from: 'ai', text: this.i18n.t(key, params) }]);
    this.busy.set(false);
  }
}
