import { AdminUserSummary, Catalog, Ticket } from "../types";
import { isOpenStateType } from "./znunyColors";

export interface QueueAccessRow {
  name: string;
  depth: number;
  openTickets: number;
  usersWithAccess: number;
}

/** `name` es la cola `ancestor` o una de sus subcolas (separador `::`). */
function isSameOrDescendant(name: string, ancestor: string): boolean {
  return name === ancestor || name.startsWith(`${ancestor}::`);
}

/** Orden de árbol: compara segmento a segmento (`A` < `A::C` < `A B`), no por el nombre completo. */
function compareBySegments(a: QueueAccessRow, b: QueueAccessRow): number {
  const sa = a.name.split("::");
  const sb = b.name.split("::");
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    const c = sa[i].localeCompare(sb[i]);
    if (c !== 0) return c;
  }
  return sa.length - sb.length;
}

/** Por cola válida del catálogo: tickets abiertos (incluye subcolas) y usuarios que la ven (todas, exacta o por ancestro). */
export function queueAccessCounts(
  queues: Catalog["queues"],
  users: AdminUserSummary[],
  tickets: Ticket[]
): QueueAccessRow[] {
  const openQueues = tickets.filter((t) => isOpenStateType(t.stateType)).map((t) => t.queue);
  return queues
    .filter((q) => q.valid)
    .map((q) => ({
      name: q.name,
      depth: q.name.split("::").length - 1,
      openTickets: openQueues.filter((queue) => isSameOrDescendant(queue, q.name)).length,
      usersWithAccess: users.filter(
        (u) => u.allowedQueues !== null && (u.allowedQueues.length === 0 || u.allowedQueues.some((a) => isSameOrDescendant(q.name, a)))
      ).length,
    }))
    .sort(compareBySegments);
}
