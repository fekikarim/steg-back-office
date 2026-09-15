import { Injectable, signal } from '@angular/core';

export interface Crumb {
  readonly labelKey: string;
  readonly labelFallback: string;
  readonly url?: string;
}

/** Breadcrumb state owned by routed pages (shell renders it). */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly _trail = signal<readonly Crumb[]>([]);
  readonly trail = this._trail.asReadonly();

  set(trail: readonly Crumb[]): void {
    this._trail.set(trail);
  }
}
