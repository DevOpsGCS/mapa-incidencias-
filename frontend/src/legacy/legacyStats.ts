import { LegacySite, LegacyTicket, LegacyTicketPriority, LegacyStats, LegacyTicketStatus } from "./types";

const STATUSES: LegacyTicketStatus[] = ["open", "resolved", "closed"];
const PRIORITIES: LegacyTicketPriority[] = ["low", "normal", "high", "urgente"];
const TREND_DAYS = 30;

function isOpenStatus(status: LegacyTicketStatus): boolean {
  return status === "open";
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function dateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/**
 * Recalcula las estadísticas en el cliente a partir del set de tickets
 * actual, para que el mapa y las tarjetas reflejen los eventos de
 * socket.io al instante sin esperar un round-trip a /api/tickets/stats.
 * Debe reflejar exactamente la misma lógica que ticketsRepository.getStats
 * en el backend.
 */
export function computeLegacyStats(tickets: LegacyTicket[], sites: LegacySite[]): LegacyStats {
  const byStatus = STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<LegacyTicketStatus, number>);

  const byPriority = PRIORITIES.reduce((acc, priority) => {
    acc[priority] = 0;
    return acc;
  }, {} as Record<LegacyTicketPriority, number>);

  const bySiteMap = new Map<
    string,
    { total: number; open: number; urgenteOpen: number }
  >();
  sites.forEach((site) => bySiteMap.set(site.id, { total: 0, open: 0, urgenteOpen: 0 }));

  let totalOpen = 0;
  let totalUrgente = 0;
  let resolvedToday = 0;

  const trendMap = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trendMap.set(dateKey(d.toISOString()), 0);
  }

  for (const ticket of tickets) {
    byStatus[ticket.status] += 1;
    byPriority[ticket.priority] += 1;

    const siteEntry = bySiteMap.get(ticket.siteId);
    if (siteEntry) {
      siteEntry.total += 1;
      if (isOpenStatus(ticket.status)) {
        siteEntry.open += 1;
        if (ticket.priority === "urgente") siteEntry.urgenteOpen += 1;
      }
    }

    if (isOpenStatus(ticket.status)) {
      totalOpen += 1;
      if (ticket.priority === "urgente") totalUrgente += 1;
    }

    if (ticket.status === "resolved" && isToday(ticket.updatedAt)) {
      resolvedToday += 1;
    }

    const key = dateKey(ticket.createdAt);
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
  }

  const bySite = sites.map((site) => {
    const entry = bySiteMap.get(site.id) ?? { total: 0, open: 0, urgenteOpen: 0 };
    return {
      siteId: site.id,
      siteName: site.name,
      total: entry.total,
      open: entry.open,
      urgenteOpen: entry.urgenteOpen,
    };
  });

  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  return {
    total: tickets.length,
    byStatus,
    byPriority,
    bySite,
    totalOpen,
    totalUrgente,
    resolvedToday,
    trend,
  };
}
