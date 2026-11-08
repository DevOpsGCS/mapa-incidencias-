import { Ticket } from "../types";

export type DashboardEvent =
  | { type: "new"; ticket: Ticket }
  | { type: "updated"; ticket: Ticket }
  | { type: "removed"; id: number }
  | { type: "status_changed"; id: number; from: string | null; to: string; ticket: Ticket };

function upsert(tickets: Ticket[], incoming: Ticket): Ticket[] {
  const exists = tickets.some((t) => t.id === incoming.id);
  return exists ? tickets.map((t) => (t.id === incoming.id ? incoming : t)) : [incoming, ...tickets];
}

/**
 * Reductor puro de eventos de socket sobre la lista de tickets (clave id numérico).
 * Devuelve el MISMO array cuando el evento no cambia nada (id desconocido en
 * removed / status_changed), para que React no re-renderice.
 */
export function applyDashboardEvent(tickets: Ticket[], event: DashboardEvent): Ticket[] {
  switch (event.type) {
    case "new":
    case "updated":
      return upsert(tickets, event.ticket);
    case "removed":
      return tickets.some((t) => t.id === event.id) ? tickets.filter((t) => t.id !== event.id) : tickets;
    case "status_changed":
      // Ticket que el cliente no tiene cargado (p. ej. cola recién asignada): se ignora.
      return tickets.some((t) => t.id === event.id) ? upsert(tickets, event.ticket) : tickets;
  }
}
