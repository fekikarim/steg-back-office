import { Injectable } from '@angular/core';

/** Preserved application-queue UI state so back-navigation restores filters/search/page. */
export interface ApplicationQueueState {
  search: string;
  status: string;
  from: string;
  to: string;
  page: number;
  size: number;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
}

export const DEFAULT_QUEUE_STATE: ApplicationQueueState = {
  search: '',
  status: '',
  from: '',
  to: '',
  page: 0,
  size: 20,
  sortKey: 'submissionDate',
  sortDirection: 'desc',
};

/** Session-scoped store (not persisted): survives route changes, resets on reload. */
@Injectable({ providedIn: 'root' })
export class ApplicationQueueStore {
  private state: ApplicationQueueState = { ...DEFAULT_QUEUE_STATE };

  get(): ApplicationQueueState {
    return { ...this.state };
  }

  set(patch: Partial<ApplicationQueueState>): void {
    this.state = { ...this.state, ...patch };
  }

  resetFilters(): void {
    this.state = { ...DEFAULT_QUEUE_STATE, size: this.state.size };
  }
}
