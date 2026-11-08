import { useCallback, useMemo, useRef, useState } from "react";
import { fetchQueueAccess, fetchSites, fetchTickets } from "../api/client";
import { playTicketChime } from "../lib/notificationSound";
import { computeZnunyStats } from "../lib/znunyStats";
import { QueueAccess, Site, Ticket } from "../types";
import { applyDashboardEvent } from "./dashboardReducer";
import { useCatalog } from "./useCatalog";
import { StatusChangedPayload, useSocket } from "./useSocket";

export { applyDashboardEvent } from "./dashboardReducer";

interface DashboardState {
  sites: Site[];
  tickets: Ticket[];
  queueAccess: QueueAccess;
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastEventAt: Date | null;
  lastHeartbeatAt: Date | null;
}

export interface TicketNotification {
  id: string;
  kind: "new" | "status_changed";
  ticket: Ticket;
  /** Solo para kind === "status_changed" — el estado que tenía antes del cambio. */
  previousState?: string;
}

const MAX_VISIBLE_NOTIFICATIONS = 4;

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    sites: [],
    tickets: [],
    queueAccess: "all",
    loading: true,
    error: null,
    connected: false,
    lastEventAt: null,
    lastHeartbeatAt: null,
  });
  const [notifications, setNotifications] = useState<TicketNotification[]>([]);
  const { catalog } = useCatalog();

  // Necesario para leer el estado más reciente desde handlers registrados
  // una sola vez en el socket (useSocket los conserva vía handlersRef).
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushNotification = useCallback((entry: TicketNotification) => {
    setNotifications((prev) => [...prev, entry].slice(-MAX_VISIBLE_NOTIFICATIONS));
  }, []);

  const handleTicketNew = useCallback(
    (incoming: Ticket) => {
      setState((prev) => ({
        ...prev,
        tickets: applyDashboardEvent(prev.tickets, { type: "new", ticket: incoming }),
        lastEventAt: new Date(),
      }));
      playTicketChime();
      pushNotification({ id: `${incoming.id}-${Date.now()}`, kind: "new", ticket: incoming });
    },
    [pushNotification]
  );

  const handleTicketUpdated = useCallback((incoming: Ticket) => {
    setState((prev) => ({
      ...prev,
      tickets: applyDashboardEvent(prev.tickets, { type: "updated", ticket: incoming }),
      lastEventAt: new Date(),
    }));
  }, []);

  const handleTicketRemoved = useCallback(({ id }: { id: number }) => {
    setState((prev) => {
      const tickets = applyDashboardEvent(prev.tickets, { type: "removed", id });
      // Mismo array = id desconocido: no hay nada que actualizar.
      return tickets === prev.tickets ? prev : { ...prev, tickets, lastEventAt: new Date() };
    });
  }, []);

  /**
   * Ticket que cambió de estado según el poller de estados de Znuny. El
   * evento trae el ticket completo: se upsertea. Solo suena/notifica si el
   * cliente ya tenía el ticket y su estado realmente cambió (si la sync
   * normal ya se adelantó, no hay nada nuevo que avisar).
   */
  const handleStatusChanged = useCallback(
    (payload: StatusChangedPayload) => {
      const existing = stateRef.current.tickets.find((t) => t.id === payload.id);
      if (!existing) return;

      setState((prev) => ({
        ...prev,
        tickets: applyDashboardEvent(prev.tickets, { type: "status_changed", ...payload }),
        lastEventAt: new Date(),
      }));
      if (existing.state === payload.ticket.state) return;

      playTicketChime();
      pushNotification({
        id: `${payload.id}-status-${Date.now()}`,
        kind: "status_changed",
        ticket: payload.ticket,
        previousState: existing.state,
      });
    },
    [pushNotification]
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleHeartbeat = useCallback(() => {
    setState((prev) => ({ ...prev, lastHeartbeatAt: new Date() }));
  }, []);

  /**
   * Pide el estado completo (sitios + tickets + acceso a colas) desde cero.
   * Se llama en la conexión inicial y en cada reconexión: el socket nunca
   * reenvía eventos perdidos durante un corte.
   */
  const loadFullState = useCallback(() => {
    Promise.all([fetchSites(), fetchTickets(), fetchQueueAccess()])
      .then(([sites, tickets, queueAccess]) => {
        setState((prev) => ({ ...prev, sites, tickets, queueAccess, loading: false, error: null }));
      })
      .catch((error: Error) => {
        setState((prev) => ({ ...prev, loading: false, error: error.message }));
      });
  }, []);

  const { connected } = useSocket({
    onTicketNew: handleTicketNew,
    onTicketUpdated: handleTicketUpdated,
    onTicketRemoved: handleTicketRemoved,
    onHeartbeat: handleHeartbeat,
    onStatusChanged: handleStatusChanged,
    onSync: loadFullState,
  });

  // null hasta que llega el catálogo (hace falta topPriorityId).
  const stats = useMemo(
    () => (catalog ? computeZnunyStats(state.tickets, state.sites, catalog.topPriorityId) : null),
    [state.tickets, state.sites, catalog]
  );

  return { ...state, connected, catalog, stats, notifications, dismissNotification };
}
