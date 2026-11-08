/**
 * Permisos por cola de Znuny (funciones puras, sin acceso a base).
 * allowedQueues ausente = sin acceso; [] = todo; lista = esas colas y sus
 * subcolas (separadas por "::").
 */
export type QueueAccess =
  | { kind: "all" }
  | { kind: "some"; queues: string[] }
  | { kind: "none" };

export function accessFromAllowedQueues(allowed: string[] | undefined): QueueAccess {
  if (allowed === undefined) return { kind: "none" };
  if (allowed.length === 0) return { kind: "all" };
  return { kind: "some", queues: allowed };
}

// MariaDB usa "\" como carácter de escape por defecto en LIKE.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

/** Condición SQL parametrizada: la cola exacta o cualquier subcola. */
export function toSqlCondition(
  access: QueueAccess,
  column: string
): { sql: string; params: string[] } {
  if (access.kind === "all") return { sql: "1=1", params: [] };
  if (access.kind === "none") return { sql: "1=0", params: [] };
  const params: string[] = [];
  const parts = access.queues.map((queue) => {
    params.push(queue, `${escapeLike(queue)}::%`);
    return `(${column} = ? OR ${column} LIKE ?)`;
  });
  return { sql: `(${parts.join(" OR ")})`, params };
}

/** "A::B::C" -> ["A", "A::B", "A::B::C"] */
export function queueAncestors(queue: string): string[] {
  const parts = queue.split("::");
  return parts.map((_, i) => parts.slice(0, i + 1).join("::"));
}

/** Rooms de socket.io a las que se emite un evento de un ticket en esa cola. */
export function roomsForTicketQueue(queue: string): string[] {
  return ["all-queues", ...queueAncestors(queue).map((q) => `queue:${q}`)];
}

/** Rooms a las que se suscribe un usuario según su acceso. */
export function roomsForAccess(access: QueueAccess): string[] {
  if (access.kind === "all") return ["all-queues"];
  if (access.kind === "none") return [];
  return access.queues.map((q) => `queue:${q}`);
}

export function canSeeQueue(access: QueueAccess, queue: string): boolean {
  if (access.kind === "all") return true;
  if (access.kind === "none") return false;
  return access.queues.some((q) => queue === q || queue.startsWith(`${q}::`));
}
