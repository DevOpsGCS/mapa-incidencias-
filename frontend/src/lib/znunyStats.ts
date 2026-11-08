import { Site, StateType, Ticket } from "../types";
import { isOpenStateType } from "./znunyColors";
import { svDateKey } from "./svTime";

const TREND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATE_TYPES: StateType[] = ["new", "open", "pending", "closed"];

export interface ZnunyStats {
  total: number;
  totalOpen: number;
  topPriorityOpen: number;
  closedToday: number;
  byStateType: Record<StateType, number>;
  byState: { name: string; stateType: StateType; count: number }[];
  byPriority: { id: number; name: string; count: number }[];
  bySite: { siteId: string; siteName: string; total: number; open: number; topPriorityOpen: number }[];
  trend: { date: string; count: number }[];
}

/**
 * Estadísticas calculadas en el cliente a partir de los tickets en memoria.
 * "Hoy" y los días de la tendencia son días calendario de El Salvador
 * (no UTC ni la zona del navegador).
 */
export function computeZnunyStats(
  tickets: Ticket[],
  sites: Site[],
  topPriorityId: number,
  now: Date = new Date()
): ZnunyStats {
  const byStateType = Object.fromEntries(STATE_TYPES.map((t) => [t, 0])) as Record<StateType, number>;
  const byStateMap = new Map<string, { name: string; stateType: StateType; count: number }>();
  const byPriorityMap = new Map<number, { id: number; name: string; count: number }>();
  const bySiteMap = new Map<
    string,
    { siteId: string; siteName: string; total: number; open: number; topPriorityOpen: number }
  >();
  sites.forEach((site) =>
    bySiteMap.set(site.id, { siteId: site.id, siteName: site.name, total: 0, open: 0, topPriorityOpen: 0 })
  );

  const todayKey = svDateKey(now.toISOString());
  const trendMap = new Map<string, number>();
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    trendMap.set(svDateKey(new Date(now.getTime() - i * DAY_MS).toISOString()), 0);
  }

  let totalOpen = 0;
  let topPriorityOpen = 0;
  let closedToday = 0;

  for (const ticket of tickets) {
    const open = isOpenStateType(ticket.stateType);
    const isTop = open && ticket.priorityId === topPriorityId;

    byStateType[ticket.stateType] += 1;

    const stateEntry = byStateMap.get(ticket.state);
    if (stateEntry) stateEntry.count += 1;
    else byStateMap.set(ticket.state, { name: ticket.state, stateType: ticket.stateType, count: 1 });

    const priorityEntry = byPriorityMap.get(ticket.priorityId);
    if (priorityEntry) priorityEntry.count += 1;
    else byPriorityMap.set(ticket.priorityId, { id: ticket.priorityId, name: ticket.priority, count: 1 });

    // siteId "" = clave de Ubicacion sin sitio mapeado: cuenta en el total global, no por sitio.
    if (ticket.siteId) {
      const siteEntry = bySiteMap.get(ticket.siteId);
      if (siteEntry) {
        siteEntry.total += 1;
        if (open) siteEntry.open += 1;
        if (isTop) siteEntry.topPriorityOpen += 1;
      }
    }

    if (open) totalOpen += 1;
    if (isTop) topPriorityOpen += 1;
    if (ticket.stateType === "closed" && svDateKey(ticket.changedAt) === todayKey) closedToday += 1;

    const createdKey = svDateKey(ticket.createdAt);
    if (trendMap.has(createdKey)) trendMap.set(createdKey, (trendMap.get(createdKey) ?? 0) + 1);
  }

  return {
    total: tickets.length,
    totalOpen,
    topPriorityOpen,
    closedToday,
    byStateType,
    byState: Array.from(byStateMap.values()),
    byPriority: Array.from(byPriorityMap.values()).sort((a, b) => a.id - b.id),
    bySite: Array.from(bySiteMap.values()),
    trend: Array.from(trendMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({ date, count })),
  };
}
