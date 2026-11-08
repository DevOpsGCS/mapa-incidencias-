/** Lógica pura del formulario de colas por usuario del panel admin. */

/** `[]` = todas las colas; `null` = sin acceso; lista = esas colas y sus subcolas. */
export type QueueAccessMode = "all" | "specific" | "none";

export type QueuePayloadResult =
  | { ok: true; value: string[] | null }
  | { ok: false; error: string };

export const NO_SPECIFIC_QUEUES_ERROR =
  'Elegí al menos una cola, o usá "Todas las colas" o "Sin acceso".';

/** Modo inicial del formulario según lo guardado del usuario. */
export function modeFromAllowedQueues(allowedQueues: string[] | null): QueueAccessMode {
  if (allowedQueues === null) return "none";
  return allowedQueues.length === 0 ? "all" : "specific";
}

/**
 * Modo del formulario → `allowedQueues` que se envía al backend. "Colas
 * específicas" sin ninguna cola NO se convierte en `[]` (que significaría
 * "todas"): se bloquea el envío.
 */
export function buildQueuesPayload(mode: QueueAccessMode, selected: string[]): QueuePayloadResult {
  if (mode === "all") return { ok: true, value: [] };
  if (mode === "none") return { ok: true, value: null };
  if (selected.length === 0) return { ok: false, error: NO_SPECIFIC_QUEUES_ERROR };
  return { ok: true, value: [...selected] };
}

export type QueueCell =
  | { kind: "pending" }
  | { kind: "all" }
  | { kind: "list"; queues: string[] };

/** Qué muestra la columna "Colas" según `allowedQueues`. */
export function queueCellFor(allowedQueues: string[] | null): QueueCell {
  if (allowedQueues === null) return { kind: "pending" };
  if (allowedQueues.length === 0) return { kind: "all" };
  return { kind: "list", queues: allowedQueues };
}

/**
 * Avisos de colas inexistentes. `unknownQueues === null` = no se pudo
 * verificar (Znuny caído): nota neutra, nunca un falso OK ni un error rojo.
 */
export function unknownQueuesNotices(
  unknownQueues: string[] | null
): { kind: "error"; text: string }[] | { kind: "unverified"; text: string } {
  if (unknownQueues === null) {
    return { kind: "unverified", text: "No se pudo verificar (Znuny no disponible)" };
  }
  return unknownQueues.map((q) => ({ kind: "error" as const, text: `Cola inexistente en Znuny: ${q}` }));
}
