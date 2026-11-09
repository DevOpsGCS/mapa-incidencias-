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
    return { kind: "unverified", text: "No se pudo verificar (Mesa de Servicio no disponible)" };
  }
  return unknownQueues.map((q) => ({ kind: "error" as const, text: `Cola inexistente en la Mesa de Servicio: ${q}` }));
}

/**
 * Separa lo seleccionado en colas que existen (válidas en el catálogo) y colas
 * inexistentes (renombradas/borradas en Znuny). `catalogQueues === null` (Znuny
 * caído) = no se puede saber: todo cuenta como existente.
 */
export function splitSelectedQueues(
  selected: string[],
  catalogQueues: { name: string; valid: boolean }[] | null
): { known: string[]; unknown: string[] } {
  if (catalogQueues === null) return { known: [...selected], unknown: [] };
  const valid = new Set(catalogQueues.filter((q) => q.valid).map((q) => q.name));
  return {
    known: selected.filter((q) => valid.has(q)),
    unknown: selected.filter((q) => !valid.has(q)),
  };
}

/** Nueva selección cuando el selector de árbol (que solo ve colas válidas) cambia: conserva las inexistentes aún no quitadas. */
export function mergeKnownSelection(unknown: string[], nextKnown: string[]): string[] {
  return [...unknown, ...nextKnown];
}

/**
 * ¿Cambió allowedQueues respecto de lo guardado? (null = sin acceso,
 * [] = todas, lista = específicas; el orden de la lista no importa). La
 * edición omite allowedQueues si no cambió: el backend valida las colas
 * contra Znuny y, con Znuny caído, no se podría editar ni el email de un
 * usuario con colas específicas.
 */
export function queuesChanged(original: string[] | null, next: string[] | null): boolean {
  if (original === null || next === null) return original !== next;
  if (original.length !== next.length) return true;
  const a = [...original].sort();
  const b = [...next].sort();
  return a.some((q, i) => q !== b[i]);
}
