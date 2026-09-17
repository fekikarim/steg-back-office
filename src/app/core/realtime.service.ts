import {
  Injectable,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  effect,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Subject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type RealtimeConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface RealtimeNotificationPayload {
  notificationId: string;
  title: string;
  message: string;
  priority: string;
  relatedEntityType: string;
  relatedEntityId: string;
  createdAt: string;
}

export interface BackofficeEvent {
  type:
    | 'application'
    | 'candidate'
    | 'internship'
    | 'finance'
    | 'audit'
    | 'department'
    | 'employee'
    | 'notification'
    | 'unknown';
  action: string;
  entityId?: string;
  payload: RealtimeNotificationPayload;
  receivedAt: string;
}

/**
 * Production-grade WebSocket service for the whole Back Office.
 * Replaces every manual "Refresh" button: pages receive live updates
 * over STOMP (/ws) and auto-reload without user interaction.
 *
 * Guarantees:
 * - Auth-aware: connects only when authenticated, disconnects on logout,
 *   reconnects with fresh JWT after silent refresh / token rotation.
 * - Resilient: exponential backoff with jitter (1s → 30s), STOMP heartbeats
 *   10s each direction, visibility-aware fast reconnect when tab regains focus.
 * - Defensive: each topic subscription is individually guarded (backend may
 *   deny some destinations per role), malformed frames never crash the stream.
 * - Observable contract: typed filtered streams (application/candidate/...) so
 *   queue pages subscribe to their domain only; dashboard listens to all.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);

  private client: Client | null = null;
  private readonly subscriptions = new Map<string, StompSubscription>();
  private reconnectAttempts = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastToken: string | null = null;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  // Signals for UI
  private readonly _state = signal<RealtimeConnectionState>('disconnected');
  readonly state = this._state.asReadonly();
  readonly connected = computed(() => this._state() === 'connected');
  readonly connecting = computed(() => this._state() === 'connecting');

  private readonly _lastEventAt = signal<string | null>(null);
  readonly lastEventAt = this._lastEventAt.asReadonly();

  // Subjects for domain events
  private readonly notificationSubject = new Subject<RealtimeNotificationPayload>();
  private readonly backofficeSubject = new Subject<BackofficeEvent>();
  private readonly rawSubject = new Subject<IMessage>();

  // Public observables
  readonly notifications$: Observable<RealtimeNotificationPayload> =
    this.notificationSubject.asObservable();
  readonly backofficeEvents$: Observable<BackofficeEvent> = this.backofficeSubject.asObservable();
  readonly rawMessages$: Observable<IMessage> = this.rawSubject.asObservable();

  // Convenience filtered streams — each page subscribes to its domain only
  readonly applicationUpdates$ = this.filtered('application');
  readonly candidateUpdates$ = this.filtered('candidate');
  readonly internshipUpdates$ = this.filtered('internship');
  readonly financeUpdates$ = this.filtered('finance');
  readonly auditUpdates$ = this.filtered('audit');

  private filtered(type: BackofficeEvent['type']): Observable<BackofficeEvent> {
    return new Observable<BackofficeEvent>((subscriber) => {
      const sub = this.backofficeSubject.subscribe((e) => {
        if (e.type === type) subscriber.next(e);
      });
      return () => sub.unsubscribe();
    });
  }

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Visibility + online listeners for fast recovery
    this.visibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (
          this.auth.isAuthenticated() &&
          this._state() !== 'connected' &&
          this._state() !== 'connecting'
        ) {
          this.reconnectWithNewToken();
        }
      }
    };
    this.onlineHandler = () => {
      if (this.auth.isAuthenticated() && this._state() !== 'connected') {
        this.reconnectWithNewToken();
      }
    };
    try {
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('online', this.onlineHandler);
    } catch {
      // storage / DOM unavailable (SSR, tests)
    }

    // React to auth changes: connect when authenticated, disconnect when not, reconnect on token rotation
    effect(() => {
      const isAuth = this.auth.isAuthenticated();
      const token = this.auth.getAccessToken();
      if (!isAuth) {
        this.lastToken = null;
        this.disconnect();
        return;
      }
      if (token !== this.lastToken) {
        this.lastToken = token;
        if (this.client?.active) {
          this.reconnectWithNewToken();
        } else {
          this.connect();
        }
      } else if (!this.client?.active && this._state() !== 'connecting') {
        this.connect();
      }
    });
  }

  ngOnDestroy(): void {
    try {
      if (this.visibilityHandler)
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
    } catch {}
    this.disconnect();
  }

  connect(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.client?.active) return;
    let token = this.auth.getAccessToken();
    if (!token) {
      this._state.set('disconnected');
      return;
    }
    // Proactively refresh when the access token is expired or about to expire
    if (this.auth.isAccessTokenExpired(60)) {
      const rt = this.auth.getRefreshToken();
      if (rt) {
        this._state.set('connecting');
        this.auth.refresh().subscribe({
          next: () => {
            const fresh = this.auth.getAccessToken();
            if (fresh) {
              this.lastToken = fresh;
              this.connectWithToken(fresh);
            } else {
              this._state.set('disconnected');
            }
          },
          error: () => this._state.set('disconnected'),
        });
        return;
      }
      this._state.set('disconnected');
      return;
    }
    this.connectWithToken(token);
  }

  private connectWithToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.client?.active) return;

    this._state.set('connecting');
    const wsBase = environment.apiBaseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;

    this.client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: this.computeReconnectDelay(),
      debug: () => {},
      onConnect: () => {
        this.reconnectAttempts = 0;
        this._state.set('connected');
        this._lastEventAt.set(new Date().toISOString());
        this.startHeartbeat();
        this.subscribeAll();
      },
      onStompError: (frame) => {
        const msg = frame.headers['message'] ?? '';
        this._state.set('error');
        console.warn('[Realtime] STOMP error', msg);
        if (
          msg.toLowerCase().includes('unauthorized') ||
          msg.includes('401') ||
          msg.includes('403')
        ) {
          this.handleAuthError();
        }
      },
      onWebSocketClose: (evt: CloseEvent) => {
        if (this._state() === 'connected') this._state.set('disconnected');
        this.stopHeartbeat();
        // Handshake rejected (expired JWT) → refresh the token instead of backing off with a stale token
        if (this.auth.isAccessTokenExpired(10)) {
          this._state.set('error');
          this.handleAuthError();
          return;
        }
        const code = (evt as unknown as { code?: number })?.code;
        if (code === 1008 || code === 4401 || code === 4403) {
          this.handleAuthError();
          return;
        }
        this.reconnectAttempts++;
        // update delay for next auto-reconnect attempt
        if (this.client) this.client.reconnectDelay = this.computeReconnectDelay();
      },
      onWebSocketError: (evt: Event) => {
        this._state.set('error');
        if (this.auth.isAccessTokenExpired(10)) {
          this.handleAuthError();
        }
        // STOMP client will trigger onWebSocketClose afterwards and retry
        void evt;
      },
      onDisconnect: () => {
        this._state.set('disconnected');
        this.stopHeartbeat();
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.client) {
      try {
        for (const sub of this.subscriptions.values()) sub.unsubscribe();
        this.subscriptions.clear();
        this.client.deactivate();
      } catch {}
      this.client = null;
    }
    this._state.set('disconnected');
  }

  private subscribeAll(): void {
    if (!this.client) return;
    this.subscriptions.clear();

    const safeSubscribe = (
      destination: string,
      key: string,
      handler: (msg: IMessage) => void,
    ): void => {
      try {
        const sub = this.client!.subscribe(destination, (msg) => {
          try {
            handler(msg);
          } catch (e) {
            console.warn('[Realtime] handler error', destination, e);
          }
        });
        this.subscriptions.set(key, sub);
      } catch (e) {
        // Backend may deny this destination per role — stream continues
        console.warn('[Realtime] subscribe denied', destination, e);
      }
    };

    safeSubscribe('/user/queue/notifications', 'notifications', (msg) =>
      this.handleNotificationMessage(msg),
    );
    safeSubscribe('/user/queue/errors', 'errors', (msg) => this.rawSubject.next(msg));

    const topics = [
      '/topic/backoffice/applications',
      '/topic/backoffice/candidates',
      '/topic/backoffice/internships',
      '/topic/backoffice/finance',
      '/topic/backoffice/audit',
      '/topic/backoffice/departments',
      '/topic/backoffice/employees',
      '/topic/backoffice/dashboard',
    ];
    for (const dest of topics) {
      safeSubscribe(dest, dest, (msg) => this.handleBackofficeMessage(dest, msg));
    }

    // Fallback generic broadcast topic
    safeSubscribe('/topic/backoffice', 'generic', (msg) =>
      this.handleBackofficeMessage('/topic/backoffice', msg),
    );
  }

  private handleNotificationMessage(msg: IMessage): void {
    this.rawSubject.next(msg);
    this._lastEventAt.set(new Date().toISOString());
    try {
      const payload = JSON.parse(msg.body) as RealtimeNotificationPayload;
      this.notificationSubject.next(payload);
      const event = this.mapNotificationToEvent(payload);
      this.backofficeSubject.next(event);
    } catch {
      this.backofficeSubject.next({
        type: 'notification',
        action: 'new',
        payload: {
          notificationId: '',
          title: '',
          message: msg.body,
          priority: 'NORMAL',
          relatedEntityType: 'Unknown',
          relatedEntityId: '',
          createdAt: new Date().toISOString(),
        },
        receivedAt: new Date().toISOString(),
      });
    }
  }

  private handleBackofficeMessage(destination: string, msg: IMessage): void {
    this.rawSubject.next(msg);
    this._lastEventAt.set(new Date().toISOString());
    try {
      const data = JSON.parse(msg.body);
      const entityType = data.relatedEntityType || data.entityType || data.type || 'unknown';
      const eventType = this.inferTypeFromDestination(destination, entityType);
      this.backofficeSubject.next({
        type: eventType,
        action: data.action || 'update',
        entityId: data.relatedEntityId || data.entityId || data.id,
        payload: data,
        receivedAt: new Date().toISOString(),
      });
    } catch {
      this.backofficeSubject.next({
        type: 'unknown',
        action: 'update',
        payload: {
          notificationId: '',
          title: '',
          message: msg.body,
          priority: 'NORMAL',
          relatedEntityType: 'Unknown',
          relatedEntityId: '',
          createdAt: new Date().toISOString(),
        },
        receivedAt: new Date().toISOString(),
      });
    }
  }

  private mapNotificationToEvent(payload: RealtimeNotificationPayload): BackofficeEvent {
    const typeMap: Record<string, BackofficeEvent['type']> = {
      InternshipApplication: 'application',
      ApplicationDocument: 'application',
      Candidate: 'candidate',
      Internship: 'internship',
      InternshipAssignment: 'internship',
      FinanceCase: 'finance',
      PaymentApproval: 'finance',
      AuditLog: 'audit',
      Department: 'department',
      Employee: 'employee',
      Notification: 'notification',
    };
    const t = typeMap[payload.relatedEntityType] || 'unknown';
    return {
      type: t,
      action: 'notification',
      entityId: payload.relatedEntityId,
      payload,
      receivedAt: new Date().toISOString(),
    };
  }

  private inferTypeFromDestination(dest: string, entityType: string): BackofficeEvent['type'] {
    if (dest.includes('applications')) return 'application';
    if (dest.includes('candidates')) return 'candidate';
    if (dest.includes('internships')) return 'internship';
    if (dest.includes('finance')) return 'finance';
    if (dest.includes('audit')) return 'audit';
    if (dest.includes('departments')) return 'department';
    if (dest.includes('employees')) return 'employee';
    if (dest.includes('dashboard')) return 'unknown'; // dashboard listens to all
    const map: Record<string, BackofficeEvent['type']> = {
      InternshipApplication: 'application',
      Candidate: 'candidate',
      Internship: 'internship',
      FinanceCase: 'finance',
    };
    return map[entityType] || 'unknown';
  }

  private handleAuthError(): void {
    this.auth.refresh().subscribe({
      next: () => this.reconnectWithNewToken(),
      error: () => this.auth.signOut(),
    });
  }

  private reconnectWithNewToken(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  private computeReconnectDelay(): number {
    // Exponential backoff with jitter: 1s * 2^n + up to 300ms jitter, capped at 30s
    const base = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.floor(Math.random() * 300);
    return Math.min(base + jitter, 30000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      try {
        this.client?.publish({ destination: '/app/ping', body: '' });
      } catch {}
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
