import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "../api/client";
import { Ticket } from "../types";

export interface HeartbeatPayload {
  at: string;
  /** false = el backend está vivo pero no pudo consultar Znuny en este ciclo. */
  ok?: boolean;
  checked?: number;
}

export interface StatusChangedPayload {
  id: number;
  /** Id de la fila de ticket_history que originó el evento (deduplicación). */
  historyId?: number;
  from: string | null;
  to: string;
  /** Ticket completo ya actualizado: el cliente lo upsertea tal cual. */
  ticket: Ticket;
}

/** Ticket movido de cola o reasignado (Move / OwnerUpdate del historial de Znuny). Solo llega a quienes ven la cola actual (destino). */
export interface TicketChangedPayload {
  id: number;
  historyId: number;
  kind: "queue" | "owner";
  from: string | null;
  to: string;
  ticket: Ticket;
}

interface UseSocketOptions {
  onTicketNew: (ticket: Ticket) => void;
  onTicketUpdated: (ticket: Ticket) => void;
  /** Ticket que dejó de ser visible (borrado, movido a una cola sin acceso, merged...). */
  onTicketRemoved: (payload: { id: number }) => void;
  onHeartbeat: (payload: HeartbeatPayload) => void;
  /** Ticket que cambió de estado — viene del poller de estados de Znuny (znunyStatePoller.ts en el backend). */
  onStatusChanged: (payload: StatusChangedPayload) => void;
  /** Ticket movido de cola o reasignado (también del poller de historial). */
  onTicketChanged: (payload: TicketChangedPayload) => void;
  /**
   * Se llama al conectar por primera vez Y en cada reconexión (automática o
   * forzada por el watchdog). Quien lo use debe volver a pedir el estado
   * completo (tickets/sitios): el backend no guarda un buffer de eventos
   * perdidos, así que cualquier ticket:new/ticket:updated ocurrido mientras
   * el cliente estuvo desconectado nunca se reenvía solo.
   */
  onSync: () => void;
}

// Si un proxy intermedio (ej. nginx con proxy_read_timeout por debajo del
// intervalo real de heartbeat) corta la conexión sin mandar un cierre
// limpio, el navegador puede quedarse "conectado" sin recibir nada nunca
// más — ni disconnect ni reconnect se disparan solos, porque desde el punto
// de vista del cliente el socket sigue ahí. Este watchdog no depende de que
// la librería detecte el corte: si pasó demasiado tiempo sin que llegue
// absolutamente nada (ni heartbeat ni ticket), fuerza una reconexión a mano.
const WATCHDOG_TIMEOUT_MS = 45000; // > 2x el intervalo real del heartbeat del backend (20s)

export function useSocket({
  onTicketNew,
  onTicketUpdated,
  onTicketRemoved,
  onHeartbeat,
  onStatusChanged,
  onTicketChanged,
  onSync,
}: UseSocketOptions) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({ onTicketNew, onTicketUpdated, onTicketRemoved, onHeartbeat, onStatusChanged, onTicketChanged, onSync });
  handlersRef.current = { onTicketNew, onTicketUpdated, onTicketRemoved, onHeartbeat, onStatusChanged, onTicketChanged, onSync };

  useEffect(() => {
    const socket: Socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true, // se reaplica en cada intento de reconexión, no solo en el primero — lo maneja el propio socket.io-client
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    let watchdog: ReturnType<typeof setTimeout>;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        socket.disconnect();
        socket.connect();
      }, WATCHDOG_TIMEOUT_MS);
    };

    socket.on("connect", () => {
      setConnected(true);
      armWatchdog();
      handlersRef.current.onSync();
    });
    socket.on("disconnect", () => {
      setConnected(false);
      clearTimeout(watchdog);
    });
    socket.on("ticket:new", (ticket: Ticket) => {
      armWatchdog();
      handlersRef.current.onTicketNew(ticket);
    });
    socket.on("ticket:updated", (ticket: Ticket) => {
      armWatchdog();
      handlersRef.current.onTicketUpdated(ticket);
    });
    socket.on("ticket:removed", (payload: { id: number }) => {
      armWatchdog();
      handlersRef.current.onTicketRemoved(payload);
    });
    socket.on("sync:heartbeat", (payload: HeartbeatPayload) => {
      armWatchdog();
      handlersRef.current.onHeartbeat(payload);
    });
    socket.on("ticket:status_changed", (payload: StatusChangedPayload) => {
      armWatchdog();
      handlersRef.current.onStatusChanged(payload);
    });
    socket.on("ticket:changed", (payload: TicketChangedPayload) => {
      armWatchdog();
      handlersRef.current.onTicketChanged(payload);
    });

    return () => {
      clearTimeout(watchdog);
      socket.disconnect();
    };
  }, []);

  return { connected };
}
