const BASE_MS = 5000;
const MAX_MS = 60000;

/** Espera antes del reintento n (0 = primero): 5 s, 10 s, 20 s, 40 s, 60 s y se queda en 60 s. */
export function nextBackoffMs(attempt: number): number {
  return Math.min(BASE_MS * 2 ** Math.max(attempt, 0), MAX_MS);
}
