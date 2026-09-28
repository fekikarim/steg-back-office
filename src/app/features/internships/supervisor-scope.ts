/**
 * Shared supervisor scope: the backend exposes no staff-identity endpoint,
 * so "my interns" is keyed on an explicitly chosen, remembered supervisor
 * name (localStorage). Nothing is guessed from the session.
 */
export const MY_SUPERVISOR_KEY = 'st-mine-supervisor';

export function readRememberedSupervisor(): string {
  try {
    return localStorage.getItem(MY_SUPERVISOR_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberSupervisor(name: string): void {
  try {
    if (name) localStorage.setItem(MY_SUPERVISOR_KEY, name);
    else localStorage.removeItem(MY_SUPERVISOR_KEY);
  } catch {
    /* storage unavailable — filter still works for the session */
  }
}
