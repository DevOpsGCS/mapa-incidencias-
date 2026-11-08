import { Ticket } from "../types";
import { rootQueue } from "./queueFilter";
import { UNKNOWN_PRIORITY_RANK } from "./priorityRank";
import { isOpenStateType } from "./znunyColors";

export interface QueueCount {
  /** Cola raíz (las subcolas se agrupan bajo su raíz). */
  queue: string;
  count: number;
}

/** Presencia de prioridad abierta por cuadrante: [rank 0, rank 1, rank 2, rank ≥ 3]. */
export type PriorityPresence = [boolean, boolean, boolean, boolean];

export const EMPTY_PRESENCE: PriorityPresence = [false, false, false, false];

function groupTicketsBySite(tickets: Ticket[]): Map<string, Ticket[]> {
  const bySite = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    // siteId "" = Ubicacion sin sitio mapeado: no tiene marcador en el mapa.
    if (!ticket.siteId) continue;
    const list = bySite.get(ticket.siteId);
    if (list) list.push(ticket);
    else bySite.set(ticket.siteId, [ticket]);
  }
  return bySite;
}

function queueCounts(tickets: Ticket[]): QueueCount[] {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const root = rootQueue(ticket.queue);
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  return Array.from(counts, ([queue, count]) => ({ queue, count })).sort((a, b) => b.count - a.count);
}

/**
 * Desglose de colas raíz por sitio, usado para armar el marcador compuesto
 * del mapa: para cada sitio, las colas con tickets *abiertos* (new/open/
 * pending), de mayor a menor cantidad. Si un sitio no tiene tickets
 * abiertos, cae a la cola históricamente más frecuente (para no dejar el
 * marcador sin ícono).
 */
export function computeSiteQueueBreakdown(tickets: Ticket[]): Map<string, QueueCount[]> {
  const result = new Map<string, QueueCount[]>();
  for (const [siteId, siteTickets] of groupTicketsBySite(tickets)) {
    const openCounts = queueCounts(siteTickets.filter((t) => isOpenStateType(t.stateType)));
    result.set(siteId, openCounts.length > 0 ? openCounts : queueCounts(siteTickets).slice(0, 1));
  }
  return result;
}

/**
 * Presencia (sí/no) de cada prioridad entre los tickets *abiertos* de cada
 * sitio, por rank (0 = la más alta; ≥3 comparten el último cuadrante) —
 * pinta el aro segmentado en 4 cuadrantes del marcador. No es proporcional
 * a la cantidad de tickets.
 */
export function computeSitePriorityPresence(
  tickets: Ticket[],
  rankById: Map<number, number>
): Map<string, PriorityPresence> {
  const result = new Map<string, PriorityPresence>();
  for (const [siteId, siteTickets] of groupTicketsBySite(tickets)) {
    const presence: PriorityPresence = [false, false, false, false];
    for (const ticket of siteTickets) {
      if (!isOpenStateType(ticket.stateType)) continue;
      const rank = rankById.get(ticket.priorityId) ?? UNKNOWN_PRIORITY_RANK;
      presence[Math.min(Math.max(rank, 0), 3)] = true;
    }
    result.set(siteId, presence);
  }
  return result;
}
