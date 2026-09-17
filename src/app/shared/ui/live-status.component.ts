import { Component, inject } from '@angular/core';
import { RealtimeService } from '../../core/realtime.service';
import { I18nService } from '../../core/i18n.service';

/**
 * Live status indicator for the professional back office.
 * Shows real-time connection state without any manual refresh button.
 * - connected: green pulsing dot + "Live" + last update time
 * - connecting: yellow dot + "Connecting..."
 * - disconnected/error: red dot + "Offline" + reconnecting hint
 */
@Component({
  selector: 'st-live-status',
  standalone: true,
  imports: [],
  template: `
    <div class="st-live" [attr.data-state]="realtime.state()" role="status" aria-live="polite">
      <span
        class="st-live__dot"
        [class.st-live__dot--connected]="realtime.connected()"
        [class.st-live__dot--connecting]="realtime.connecting()"
        aria-hidden="true"
      ></span>
      @if (realtime.connected()) {
        <span class="st-live__label">{{ i18n.t('live.connected') }}</span>
        @if (realtime.lastEventAt(); as ts) {
          <span class="st-live__time" [attr.title]="ts">{{ formatTime(ts) }}</span>
        }
      } @else if (realtime.connecting()) {
        <span class="st-live__label">{{ i18n.t('live.connecting') }}</span>
      } @else {
        <span class="st-live__label">{{ i18n.t('live.offline') }}</span>
      }
    </div>
  `,
  styles: [
    `
      .st-live {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
        background: var(--bg-page);
        border: 1px solid var(--border-subtle);
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        white-space: nowrap;
      }
      .st-live__dot {
        inline-size: 0.55rem;
        block-size: 0.55rem;
        border-radius: 50%;
        background: var(--status-error);
        flex: none;
      }
      .st-live__dot--connected {
        background: var(--status-success);
        animation: st-pulse 2s infinite;
      }
      .st-live__dot--connecting {
        background: var(--status-warning);
        animation: st-pulse 1s infinite;
      }
      .st-live__label {
        font-weight: 600;
      }
      .st-live__time {
        color: var(--text-muted);
        font-size: 0.7rem;
      }
      @keyframes st-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .st-live__dot--connected,
        .st-live__dot--connecting {
          animation: none;
        }
      }
    `,
  ],
})
export class LiveStatusComponent {
  readonly realtime = inject(RealtimeService);
  readonly i18n = inject(I18nService);

  formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
