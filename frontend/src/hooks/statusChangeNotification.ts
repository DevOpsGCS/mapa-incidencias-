import { Ticket } from "../types";
import type { StatusChangedPayload } from "./useSocket";

export interface StatusChangeDecision {
  notify: boolean;
  /** Estado anterior a mostrar en la notificación (si notify). */
  previousState?: string;
  /** Clave del evento para no avisar dos veces (si notify). */
  key?: string;
}

/** Clave de deduplicación de un evento ticket:status_changed. */
export function statusChangeKey(payload: StatusChangedPayload): string {
  return payload.historyId !== undefined
    ? `h:${payload.historyId}`
    : `t:${payload.id}|${payload.from ?? ""}|${payload.to}`;
}

/**
 * Decide si un ticket:status_changed debe sonar/notificar.
 *
 * - Ticket que el cliente no tiene cargado (id desconocido): nunca.
 * - Se decide con `from !== to` del propio evento, NO comparando con el estado
 *   que tiene el cliente: un ticket:updated del mismo ciclo puede haber llegado
 *   antes y ya traer el estado nuevo.
 * - Si `from` es null (historial sin formato reconocible), se compara contra
 *   el estado que tenía el cliente.
 * - Un mismo evento de historial (misma clave) se avisa una sola vez.
 */
export function decideStatusChangeNotification(
  payload: StatusChangedPayload,
  existing: Ticket | undefined,
  alreadyNotified: ReadonlySet<string>
): StatusChangeDecision {
  if (!existing) return { notify: false };
  const changed = payload.from !== null ? payload.from !== payload.to : existing.state !== payload.to;
  if (!changed) return { notify: false };
  const key = statusChangeKey(payload);
  if (alreadyNotified.has(key)) return { notify: false };
  return { notify: true, previousState: payload.from ?? existing.state, key };
}
