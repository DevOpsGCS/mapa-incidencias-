import type { Server } from "socket.io";
import { znunyReadOnlyQuery } from "../znuny/db";
import { roomsForTicketQueue } from "../znuny/queueAccess";
import { findTicketsByIds } from "../znuny/ticketsRepository";
import { parseStateUpdate } from "./pollerLogic";

const POLL_INTERVAL_MS = 20_000;

export interface StatePollerState {
  lastHistoryId: number;
}

export async function initStatePollerState(): Promise<StatePollerState> {
  const [row] = await znunyReadOnlyQuery<{ maxId: number | null }>(
    "SELECT MAX(id) AS maxId FROM ticket_history"
  );
  return { lastHistoryId: row?.maxId ?? 0 };
}

/** Un ciclo: si lanza, lastHistoryId no avanza y el próximo ciclo reintenta. */
export async function runStateCycle(io: Server, state: StatePollerState): Promise<void> {
  const rows = await znunyReadOnlyQuery<{ id: number; ticket_id: number; name: string }>(
    `SELECT h.id, h.ticket_id, h.name
       FROM ticket_history h
       JOIN ticket_history_type ht ON ht.id = h.history_type_id
      WHERE h.id > ? AND ht.name = 'StateUpdate'
      ORDER BY h.id`,
    [state.lastHistoryId]
  );
  if (rows.length === 0) return;

  const tickets = await findTicketsByIds([...new Set(rows.map((r) => r.ticket_id))]);
  const byId = new Map(tickets.map((t) => [t.id, t]));

  for (const row of rows) {
    const ticket = byId.get(row.ticket_id);
    if (!ticket) continue; // merged/removed
    io.to(roomsForTicketQueue(ticket.queue)).emit("ticket:status_changed", {
      id: ticket.id,
      from: parseStateUpdate(row.name)?.from ?? null,
      to: ticket.state,
      ticket,
    });
  }
  state.lastHistoryId = rows[rows.length - 1].id;
}

export function startZnunyStatePoller(io: Server): void {
  let state: StatePollerState | null = null;

  const tick = async () => {
    try {
      if (!state) {
        state = await initStatePollerState();
        console.log(`[znuny-poller] estados iniciado (lastHistoryId=${state.lastHistoryId})`);
      } else {
        await runStateCycle(io, state);
      }
    } catch (err) {
      console.error("[znuny-poller] error en el ciclo de estados:", err);
    }
    setTimeout(tick, POLL_INTERVAL_MS);
  };
  void tick();
}
