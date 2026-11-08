import type { Server } from "socket.io";
import { znunyReadOnlyQuery } from "../znuny/db";
import { roomsForTicketQueue } from "../znuny/queueAccess";
import { findTicketsByIds } from "../znuny/ticketsRepository";
import { removalRooms, selectChanged } from "./pollerLogic";

const POLL_INTERVAL_MS = 20_000;

export interface TicketPollerState {
  lastId: number;
  watermark: string;
  seen: Set<string>;
  /** Última cola conocida por ticket; se llena de forma perezosa. */
  queues: Map<number, string>;
}

export async function initTicketPollerState(): Promise<TicketPollerState> {
  const [row] = await znunyReadOnlyQuery<{ maxId: number | null; maxChange: string | null }>(
    "SELECT MAX(id) AS maxId, MAX(change_time) AS maxChange FROM ticket"
  );
  return {
    lastId: row?.maxId ?? 0,
    watermark: row?.maxChange ?? "1970-01-01 00:00:00",
    seen: new Set(),
    queues: new Map(),
  };
}

/**
 * Un ciclo. Si algo falla (lanza) el estado queda intacto: el próximo ciclo
 * reintenta lo mismo. El estado solo se confirma después de emitir.
 */
export async function runTicketCycle(io: Server, state: TicketPollerState): Promise<void> {
  const rows = await znunyReadOnlyQuery<{ id: number; change_time: string }>(
    "SELECT id, change_time FROM ticket WHERE id > ? OR change_time >= ?",
    [state.lastId, state.watermark]
  );
  const changed = selectChanged(
    rows.map((r) => ({ id: r.id, changeTimeRaw: r.change_time })),
    state.watermark,
    state.seen
  );
  const newIds = new Set(rows.filter((r) => r.id > state.lastId).map((r) => r.id));
  const ids = new Set<number>([...newIds, ...changed.ids]);

  const tickets = await findTicketsByIds([...ids]);
  const found = new Set(tickets.map((t) => t.id));
  const nextQueues = new Map(state.queues);

  for (const ticket of tickets) {
    const rooms = roomsForTicketQueue(ticket.queue);
    if (newIds.has(ticket.id)) {
      io.to(rooms).emit("ticket:new", ticket);
    } else {
      io.to(rooms).emit("ticket:updated", ticket);
      const previous = nextQueues.get(ticket.id);
      if (previous !== undefined && previous !== ticket.queue) {
        const gone = removalRooms(previous, ticket.queue);
        if (gone.length > 0) io.to(gone).emit("ticket:removed", { id: ticket.id });
      }
    }
    nextQueues.set(ticket.id, ticket.queue);
  }

  // Pedidos pero ausentes: el ticket pasó a merged/removed.
  for (const id of ids) {
    if (found.has(id)) continue;
    const lastQueue = nextQueues.get(id);
    if (lastQueue === undefined) continue;
    io.to(roomsForTicketQueue(lastQueue)).emit("ticket:removed", { id });
    nextQueues.delete(id);
  }

  state.lastId = rows.reduce((max, r) => Math.max(max, r.id), state.lastId);
  state.watermark = changed.watermark;
  state.seen = changed.seen;
  state.queues = nextQueues;

  io.emit("sync:heartbeat", { at: new Date().toISOString(), checked: ids.size });
}

export function startZnunyTicketPoller(io: Server): void {
  let state: TicketPollerState | null = null;

  const tick = async () => {
    try {
      if (!state) {
        state = await initTicketPollerState();
        console.log(`[znuny-poller] tickets iniciado (lastId=${state.lastId})`);
      } else {
        await runTicketCycle(io, state);
      }
    } catch (err) {
      console.error("[znuny-poller] error en el ciclo de tickets:", err);
    }
    setTimeout(tick, POLL_INTERVAL_MS);
  };
  void tick();
}
