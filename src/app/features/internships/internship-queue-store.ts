import { Injectable } from '@angular/core';

/** Preserved internship-queue UI state so back-navigation restores filters/page. */
export interface InternshipQueueState {
  search: string;
  status: string;
  type: string;
  supervisor: string;
  page: number;
  size: number;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
}

export const DEFAULT_INTERNSHIP_QUEUE_STATE: InternshipQueueState = {
  search: '',
  status: '',
  type: '',
  supervisor: '',
  page: 0,
  size: 20,
  sortKey: 'startDate',
  sortDirection: 'desc',
};

/** Session-scoped store (not persisted): survives route changes, resets on reload. */
@Injectable({ providedIn: 'root' })
export class InternshipQueueStore {
  private state: InternshipQueueState = { ...DEFAULT_INTERNSHIP_QUEUE_STATE };

  get(): InternshipQueueState {
    return { ...this.state };
  }

  set(patch: Partial<InternshipQueueState>): void {
    this.state = { ...this.state, ...patch };
  }
}
